import { BotContext } from "../bot";
import db from "../database";
import logger from "../modules/logger";

export default async function message_handler(ctx: BotContext) {
    const message = ctx.message ?? ctx.channelPost;
    const fromChatId = message?.chat.id as number;
    const chatIds = await db.getChatMap(ctx.me.id, fromChatId);

    if (!chatIds?.length) return;

    logger.info(
        `Incoming message: ${fromChatId}:${
            message?.message_id
        } -> ${chatIds.join(",")}`
    );

    for (const chatId of chatIds) {
        try {
            await ctx.api.copyMessage(
                chatId,
                fromChatId,
                message?.message_id as number
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
