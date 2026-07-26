/**
 * Backfills the old Redis key layout into Postgres. Re-runnable, and deletes
 * nothing from Redis.
 *
 * Usage: REDIS_URI=... DATABASE_URL=... bun run scripts/migrate-redis.ts
 */

import "dotenv/config";

import { Redis } from "ioredis";
import { db, sql as pg } from "../src/db";
import { bots, chats, routes } from "../src/db/schema";

const OLD_PREFIX = "fwdbot";
const CHUNK = 500;

if (!process.env.REDIS_URI) {
    console.error("REDIS_URI is required");
    process.exit(1);
}

const redis = new Redis(process.env.REDIS_URI);

async function scanKeys(pattern: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = "0";
    do {
        const [next, keys] = await redis.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            1000
        );
        cursor = next;
        found.push(...keys);
    } while (cursor !== "0");
    return found;
}

const chunks = <T>(xs: T[], n: number) =>
    Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
        xs.slice(i * n, i * n + n)
    );

async function main() {
    const ownerKeys = await scanKeys(`${OLD_PREFIX}:*:owner`);
    const chatKeys = await scanKeys(`${OLD_PREFIX}:*:chats`);

    const ownerValues = await redis
        .pipeline(ownerKeys.map((k) => ["get", k]))
        .exec();

    const botRows = new Map<number, number | null>();
    ownerKeys.forEach((key, i) => {
        const botId = Number(key.split(":")[1]);
        const ownerId = Number(ownerValues?.[i]?.[1]);
        if (botId) botRows.set(botId, ownerId || null);
    });
    for (const key of chatKeys) {
        const botId = Number(key.split(":")[1]);
        if (botId && !botRows.has(botId)) botRows.set(botId, null);
    }

    const sourceSets = await redis
        .pipeline(chatKeys.map((k) => ["smembers", k]))
        .exec();

    const pairs: { botId: number; sourceChatId: number }[] = [];
    chatKeys.forEach((key, i) => {
        const botId = Number(key.split(":")[1]);
        for (const source of (sourceSets?.[i]?.[1] as string[]) ?? []) {
            if (botId && Number(source)) {
                pairs.push({ botId, sourceChatId: Number(source) });
            }
        }
    });

    const destSets = await redis
        .pipeline(
            pairs.map((p) => [
                "smembers",
                `${OLD_PREFIX}:${p.botId}:${p.sourceChatId}`
            ])
        )
        .exec();

    const routeRows: {
        botId: number;
        sourceChatId: number;
        destChatId: number;
    }[] = [];
    pairs.forEach((p, i) => {
        for (const dest of (destSets?.[i]?.[1] as string[]) ?? []) {
            if (Number(dest)) {
                routeRows.push({ ...p, destChatId: Number(dest) });
            }
        }
    });

    // routes FKs need a chats row first. Redis only had ids, so these get
    // placeholder names until a refresh.
    const chatIds = new Set<number>();
    for (const r of routeRows) {
        chatIds.add(r.sourceChatId);
        chatIds.add(r.destChatId);
    }
    let chatsInserted = 0;
    for (const chunk of chunks([...chatIds], CHUNK)) {
        const inserted = await db
            .insert(chats)
            .values(chunk.map((chatId) => ({ chatId })))
            .onConflictDoNothing()
            .returning({ chatId: chats.chatId });
        chatsInserted += inserted.length;
    }

    let botsInserted = 0;
    for (const chunk of chunks([...botRows], CHUNK)) {
        const inserted = await db
            .insert(bots)
            .values(chunk.map(([botId, ownerId]) => ({ botId, ownerId })))
            .onConflictDoNothing()
            .returning({ botId: bots.botId });
        botsInserted += inserted.length;
    }

    let routesInserted = 0;
    for (const chunk of chunks(routeRows, CHUNK)) {
        const inserted = await db
            .insert(routes)
            .values(chunk)
            .onConflictDoNothing()
            .returning({ id: routes.id });
        routesInserted += inserted.length;
    }

    const withOwners = [...botRows.values()].filter(Boolean).length;
    console.log(
        `chats:  ${chatIds.size} seen, ${chatsInserted} inserted (placeholder names)\n` +
            `bots:   ${botRows.size} seen (${withOwners} with owners), ` +
            `${botsInserted} inserted, ${botRows.size - botsInserted} already present\n` +
            `routes: ${routeRows.length} seen, ${routesInserted} inserted, ` +
            `${routeRows.length - routesInserted} already present\n` +
            `Old Redis keys were left untouched. Delete them manually once verified.`
    );
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        redis.disconnect();
        await pg.end();
    });
