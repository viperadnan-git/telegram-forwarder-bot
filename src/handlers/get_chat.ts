import { BotContext } from "../bot";
import db from "../database";
import { formatObject } from "../modules/utils";

export default async function get_chat_handler(ctx: BotContext) {
    const match = ctx.match as string;
    if (!match) {
        const chatMap = await db.getAllChatMap(ctx.me.id);
        if (!Object.keys(chatMap).length) {
            await ctx.reply(`No chats configured for forwarding.`);
            return;
        }
        await ctx.reply(`<b>Chats configured for forwarding</b>\n\n${formatObject(chatMap)}`);
    } else {
        const chatIds = await db.getChatMap(ctx.me.id, parseInt(match));
        if (!chatIds?.length) {
            await ctx.reply(
                `No chats configured for id (<code>${match}</code>).`
            );
            return;
        }
        await ctx.reply(`Chats configured for id (<code>${match}</code>):\n\n<b>From</b>\n<pre>${match}</pre>\n\n<b>To</b>\n<pre>${chatIds.join("\n")}</pre>`);
    }
}
