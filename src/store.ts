import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Cache } from "./cache";
import { db } from "./db";
import {
    bots,
    chats,
    type RouteConfig,
    routes,
    UNKNOWN_USERNAME,
    UNNAMED_CHAT
} from "./db/schema";

export type Route = { destChatId: number; config: RouteConfig };

export type StoredRoute = {
    id: string;
    sourceChatId: number;
    destChatId: number;
    enabled: boolean;
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
                    destChatId: routes.destChatId,
                    config: routes.config
                })
                .from(routes)
                .where(
                    and(
                        eq(routes.botId, botId),
                        eq(routes.sourceChatId, sourceChatId),
                        eq(routes.enabled, true)
                    )
                )
        );
    }

    /** routes FKs require a chats row; the name columns default to placeholders. */
    private async ensureChats(chatIds: number[]) {
        await db
            .insert(chats)
            .values(chatIds.map((chatId) => ({ chatId })))
            .onConflictDoNothing();
    }

    async setChatMap(botId: number, sourceChatId: number, destChatId: number) {
        await db.insert(bots).values({ botId }).onConflictDoNothing();
        await this.ensureChats([sourceChatId, destChatId]);
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

    // Mini App API. Every method scopes its WHERE by botId, so an untrusted
    // route id cannot reach another bot's rows.

    private joinedRoutes() {
        const source = alias(chats, "source_chat");
        const dest = alias(chats, "dest_chat");
        return db
            .select({
                id: routes.id,
                sourceChatId: routes.sourceChatId,
                destChatId: routes.destChatId,
                enabled: routes.enabled,
                config: routes.config,
                sourceName: source.title,
                destName: dest.title,
                updatedAt: routes.updatedAt
            })
            .from(routes)
            .innerJoin(source, eq(source.chatId, routes.sourceChatId))
            .innerJoin(dest, eq(dest.chatId, routes.destChatId))
            .$dynamic();
    }

    async listRoutes(botId: number): Promise<StoredRoute[]> {
        return this.joinedRoutes()
            .where(eq(routes.botId, botId))
            .orderBy(routes.sourceChatId, routes.destChatId);
    }

    private async routeById(
        botId: number,
        id: string
    ): Promise<StoredRoute | undefined> {
        const [row] = await this.joinedRoutes()
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .limit(1);
        return row;
    }

    async saveChat(chat: {
        chatId: number;
        title?: string | null;
        username?: string | null;
        type?: string | null;
    }) {
        const values = {
            chatId: chat.chatId,
            title: chat.title || UNNAMED_CHAT,
            username: chat.username || UNKNOWN_USERNAME,
            type: chat.type ?? null
        };
        await db
            .insert(chats)
            .values(values)
            .onConflictDoUpdate({ target: chats.chatId, set: values });
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

    async createRoute(
        botId: number,
        sourceChatId: number,
        destChatId: number
    ): Promise<StoredRoute | undefined> {
        await db.insert(bots).values({ botId }).onConflictDoNothing();
        await this.ensureChats([sourceChatId, destChatId]);
        const [inserted] = await db
            .insert(routes)
            .values({ botId, sourceChatId, destChatId })
            .onConflictDoNothing()
            .returning({ id: routes.id });
        await routeCache.invalidate(routeKey(botId, sourceChatId));
        return inserted ? this.routeById(botId, inserted.id) : undefined;
    }

    async updateRoute(
        botId: number,
        id: string,
        patch: { config?: RouteConfig; enabled?: boolean }
    ): Promise<StoredRoute | undefined> {
        if (!UUID_RE.test(id)) return undefined;
        const [row] = await db
            .update(routes)
            .set(patch)
            .where(and(eq(routes.botId, botId), eq(routes.id, id)))
            .returning({ sourceChatId: routes.sourceChatId });
        if (!row) return undefined;
        await routeCache.invalidate(routeKey(botId, row.sourceChatId));
        return this.routeById(botId, id);
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
