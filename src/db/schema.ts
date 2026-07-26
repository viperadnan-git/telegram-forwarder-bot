import {
    bigint,
    boolean,
    index,
    jsonb,
    pgTable,
    timestamp,
    unique,
    uuid
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

/** Per-destination forwarding options. Populated in phase 2; empty for now. */
export type RouteConfig = Record<string, unknown>;

export const bots = pgTable("bots", {
    // Bot tokens are deliberately not stored. See the phase 1 design doc.
    botId: bigint("bot_id", { mode: "number" }).primaryKey(),
    ownerId: bigint("owner_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
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
        sourceChatId: bigint("source_chat_id", { mode: "number" }).notNull(),
        destChatId: bigint("dest_chat_id", { mode: "number" }).notNull(),
        enabled: boolean("enabled").notNull().default(true),
        config: jsonb("config").$type<RouteConfig>().notNull().default({}),
        createdAt: timestamp("created_at", { withTimezone: true })
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
