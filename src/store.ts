import { and, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Cache } from "./cache";
import { db } from "./db";
import {
    bots,
    type ChatType,
    chats,
    type RouteConfig,
    routeStats,
    routes
} from "./db/schema";
import type { RouteStatus } from "./schema";

// id travels with the route so a failed delivery can stop that exact row.
export type Route = { id: string; destChatId: number; config: RouteConfig };

export type CreateResult =
    | { ok: true; route: StoredRoute }
    | { ok: false; reason: "duplicate" | "unknown_chat" };

export type StoredRoute = {
    id: string;
    sourceChatId: number;
    destChatId: number;
    status: RouteStatus;
    forwarded: number;
    lastForwardedAt: Date | null;
    config: RouteConfig;
    sourceName: string;
    destName: string;
    updatedAt: Date;
};

const routeCache = new Cache<Route[]>("routes");
const ownerCache = new Cache<number | null>("owner");

const routeKey = (botId: number, sourceChatId: number) =>
    `${botId}:${sourceChatId}`;

// Route ids come from URL paths; a non-uuid would throw on the uuid column.
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Store {
    async getOwner(botId: number): Promise<number | undefined> {
        const owner = await ownerCache.get(String(botId), async () => {
            const [row] = await db
                .select({ ownerId: bots.ownerId })
                .from(bots)
                .where(eq(bots.botId, botId))
                .limit(1);
            return row?.ownerId ?? null;
        });
        return owner ?? undefined;
    }

    async setOwner(botId: number, userId: number) {
        await db
            .insert(bots)
            .values({ botId, ownerId: userId })
            .onConflictDoUpdate({
                target: bots.botId,
                set: { ownerId: userId }
            });
        await ownerCache.invalidate(String(botId));
    }

    async getRoutes(botId: number, sourceChatId: number): Promise<Route[]> {
        // Chat ids come from user text; NaN would throw on a bigint column.
        if (!Number.isFinite(sourceChatId)) return [];
        return routeCache.get(routeKey(botId, sourceChatId), async () =>
            db
                .select({
                    id: routes.id,
                    destChatId: routes.destChatId,
                    config: routes.config
                })
                .from(routes)
                .where(
                    and(
                        eq(routes.botId, botId),
                        eq(routes.sourceChatId, sourceChatId),
                        eq(routes.status, "active")
                    )
                )
        );
    }

    async setChatMap(botId: number, sourceChatId: number, destChatId: number) {
        await db.insert(bots).values({ botId }).onConflictDoNothing();
        await db
            .insert(routes)
            .values({ botId, sourceChatId, destChatId })
            .onConflictDoNothing();
        await routeCache.invalidate(routeKey(botId, sourceChatId));
    }

    async remChatMap(botId: number, sourceChatId: number, destChatId?: number) {
        if (!Number.isFinite(sourceChatId)) return;
        await db
            .delete(routes)
            .where(
                and(
                    eq(routes.botId, botId),
                    eq(routes.sourceChatId, sourceChatId),
                    ...(destChatId ? [eq(routes.destChatId, destChatId)] : [])
                )
            );
        await routeCache.invalidate(routeKey(botId, sourceChatId));
    }

    // Every method below scopes its WHERE by botId, so an untrusted route id
    // cannot reach another bot's rows.

    private joinedRoutes() {
        const source = alias(chats, "source_chat");
        const dest = alias(chats, "dest_chat");
        return db
            .select({
                id: routes.id,
                sourceChatId: routes.sourceChatId,
                destChatId: routes.destChatId,
                status: routes.status,
                // mapWith: raw SQL skips the bigint mapper, and postgres-js
                // hands int8 back as a string.
                forwarded:
                    sql<number>`coalesce(${routeStats.forwarded}, 0)`.mapWith(
                        Number
                    ),
                lastForwardedAt: routeStats.lastForwardedAt,
                config: routes.config,
                sourceName: source.title,
                destName: dest.title,
                updatedAt: routes.updatedAt
            })
            .from(routes)
            .innerJoin(source, eq(source.chatId, routes.sourceChatId))
            .innerJoin(dest, eq(dest.chatId, routes.destChatId))
            .leftJoin(routeStats, eq(routeStats.routeId, routes.id))
            .$dynamic();
    }

    async listRoutes(botId: number): Promise<StoredRoute[]> {
        return this.joinedRoutes()
            .where(eq(routes.botId, botId))
            .orderBy(routes.sourceChatId, routes.destChatId);
    }

    async getRoute(
        botId: number,
        id: string
    ): Promise<StoredRoute | undefined> {
        if (!UUID_RE.test(id)) return undefined;
        const [row] = await this.joinedRoutes()
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .limit(1);
        return row;
    }

    async saveChat(chat: {
        chatId: number;
        title: string;
        username?: string;
        type: ChatType;
    }) {
        await db
            .insert(chats)
            .values({
                chatId: chat.chatId,
                title: chat.title,
                username: chat.username ?? null,
                type: chat.type
            })
            .onConflictDoUpdate({
                target: chats.chatId,
                set: {
                    title: chat.title,
                    username: chat.username ?? null,
                    type: chat.type
                }
            });
    }

    async referencedChatIds(botId: number): Promise<number[]> {
        const rows = await db
            .select({
                sourceChatId: routes.sourceChatId,
                destChatId: routes.destChatId
            })
            .from(routes)
            .where(eq(routes.botId, botId));

        const ids = new Set<number>();
        for (const r of rows) {
            ids.add(r.sourceChatId);
            ids.add(r.destChatId);
        }
        return [...ids];
    }

    /** Both chats must already be known; the FK enforces it either way. */
    async createRoute(
        botId: number,
        sourceChatId: number,
        destChatId: number
    ): Promise<CreateResult> {
        const known = await db
            .select({ chatId: chats.chatId })
            .from(chats)
            .where(inArray(chats.chatId, [sourceChatId, destChatId]));
        if (known.length < 2) return { ok: false, reason: "unknown_chat" };

        await db.insert(bots).values({ botId }).onConflictDoNothing();
        const [inserted] = await db
            .insert(routes)
            .values({ botId, sourceChatId, destChatId })
            .onConflictDoNothing()
            .returning({ id: routes.id });
        if (!inserted) return { ok: false, reason: "duplicate" };

        await routeCache.invalidate(routeKey(botId, sourceChatId));
        const route = await this.getRoute(botId, inserted.id);
        return route
            ? { ok: true, route }
            : { ok: false, reason: "unknown_chat" };
    }

    async updateRoute(
        botId: number,
        id: string,
        patch: { config?: RouteConfig; status?: RouteStatus }
    ): Promise<StoredRoute | undefined> {
        if (!UUID_RE.test(id)) return undefined;
        const [row] = await db
            .update(routes)
            .set(patch)
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .returning({ sourceChatId: routes.sourceChatId });
        if (!row) return undefined;
        await routeCache.invalidate(routeKey(botId, row.sourceChatId));
        return this.getRoute(botId, id);
    }

    /**
     * Stops whatever this chat still feeds or receives. Only active routes, so
     * a pause the owner chose is left as they set it.
     */
    async stopRoutesForChat(
        botId: number,
        chatId: number,
        status: RouteStatus,
        scope: "any" | "destination"
    ): Promise<number> {
        if (!Number.isFinite(chatId)) return 0;
        const touches =
            scope === "destination"
                ? eq(routes.destChatId, chatId)
                : or(
                      eq(routes.sourceChatId, chatId),
                      eq(routes.destChatId, chatId)
                  );

        const rows = await db
            .update(routes)
            .set({ status })
            .where(
                and(
                    eq(routes.botId, botId),
                    eq(routes.status, "active"),
                    touches
                )
            )
            .returning({ sourceChatId: routes.sourceChatId });

        for (const { sourceChatId } of rows) {
            await routeCache.invalidate(routeKey(botId, sourceChatId));
        }
        return rows.length;
    }

    /** Delivery hit a failure that will not fix itself. */
    async stopRoute(botId: number, id: string, status: RouteStatus) {
        const [row] = await db
            .update(routes)
            .set({ status })
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .returning({ sourceChatId: routes.sourceChatId });
        if (row) await routeCache.invalidate(routeKey(botId, row.sourceChatId));
    }

    /**
     * Additive, so concurrent instances need no coordination. The join drops
     * routes deleted since the count was taken, which would fail the FK.
     */
    async addForwarded(entries: [string, number][]) {
        if (!entries.length) return;
        const values = sql.join(
            entries.map(([id, n]) => sql`(${id}::uuid, ${n}::bigint)`),
            sql`, `
        );
        await db.execute(sql`
            INSERT INTO route_stats (route_id, forwarded, last_forwarded_at)
            SELECT v.route_id, v.n, now()
            FROM (VALUES ${values}) AS v(route_id, n)
            JOIN routes r ON r.id = v.route_id
            ON CONFLICT (route_id) DO UPDATE SET
                forwarded = route_stats.forwarded + EXCLUDED.forwarded,
                last_forwarded_at = EXCLUDED.last_forwarded_at`);
    }

    /** Chat ids are global, so a supergroup upgrade moves every bot's routes. */
    async migrateChat(oldId: number, newId: number) {
        if (!Number.isFinite(oldId) || !Number.isFinite(newId)) return;
        if (oldId === newId) return;

        const affected = await db
            .select({
                botId: routes.botId,
                sourceChatId: routes.sourceChatId
            })
            .from(routes)
            .where(
                or(eq(routes.sourceChatId, oldId), eq(routes.destChatId, oldId))
            );

        await db.transaction(async (tx) => {
            // The new id needs a row before any route can point at it.
            await tx.execute(sql`
                INSERT INTO chats (chat_id, title, username, type)
                SELECT ${newId}, title, username, type
                FROM chats WHERE chat_id = ${oldId}
                ON CONFLICT (chat_id) DO NOTHING`);

            // The rewrite cannot land if it collides with a route the bot
            // already has, or if both ends map onto the new id.
            await tx.execute(sql`
                DELETE FROM routes a
                WHERE (a.source_chat_id = ${oldId} OR a.dest_chat_id = ${oldId})
                  AND (
                    (CASE WHEN a.source_chat_id = ${oldId}
                        THEN ${newId} ELSE a.source_chat_id END)
                    = (CASE WHEN a.dest_chat_id = ${oldId}
                        THEN ${newId} ELSE a.dest_chat_id END)
                    OR EXISTS (
                      SELECT 1 FROM routes b
                      WHERE b.bot_id = a.bot_id AND b.id <> a.id
                        AND b.source_chat_id = CASE WHEN a.source_chat_id = ${oldId}
                            THEN ${newId} ELSE a.source_chat_id END
                        AND b.dest_chat_id = CASE WHEN a.dest_chat_id = ${oldId}
                            THEN ${newId} ELSE a.dest_chat_id END))`);

            await tx.execute(sql`
                UPDATE routes SET
                    source_chat_id = CASE WHEN source_chat_id = ${oldId}
                        THEN ${newId} ELSE source_chat_id END,
                    dest_chat_id = CASE WHEN dest_chat_id = ${oldId}
                        THEN ${newId} ELSE dest_chat_id END
                WHERE source_chat_id = ${oldId} OR dest_chat_id = ${oldId}`);

            // The FK is restrict, so this only lands once nothing points at it.
            await tx.execute(sql`DELETE FROM chats WHERE chat_id = ${oldId}`);
        });

        for (const { botId, sourceChatId } of affected) {
            await routeCache.invalidate(routeKey(botId, sourceChatId));
            await routeCache.invalidate(routeKey(botId, newId));
        }
    }

    async deleteRoute(botId: number, id: string): Promise<boolean> {
        if (!UUID_RE.test(id)) return false;
        const [row] = await db
            .delete(routes)
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .returning({ sourceChatId: routes.sourceChatId });
        if (row) await routeCache.invalidate(routeKey(botId, row.sourceChatId));
        return row !== undefined;
    }

    async getAllChatMap(botId: number): Promise<Record<string, number[]>> {
        const rows = await db
            .select({
                sourceChatId: routes.sourceChatId,
                destChatId: routes.destChatId
            })
            .from(routes)
            .where(eq(routes.botId, botId))
            .orderBy(routes.sourceChatId, routes.destChatId);

        const map: Record<string, number[]> = {};
        for (const { sourceChatId, destChatId } of rows) {
            map[sourceChatId] ??= [];
            map[sourceChatId].push(destChatId);
        }
        return map;
    }
}

export default new Store();
