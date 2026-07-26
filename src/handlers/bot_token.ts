import type { MessageEntity } from "grammy/types";
import type { BotContext } from "../bot";
import { claimBot } from "../clone";

function extractBotToken(msgText: string, entities: Array<MessageEntity>) {
    for (const entity of entities) {
        if (entity.type === "code") {
            return msgText.substring(
                entity.offset,
                entity.offset + entity.length
            );
        }
    }
}

export default async function bot_token_handler(ctx: BotContext) {
    const token = extractBotToken(
        ctx.message?.text ?? "",
        ctx.message?.entities ?? []
    );

    if (token === undefined) {
        await ctx.reply(
            "Invalid message from <a href='https://t.me/botfather'>BotFather</a>"
        );
        return;
    }

    const result = await claimBot(token, ctx.message?.from?.id as number);
    if (!result.ok) {
        await ctx.reply(result.error);
        return;
    }

    await ctx.reply(
        result.alreadyRunning
            ? "That bot is already running, and it is yours again."
            : "Done — that bot is yours. Send it /set to start forwarding."
    );
}
