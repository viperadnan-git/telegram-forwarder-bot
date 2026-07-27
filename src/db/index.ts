import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import logger from "../modules/logger";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    logger.error("DATABASE_URL is not set");
    throw new Error("DATABASE_URL is required");
}

const sql = postgres(DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    // A transaction-mode pooler cannot hold them, and the parse/plan saved is
    // noise next to network latency at this query rate.
    prepare: false,
    onnotice: () => {},
    connection: { application_name: "telegram-forwarder-bot" }
});

export const db = drizzle(sql, { schema });

// scripts/migrate-redis.ts needs the raw client to close the pool.
export { sql };
