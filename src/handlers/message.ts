import { AlbumBuffer, isAlbumPart } from "../albums";

import type { Api } from "grammy";
import { BotContext } from "../bot";
import type { Message } from "grammy/types";
import { backfillBotNameFlags } from "../legacy";
import db from "../store";
import { fanOut } from "../forward";
import logger from "../modules/logger";

async function dispatch(api: Api, botId: number, parts: Message[]) {
    const sourceChatId = parts[0].chat.id;
    const routes = await db.getRoutes(botId, sourceChatId);
    if (!routes.length) {
        // Distinguishes "no route" from "no update arrived" in the log.
        logger.debug(`No routes for ${sourceChatId}, ignoring`);
        return;
    }

    logger.info(
        `Incoming ${parts.length > 1 ? `album x${parts.length}` : "message"}: ` +
            `${sourceChatId}:${parts[0].message_id} -> ` +
            routes.map((r) => r.destChatId).join(",")
    );

    await fanOut(api, routes, sourceChatId, parts);
}

// Shared by every bot here; the buffer key includes the bot id.
const albums = new AlbumBuffer<Api>((botId, parts, api) => {
    dispatch(api, botId, parts).catch((err) =>
        logger.error(`Album dispatch failed: ${err.message}`)
    );
});

export default async function message_handler(ctx: BotContext) {
    const message = (ctx.message ?? ctx.channelPost) as Message | undefined;
    if (!message) return;

    backfillBotNameFlags(ctx.me.id, ctx.me.first_name);

    if (isAlbumPart(message)) {
        albums.add(ctx.me.id, message, ctx.api);
        return;
    }

    await dispatch(ctx.api, ctx.me.id, [message]);
}
