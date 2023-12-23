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
        await ctx.reply(formatObject(chatMap));
    } else {
        const chatIds = await db.getChatMap(ctx.me.id, parseInt(match));
        if (!chatIds?.length) {
            await ctx.reply(
                `No chats configured for id (<code>${match}</code>).`
            );
            return;
        }
        await ctx.reply(formatObject({ [match]: chatIds ?? [] }));
    }
}
