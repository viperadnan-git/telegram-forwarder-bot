import { BotContext } from "../bot";
import db from "../database";

export default async function set_chat_handler(ctx: BotContext) {
    const match = ctx.match as string;
    if (!match) {
        await ctx.reply(
            "Please specify a from chat id and to chat id.\n\nTo forward from 'from_chat_id to 'to_chat_id' chat\n<pre>/set (from chat_id) (to chat_id)</pre>"
        );
        return;
    }

    const botId = ctx.me.id;
    const [chatId, toChatId] = match.split(" ", 2).map(Number);

    if (!chatId || !toChatId) {
        await ctx.reply(
            "Could not get chat ids. Chat ids must be numbers.\nCorrect usage:\n<pre>/set (from chat_id) (to chat_id)</pre>"
        );
        return;
    }

    await db.setChatMap(botId, chatId, toChatId);

    await ctx.reply(`Chat set.\n<pre>${chatId} -> ${toChatId}</pre>`);
}
