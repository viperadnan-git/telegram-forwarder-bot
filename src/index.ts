import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";
import express, {
    type NextFunction,
    type Request,
    type Response
} from "express";
import { webhookCallback } from "grammy";
import packageJson from "../package.json";
import { createApiRouter } from "./api";
import { botCreator, bots, WEBHOOK_HOST } from "./bot";
import logger from "./modules/logger";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Parenthesised: `a || b ? x : y` parses as `(a || b) ? x : y`, which made
// any HOST value force "0.0.0.0".
const HOST =
    process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost");

app.use(express.json({ limit: "256kb" }));
app.use((req: Request, _: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

app.get("/", (_: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
        `<meta http-equiv="refresh" content="0;url='${packageJson.homepage}'" />`
    );
});

app.get("/ping", (_: Request, res: Response) => {
    res.end("pong");
});

app.use("/api", createApiRouter());

const webDist = path.join(__dirname, "..", "web", "dist");
if (existsSync(webDist)) {
    app.use("/app", express.static(webDist));
    app.get("/app/*", (_: Request, res: Response) => {
        res.sendFile(path.join(webDist, "index.html"));
    });
} else {
    logger.warn(
        `Mini App build not found at ${webDist}. Run "bun run build:web" to enable /app.`
    );
}

app.post("/bot:token", async (req: Request, res: Response) => {
    let bot = bots.get(req.params.token);

    if (!bot) {
        bot = await botCreator(req.params.token);
    }

    try {
        return await webhookCallback(bot, "express")(req, res);
    } catch (err: any) {
        // 200 so Telegram does not retry a poisoned update, but never silently.
        logger.error(`Update handling failed: ${err?.stack ?? err}`);
        if (!res.headersSent) return res.status(200).end();
    }
});

// Last, so it also catches body-parser failures. Express's default handler
// would render the stack trace into the response.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = Number(err?.status) || 500;
    logger.error(`${req.method} ${req.path} failed: ${err?.message}`);
    if (res.headersSent) return;
    res.status(status).json({
        error:
            status === 500 ? "internal error" : (err?.message ?? "bad request")
    });
});

app.listen(PORT, HOST, async () => {
    logger.info(`Listening on port http://${HOST}:${PORT}`);

    if (!WEBHOOK_HOST) {
        logger.warn(
            "WEBHOOK_HOST is not set. Cloning feature won't work. Set it manually if you want to use webhooks."
        );
    } else {
        if (process.env.BOT_TOKEN) {
            logger.info("Setting bot webhook");
            const bot = botCreator(process.env.BOT_TOKEN);
            try {
                await bot.api.setWebhook(
                    `${WEBHOOK_HOST}/bot${process.env.BOT_TOKEN}`,
                    {
                        drop_pending_updates: true
                    }
                );
            } catch (error: any) {
                logger.warn(`Error when setting webhook: ${error.message}`);
            }
        }
    }
});
