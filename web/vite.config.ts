import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Served by the bot's Express app under /app, same origin as /api.
export default defineConfig({
    base: "/app/",
    plugins: [svelte()],
    build: { outDir: "dist", emptyOutDir: true },
    server: {
        proxy: { "/api": "http://localhost:3000" }
    }
});
