import "dotenv/config";

import { Request, Response } from "express";
import { WEBHOOK_HOST, botCreator, bots } from "./bot";

import express from "express";
import logger from "./modules/logger";
import packageJson from "../package.json";
import { webhookCallback } from "grammy";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST =
    process.env.HOST || process.env.NODE_ENV === "production"
        ? "0.0.0.0"
        : "localhost";

app.use(express.json());
app.use((req: Request, _: Response, next: Function) => {
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

app.post("/bot:token", async (req: Request, res: Response) => {
    let bot = bots.get(req.params.token);

    if (!bot) {
        bot = await botCreator(req.params.token);
    }

    try {
        return await webhookCallback(bot, "express")(req, res);
    } catch (err) {
        return res.status(200).end();
    }
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
                    WEBHOOK_HOST + "/bot" + process.env.BOT_TOKEN,
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
