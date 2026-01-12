import { BotContext } from "../bot";
import db from "../database";
import logger from "../modules/logger";
import { BOT_NAME_IGNORE_CAPTION_CHAR, BOT_NAME_PROTECT_CONTENT_CHAR } from "../constants";

export default async function message_handler(ctx: BotContext) {
    const message = ctx.message ?? ctx.channelPost;
    const fromChatId = message?.chat.id as number;
    const me = ctx.me;
    const chatIds = await db.getChatMap(me.id, fromChatId);

    if (!chatIds?.length) return;

    logger.info(
        `Incoming message: ${fromChatId}:${
            message?.message_id
        } -> ${chatIds.join(",")}`
    );

    const other = {
        reply_markup: message?.reply_markup,
        protect_content: me.first_name.includes(BOT_NAME_PROTECT_CONTENT_CHAR),
        ...(me.first_name.includes(BOT_NAME_IGNORE_CAPTION_CHAR)
            ? { caption: message?.caption ? "" : undefined }
            : {})
    };

    for (const chatId of chatIds) {
        try {
            await ctx.api.copyMessage(
                chatId,
                fromChatId,
                message?.message_id as number,
                other
            );
        } catch (error: any) {
            logger.warn(
                `Error when forwarding message (${
                    message?.message_id
                }) from ${fromChatId} to ${chatId}: ${
                    error.description || error.message
                }`
            );
        }
    }
}
