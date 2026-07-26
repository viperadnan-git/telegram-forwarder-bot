import type { BotContext } from "../bot";
import { resolveChat } from "../modules/utils";
import db from "../store";
import { startPicker } from "./pick";

export default async function set_chat_handler(ctx: BotContext) {
    const match = (ctx.match as string)?.trim();

    // No arguments: use the native chat picker.
    if (!match) {
        await startPicker(ctx);
        return;
    }

    const [from, to] = match.split(/\s+/, 2);

    if (!from || !to) {
        await ctx.reply(
            "Two chats are needed.\n<pre>/set (source) (destination)</pre>\n" +
                "Each can be a chat id, an @username, or a t.me link.\n\n" +
                "Or send /set on its own to pick them from a list."
        );
        return;
    }

    const source = await resolveChat(ctx.api, from);
    if (!source.ok) {
        await ctx.reply(`Could not use <code>${from}</code>: ${source.error}`);
        return;
    }

    const dest = await resolveChat(ctx.api, to);
    if (!dest.ok) {
        await ctx.reply(`Could not use <code>${to}</code>: ${dest.error}`);
        return;
    }

    await db.setChatMap(ctx.me.id, source.chat.id, dest.chat.id);
    for (const c of [source.chat, dest.chat]) {
        await db.saveChat({
            chatId: c.id,
            title: "title" in c ? c.title : undefined,
            username: "username" in c ? c.username : undefined,
            type: c.type
        });
    }

    await ctx.reply(
        `Forwarding new messages.\n<pre>${source.chat.id} -> ${dest.chat.id}</pre>`
    );
}
