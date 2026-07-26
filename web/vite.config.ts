import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Served by the bot's Express app under /app, same origin as /api.
export default defineConfig({
    base: "/app/",
    plugins: [svelte()],
    resolve: {
        alias: {
            // The route config schema is defined once, on the server.
            $schema: fileURLToPath(new URL("../src/schema.ts", import.meta.url))
        }
    },
    build: { outDir: "dist", emptyOutDir: true },
    server: {
        proxy: { "/api": "http://localhost:3000" }
    }
});
