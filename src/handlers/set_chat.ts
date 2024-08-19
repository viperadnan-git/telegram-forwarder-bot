import { BotContext } from "../bot";
import db from "../database";
import { getEntity } from "../modules/utils";

export default async function set_chat_handler(ctx: BotContext) {
    const match = ctx.match as string;
    if (!match) {
        await ctx.reply(
            "Please specify a from chat id and to chat id.\n\nTo forward from 'from_chat_id to 'to_chat_id' chat\n<pre>/set (from chat_id) (to chat_id)</pre>"
        );
        return;
    }

    const botId = ctx.me.id;
    const [chatId, toChatId] = match.split(" ", 2);

    if (!chatId || !toChatId) {
        await ctx.reply(
            "Could not get chat IDs. Chat IDs must be numbers.\nCorrect usage:\n<pre>/set (from chat_id) (to chat_id)</pre>"
        );
        return;
    }

    const chadIdEntity = await getEntity(ctx, chatId);

    if (!chadIdEntity) {
        await ctx.reply(
            `Could not get chat entity for chat ID: <code>${chatId}</code>\nMake sure the chat ID is correct and I am in the chat with read access.`
        );
        return;
    }

    const toChatIdEntity = await getEntity(ctx, toChatId);

    if (!toChatIdEntity) {
        await ctx.reply(
            `Could not get chat entity for chat ID: <code>${toChatId}</code>\nMake sure the chat ID is correct and I am in the chat with read access.`
        );
        return;
    }

    await db.setChatMap(botId, chadIdEntity.id, toChatIdEntity.id);

    await ctx.reply(
        `Forwarding is enabled for new messages in chat.\n<pre>${chadIdEntity.id} -> ${toChatIdEntity.id}</pre>`
    );
}
