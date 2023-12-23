import { BotContext, WEBHOOK_HOST, botCreator, bots } from "../bot";

import { MessageEntity } from "grammy/types";
import db from "../database";
import logger from "../modules/logger";

function extractBotToken(msgText: string, entities: Array<MessageEntity>) {
    for (const entity_ in entities) {
        const entity = entities[Number(entity_)];
        if (entity.type == "code") {
            return msgText?.substring(
                entity.offset,
                entity.offset + entity.length
            );
        }
    }
}

export default async function bot_token_handler(ctx: BotContext) {
    if (!WEBHOOK_HOST) {
        await ctx.reply("I am a bot too!");
        return;
    }

    const entities = ctx.message?.entities || [];
    const msgText = ctx.message?.text || "";

    const bot_token = extractBotToken(msgText, entities);
    if (bot_token !== undefined) {
        let bot = bots.get(bot_token);
        if (!bot) {
            bot = botCreator(bot_token);
            try {
                await bot.api.setWebhook(WEBHOOK_HOST + "/bot" + bot_token, {
                    drop_pending_updates: true,
                });
                await db.setOwner(
                    parseInt(bot_token.split(":")[0]),
                    ctx.message?.from?.id as number
                );
                await ctx.reply(
                    "Bot cloned and you are the owner of the bot. Start using it!"
                );
            } catch (error: any) {
                logger.warn(`Error when setting webhook: ${error.message}`);
            }
        } else {
            await ctx.reply("Bot is already cloned");
        }
    } else {
        await ctx.reply(
            "Invalid message from <a href='https://t.me/botfather'>BotFather</a>"
        );
    }
}
