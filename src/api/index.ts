import express, {
    type NextFunction,
    type Request,
    type Response,
    type Router
} from "express";
import { getBotById } from "../bot";
import { claimBot, describeBot } from "../clone";
import { validateConfig } from "../config";
import { sourceKeyboard } from "../handlers/pick";
import logger from "../lib/logger";
import { resolveChat, resolveUser } from "../lib/utils";
import db from "../store";
import { verifyInitData } from "./auth";

type AuthedRequest = Request & { botId: number; userId: number };

// initData is minted once per app launch and never refreshed, so this bounds a
// whole session: too short and a long edit fails on save.
const MAX_INITDATA_AGE_SECONDS =
    Number(process.env.INITDATA_MAX_AGE_SECONDS) || 86_400;

/**
 * A valid signature proves identity, not ownership. They are separate steps
 * because cloning is offered to people who are explicitly not the owner.
 */
function identify(req: Request, res: Response, next: NextFunction) {
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

    (req as AuthedRequest).botId = botId;
    (req as AuthedRequest).userId = result.user.id;
    next();
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
    const { botId, userId } = req as AuthedRequest;
    const owner = await db.getOwner(botId);

    if (owner === undefined) {
        res.status(403).json({
            reason: "unclaimed",
            error: "This bot has no owner yet"
        });
        return;
    }
    if (owner !== userId) {
        res.status(403).json({
            reason: "not_owner",
            error: "This bot belongs to someone else"
        });
        return;
    }
    next();
}

/** Express 5 types params as string | string[]; ours are always single. */
export const param = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const asHandler =
    (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req as AuthedRequest, res).catch(next);

export function createApiRouter(): Router {
    const router = express.Router();
    // Body parsing is global in index.ts; a second parser here would no-op.
    router.use(identify);

    // Cloning is the one thing a non-owner may do, so it is mounted above the
    // ownership gate. Everything below this point is owner-only.
    router.post(
        "/clone/check",
        asHandler(async (req, res) => {
            const info = await describeBot(String(req.body?.token ?? ""));
            if (!info.ok) {
                res.status(400).json({ error: info.error });
                return;
            }
            res.json({ bot: info.bot });
        })
    );

    router.post(
        "/clone",
        asHandler(async (req, res) => {
            const token = String(req.body?.token ?? "");
            const result = await claimBot(token, req.userId);
            if (!result.ok) {
                res.status(400).json({ error: result.error });
                return;
            }
            res.json({
                bot: result.bot,
                alreadyRunning: result.alreadyRunning
            });
        })
    );

    router.use((req, res, next) => {
        requireOwner(req, res, next).catch(next);
    });

    router.get(
        "/routes",
        asHandler(async (req, res) => {
            res.json({ routes: await db.listRoutes(req.botId) });
        })
    );

    // One-way from here: only the new owner can hand it back.
    router.post(
        "/owner",
        asHandler(async (req, res) => {
            const bot = getBotById(req.botId);
            if (!bot) {
                res.status(503).json({
                    error: "Send a message to the bot, then try again."
                });
                return;
            }

            const result = await resolveUser(
                bot.api,
                String(req.body?.input ?? "")
            );
            if (!result.ok) {
                res.status(400).json({ error: result.error });
                return;
            }
            if (result.chat.id === req.userId) {
                res.status(400).json({ error: "You already own this bot" });
                return;
            }

            await db.setOwner(req.botId, result.chat.id);
            res.json({ ownerId: result.chat.id });
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

            try {
                await bot.api.sendMessage(
                    req.userId,
                    "<b>Step 1 of 2</b> — choose the chat to forward <b>from</b>.",
                    { parse_mode: "HTML", reply_markup: sourceKeyboard() }
                );
            } catch (err: any) {
                const why = err.description ?? err.message ?? "unknown error";
                logger.warn(
                    `Could not open the picker for ${req.userId}: ${why}`
                );
                res.status(502).json({
                    error: `Telegram would not let me message you: ${why}`
                });
                return;
            }
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

            // Narrowed to the caller's own chats: a requested id that this bot
            // does not forward is ignored rather than looked up.
            const owned = await db.referencedChatIds(req.botId);
            const asked = Array.isArray(req.body?.chatIds)
                ? req.body.chatIds.map(Number)
                : undefined;
            const ids = asked
                ? owned.filter((id) => asked.includes(id))
                : owned;
            let updated = 0;
            let failed = 0;

            for (const chatId of ids) {
                try {
                    const chat = await bot.api.getChat(chatId);
                    await db.saveChat({
                        chatId: chat.id,
                        title: "title" in chat ? chat.title : undefined,
                        username:
                            "username" in chat ? chat.username : undefined,
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

            res.json({
                updated,
                failed,
                routes: await db.listRoutes(req.botId)
            });
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

            const result = await resolveChat(
                bot.api,
                String(req.body?.input ?? "")
            );
            if (!result.ok) {
                res.status(400).json({ error: result.error });
                return;
            }

            const chat = result.chat;
            const title = "title" in chat ? chat.title : undefined;
            const username = "username" in chat ? chat.username : undefined;
            await db.saveChat({
                chatId: chat.id,
                title,
                username,
                type: chat.type
            });

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
                res.status(400).json({
                    error: "A chat cannot forward to itself"
                });
                return;
            }

            const route = await db.createRoute(
                req.botId,
                sourceChatId,
                destChatId
            );
            if (!route) {
                res.status(409).json({ error: "That forward already exists" });
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
                res.status(400).json({ error: "Nothing to update" });
                return;
            }

            const route = await db.updateRoute(
                req.botId,
                param(req.params.id),
                patch
            );
            if (!route) {
                res.status(404).json({
                    error: "That forward no longer exists"
                });
                return;
            }
            res.json({ route });
        })
    );

    router.delete(
        "/routes/:id",
        asHandler(async (req, res) => {
            const deleted = await db.deleteRoute(
                req.botId,
                param(req.params.id)
            );
            res.status(deleted ? 204 : 404).end();
        })
    );

    return router;
}
