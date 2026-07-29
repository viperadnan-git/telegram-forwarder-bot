import { sql } from "drizzle-orm";
import {
    bigint,
    check,
    foreignKey,
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { ROUTE_STATUS, type RouteStatus } from "../schema";

/** Per-destination options; shape lives in config.ts. */
export type RouteConfig = Record<string, unknown>;

// Derived from the vocabulary the Mini App reads, so the two cannot drift.
export const routeStatus = pgEnum(
    "route_status",
    Object.keys(ROUTE_STATUS) as [RouteStatus, ...RouteStatus[]]
);

/** Telegram's own closed set, matching grammY's Chat["type"]. */
export const chatType = pgEnum("chat_type", [
    "private",
    "group",
    "supergroup",
    "channel"
]);

export type ChatType = (typeof chatType.enumValues)[number];

export const bots = pgTable("bots", {
    botId: bigint("bot_id", { mode: "number" }).primaryKey(),
    ownerId: bigint("owner_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow()
});

export const chats = pgTable("chats", {
    chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
    title: text("title").notNull(),
    username: text("username"),
    type: chatType("type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
});

export const routes = pgTable(
    "routes",
    {
        // Generated app-side: native uuidv7() needs Postgres 18.
        id: uuid("id").primaryKey().$defaultFn(uuidv7),
        botId: bigint("bot_id", { mode: "number" }).notNull(),
        sourceChatId: bigint("source_chat_id", { mode: "number" }).notNull(),
        destChatId: bigint("dest_chat_id", { mode: "number" }).notNull(),
        status: routeStatus("status").notNull().default("active"),
        config: jsonb("config").$type<RouteConfig>().notNull().default({}),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        // Maintained by the set_updated_at trigger, so raw SQL bumps it too.
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (t) => [
        foreignKey({
            name: "routes_bot_id_fkey",
            columns: [t.botId],
            foreignColumns: [bots.botId]
        }).onDelete("cascade"),
        // restrict: deleting a name must not delete routing rules.
        foreignKey({
            name: "routes_source_chat_id_fkey",
            columns: [t.sourceChatId],
            foreignColumns: [chats.chatId]
        }).onDelete("restrict"),
        foreignKey({
            name: "routes_dest_chat_id_fkey",
            columns: [t.destChatId],
            foreignColumns: [chats.chatId]
        }).onDelete("restrict"),
        unique("routes_bot_source_dest_key").on(
            t.botId,
            t.sourceChatId,
            t.destChatId
        ),
        check(
            "routes_no_self_forward_check",
            sql`${t.sourceChatId} <> ${t.destChatId}`
        ),
        index("routes_bot_id_source_chat_id_idx")
            .on(t.botId, t.sourceChatId)
            .where(sql`${t.status} = 'active'`)
    ]
);

export const routeStats = pgTable(
    "route_stats",
    {
        routeId: uuid("route_id").primaryKey(),
        forwarded: bigint("forwarded", { mode: "number" }).notNull().default(0),
        lastForwardedAt: timestamp("last_forwarded_at", { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (t) => [
        foreignKey({
            name: "route_stats_route_id_fkey",
            columns: [t.routeId],
            foreignColumns: [routes.id]
        }).onDelete("cascade")
    ]
);
