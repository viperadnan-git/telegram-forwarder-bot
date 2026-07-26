import { RouteConfig, bots, routes } from "./db/schema";
import { and, eq } from "drizzle-orm";

import { Cache } from "./cache";
import { db } from "./db";

export type Route = { destChatId: number; config: RouteConfig };

const routeCache = new Cache<Route[]>("routes");
const ownerCache = new Cache<number | null>("owner");

const routeKey = (botId: number, sourceChatId: number) =>
    `${botId}:${sourceChatId}`;

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
        // /get and /rem parse chat ids from user text; NaN would reach a bigint
        // column and throw, where Redis simply returned nothing.
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

    async setChatMap(botId: number, sourceChatId: number, destChatId: number) {
        // A route needs its bot row to exist; /set is owner-only but the owner
        // may have been set before this table existed.
        await db.insert(bots).values({ botId }).onConflictDoNothing();
        await db
            .insert(routes)
            .values({ botId, sourceChatId, destChatId })
            .onConflictDoNothing();
        await routeCache.invalidate(routeKey(botId, sourceChatId));
    }

    async remChatMap(
        botId: number,
        sourceChatId: number,
        destChatId?: number
    ) {
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
            (map[sourceChatId] ??= []).push(destChatId);
        }
        return map;
    }
}

export default new Store();
