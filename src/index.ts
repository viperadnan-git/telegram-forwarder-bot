import "dotenv/config";

import { WEBHOOK_HOST, botCreator, bots } from "./bot";

import db from "./database";
import express from "express";
import logger from "./modules/logger";
import { webhookCallback } from "grammy";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";

app.use(express.json());
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

app.get("/", (req, res) => {
    res.end("Hello world!");
});

app.post("/bot:token", async (req, res) => {
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

db.connect().then(() => {
    app.listen(PORT, HOST, async () => {
        logger.info(`Listening on port http://${HOST}:${PORT}`);

        if (!WEBHOOK_HOST) {
            logger.warn(
                "WEBHOOK_HOST is not set. Set it manually if you want to use webhooks."
            );
        } else {
            if (process.env.BOT_TOKEN) {
                logger.info("Setting bot webhook");
                const bot = botCreator(process.env.BOT_TOKEN);
                try {
                    await bot.api.setWebhook(
                        WEBHOOK_HOST + "/bot" + process.env.BOT_TOKEN,
                        {
                            drop_pending_updates: true,
                        }
                    );
                } catch (error: any) {
                    logger.warn(`Error when setting webhook: ${error.message}`);
                }
            }
        }
    });
});
