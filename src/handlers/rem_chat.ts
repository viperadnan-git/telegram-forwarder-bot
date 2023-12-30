import { BotContext } from "../bot";
import db from "../database";

export default async function rem_chat_handler(ctx: BotContext) {
    const match = ctx.match as string;
    if (!match) {
        await ctx.reply(
            "Please specify a from chat id and an optional to chat id.\n\nTo remove specific 'to' chat\n<pre>/rem (from chat_id) (to chat_id)</pre>\nTo remove all forwarding for a chat\n<pre>/rem (from chat_id)</pre>"
        );
        return;
    }

    const [chatId, toChatId] = match.split(" ", 2).map(Number);
    await db.remChatMap(ctx.me.id, chatId, toChatId);
    await ctx.reply(
        `Forwarding is disabled for new messages in chat.\n<pre>${chatId}${
            toChatId ? " -> " + toChatId : ""
        }</pre>`
    );
}
