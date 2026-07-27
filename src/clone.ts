import { type Api, Bot } from "grammy";
import { botCreator, bots, WEBHOOK_HOST } from "./bot";
import logger from "./modules/logger";
import { botTokenSchema } from "./schema";
import db from "./store";

export type BotInfo = {
    id: number;
    username: string;
    firstName: string;
    /** Inlined, because the file URL carries the token in its path. */
    photo?: string;
};

// Telegram's "small" avatar is a few KB; anything larger is not one.
const MAX_PHOTO_BYTES = 128_000;

export type CloneResult =
    | { ok: true; bot: BotInfo; alreadyRunning: boolean }
    | { ok: false; error: string };

const idOf = (token: string) => Number(token.split(":")[0]);

/**
 * Asks Telegram who a token belongs to. Never logs the token: it is the whole
 * credential, and this instance hosts other people's bots.
 */
export async function describeBot(
    raw: string
): Promise<{ ok: true; bot: BotInfo } | { ok: false; error: string }> {
    const parsed = botTokenSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0].message };
    }
    const token = parsed.data;

    try {
        const api = new Bot(token).api;
        const me = await api.getMe();
        return {
            ok: true,
            bot: {
                id: me.id,
                username: me.username,
                firstName: me.first_name,
                photo: await avatar(api, token, me.id)
            }
        };
    } catch (error: any) {
        const description: string = error.description ?? error.message ?? "";
        if (/unauthorized/i.test(description)) {
            return {
                ok: false,
                error: "Telegram rejected that token. Check you copied all of it, and that it has not been revoked."
            };
        }
        logger.warn(`getMe failed for bot ${idOf(token)}: ${description}`);
        return { ok: false, error: description || "Could not reach Telegram" };
    }
}

/** getMe carries no photo. Best effort: never blocks the confirmation step. */
async function avatar(
    api: Api,
    token: string,
    botId: number
): Promise<string | undefined> {
    try {
        const chat = await api.getChat(botId);
        const fileId = chat.photo?.small_file_id;
        if (!fileId) return undefined;

        const file = await api.getFile(fileId);
        if (!file.file_path) return undefined;

        const response = await fetch(
            `https://api.telegram.org/file/bot${token}/${file.file_path}`
        );
        if (!response.ok) return undefined;

        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.byteLength > MAX_PHOTO_BYTES) return undefined;
        return `data:image/jpeg;base64,${bytes.toString("base64")}`;
    } catch (error: any) {
        logger.debug(`No avatar for bot ${botId}: ${error.message}`);
        return undefined;
    }
}

/** Starts the bot if it is new, and makes the caller its owner either way. */
export async function claimBot(
    raw: string,
    ownerId: number
): Promise<CloneResult> {
    if (!WEBHOOK_HOST) {
        return { ok: false, error: "Cloning is not set up on this instance." };
    }

    const info = await describeBot(raw);
    if (!info.ok) return info;

    const token = botTokenSchema.parse(raw);
    const alreadyRunning = bots.has(token);

    if (!alreadyRunning) {
        const bot = botCreator(token);
        try {
            await bot.api.setWebhook(`${WEBHOOK_HOST}/bot${token}`, {
                drop_pending_updates: true
            });
        } catch (error: any) {
            bots.delete(token);
            const why = error.description ?? error.message ?? "unknown error";
            logger.warn(`Webhook failed for bot ${info.bot.id}: ${why}`);
            return { ok: false, error: `Telegram refused the webhook: ${why}` };
        }
    }

    await db.setOwner(info.bot.id, ownerId);
    return { ok: true, bot: info.bot, alreadyRunning };
}
