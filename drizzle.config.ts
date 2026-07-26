import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    // DDL should not go through a transaction pooler. Set DIRECT_DATABASE_URL
    // to the non-pooled endpoint when DATABASE_URL points at a pooler.
    dbCredentials: {
        url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!
    }
});
