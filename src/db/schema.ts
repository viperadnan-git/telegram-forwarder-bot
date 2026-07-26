import { sql } from "drizzle-orm";
import {
    bigint,
    boolean,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/** Per-destination options; shape lives in config.ts. */
export type RouteConfig = Record<string, unknown>;

// NOT NULL, so a row always renders as something until a refresh fills it in.
export const UNNAMED_CHAT = "Unnamed chat";
export const UNKNOWN_USERNAME = "unknown";

export const bots = pgTable("bots", {
    // Tokens are deliberately not stored.
    botId: bigint("bot_id", { mode: "number" }).primaryKey(),
    ownerId: bigint("owner_id", { mode: "number" }),
    // One-shot marker for the bot-name modifier migration in legacy.ts.
    legacyFlagsMigratedAt: timestamp("legacy_flags_migrated_at", {
        withTimezone: true
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow()
});

/** One row per chat, referenced by routes so a route cannot name an unknown chat. */
export const chats = pgTable("chats", {
    chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
    title: text("title").notNull().default(UNNAMED_CHAT),
    username: text("username").notNull().default(UNKNOWN_USERNAME),
    type: text("type"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
});

export const routes = pgTable(
    "routes",
    {
        // Generated app-side: native uuidv7() needs Postgres 18.
        id: uuid("id").primaryKey().$defaultFn(uuidv7),
        botId: bigint("bot_id", { mode: "number" })
            .notNull()
            .references(() => bots.botId, { onDelete: "cascade" }),
        // restrict: deleting a name must not delete routing rules.
        sourceChatId: bigint("source_chat_id", { mode: "number" })
            .notNull()
            .references(() => chats.chatId, { onDelete: "restrict" }),
        destChatId: bigint("dest_chat_id", { mode: "number" })
            .notNull()
            .references(() => chats.chatId, { onDelete: "restrict" }),
        enabled: boolean("enabled").notNull().default(true),
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
        unique("routes_bot_source_dest_key").on(
            t.botId,
            t.sourceChatId,
            t.destChatId
        ),
        index("routes_lookup_idx")
            .on(t.botId, t.sourceChatId)
            .where(sql`${t.enabled}`)
    ]
);
