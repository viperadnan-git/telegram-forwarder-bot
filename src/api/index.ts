import { NextFunction, Request, Response, Router } from "express";

import db from "../store";
import express from "express";
import { getBotById } from "../bot";
import logger from "../modules/logger";
import { resolveChat } from "../modules/utils";
import { sourceKeyboard } from "../handlers/pick";
import { validateConfig } from "../config";
import { verifyInitData } from "./auth";

type AuthedRequest = Request & { botId: number; userId: number };

const MAX_INITDATA_AGE_SECONDS =
    Number(process.env.INITDATA_MAX_AGE_SECONDS) || 300;

/** A valid signature proves identity, not ownership; both are checked. */
async function authenticate(req: Request, res: Response, next: NextFunction) {
    const header = req.get("authorization") ?? "";
    const initData = header.startsWith("tma ") ? header.slice(4) : "";
    const botId = Number(req.get("x-bot-id"));

    if (!initData) {
        res.status(401).json({ error: "missing initData" });
        return;
    }

    const result = verifyInitData(initData, botId, {
        maxAgeSeconds: MAX_INITDATA_AGE_SECONDS
    });
    if (!result.ok) {
        logger.debug(`Mini App auth rejected: ${result.error}`);
        res.status(401).json({ error: result.error });
        return;
    }

    const owner = await db.getOwner(botId);
    if (owner === undefined) {
        res.status(403).json({
            reason: "unclaimed",
            error: "This bot has no owner yet"
        });
        return;
    }
    if (owner !== result.user.id) {
        res.status(403).json({
            reason: "not_owner",
            error: "This bot belongs to someone else"
        });
        return;
    }

    (req as AuthedRequest).botId = botId;
    (req as AuthedRequest).userId = result.user.id;
    next();
}

const asHandler =
    (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req as AuthedRequest, res).catch(next);

export function createApiRouter(): Router {
    const router = express.Router();
    router.use(express.json({ limit: "64kb" }));
    router.use((req, res, next) => {
        authenticate(req, res, next).catch(next);
    });

    router.get(
        "/routes",
        asHandler(async (req, res) => {
            res.json({ routes: await db.listRoutes(req.botId) });
        })
    );

    // The picker only exists as a reply keyboard, which a Mini App cannot show,
    // so the server sends it into the private chat and the app closes itself.
    router.post(
        "/flow/set",
        asHandler(async (req, res) => {
            const bot = getBotById(req.botId);
            if (!bot) {
                res.status(503).json({
                    error: "Send a message to the bot, then try again."
                });
                return;
            }

            await bot.api.sendMessage(
                req.userId,
                "<b>Step 1 of 2</b> — choose the chat to forward <b>from</b>.",
                { parse_mode: "HTML", reply_markup: sourceKeyboard() }
            );
            res.status(204).end();
        })
    );

    // User-triggered; reading the list never calls Telegram.
    router.post(
        "/chats/refresh",
        asHandler(async (req, res) => {
            const bot = getBotById(req.botId);
            if (!bot) {
                res.status(503).json({
                    error: "Send a message to the bot, then try again."
                });
                return;
            }

            const ids = await db.referencedChatIds(req.botId);
            let updated = 0;
            let failed = 0;

            for (const chatId of ids) {
                try {
                    const chat = await bot.api.getChat(chatId);
                    await db.saveChat({
                        chatId: chat.id,
                        title: "title" in chat ? chat.title : undefined,
                        username: "username" in chat ? chat.username : undefined,
                        type: chat.type
                    });
                    updated++;
                } catch (err: any) {
                    // Bot removed or chat gone; keep the placeholder.
                    logger.debug(
                        `Refresh failed for ${chatId}: ${err.description ?? err.message}`
                    );
                    failed++;
                }
            }

            res.json({ updated, failed, routes: await db.listRoutes(req.botId) });
        })
    );

    // Secondary to the picker. Stores the name too, so creating the route
    // afterwards needs no second lookup.
    router.post(
        "/resolve",
        asHandler(async (req, res) => {
            const bot = getBotById(req.botId);
            if (!bot) {
                res.status(503).json({
                    error: "Send a message to the bot, then try again."
                });
                return;
            }

            const result = await resolveChat(bot.api, String(req.body?.input ?? ""));
            if (!result.ok) {
                res.status(400).json({ error: result.error });
                return;
            }

            const chat = result.chat;
            const title = "title" in chat ? chat.title : undefined;
            const username = "username" in chat ? chat.username : undefined;
            await db.saveChat({ chatId: chat.id, title, username, type: chat.type });

            res.json({ chatId: chat.id, title, username, type: chat.type });
        })
    );

    router.post(
        "/routes",
        asHandler(async (req, res) => {
            const sourceChatId = Number(req.body?.sourceChatId);
            const destChatId = Number(req.body?.destChatId);

            if (
                !Number.isSafeInteger(sourceChatId) ||
                !Number.isSafeInteger(destChatId)
            ) {
                res.status(400).json({
                    error: "Both chats must be resolved before adding"
                });
                return;
            }
            if (sourceChatId === destChatId) {
                res.status(400).json({ error: "A chat cannot forward to itself" });
                return;
            }

            const route = await db.createRoute(req.botId, sourceChatId, destChatId);
            if (!route) {
                res.status(409).json({ error: "That route already exists" });
                return;
            }
            res.status(201).json({ route });
        })
    );

    router.patch(
        "/routes/:id",
        asHandler(async (req, res) => {
            const patch: { config?: any; enabled?: boolean } = {};

            if (req.body?.config !== undefined) {
                const result = validateConfig(req.body.config);
                if (!result.ok) {
                    res.status(400).json({ error: result.error });
                    return;
                }
                patch.config = result.config;
            }
            if (typeof req.body?.enabled === "boolean") {
                patch.enabled = req.body.enabled;
            }
            if (Object.keys(patch).length === 0) {
                res.status(400).json({ error: "nothing to update" });
                return;
            }

            const route = await db.updateRoute(req.botId, req.params.id, patch);
            if (!route) {
                res.status(404).json({ error: "route not found" });
                return;
            }
            res.json({ route });
        })
    );

    router.delete(
        "/routes/:id",
        asHandler(async (req, res) => {
            const deleted = await db.deleteRoute(req.botId, req.params.id);
            res.status(deleted ? 204 : 404).end();
        })
    );

    return router;
}
