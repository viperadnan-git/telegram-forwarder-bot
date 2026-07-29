import type { BotContext } from "../bot";
import { chatTitle, escapeHtml, resolveChat } from "../lib/utils";
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
                "Or send /set on its own to pick them from a list."
        );
        return;
    }

    const source = await resolveChat(ctx.api, from);
    if (!source.ok) {
        await ctx.reply(
            `Could not use <code>${escapeHtml(from)}</code>: ${source.error}`
        );
        return;
    }

    const dest = await resolveChat(ctx.api, to);
    if (!dest.ok) {
        await ctx.reply(
            `Could not use <code>${escapeHtml(to)}</code>: ${dest.error}`
        );
        return;
    }

    if (source.chat.id === dest.chat.id) {
        await ctx.reply("A chat cannot forward to itself.");
        return;
    }

    // Both chats first: the route FKs to them, and nothing creates them now.
    for (const c of [source.chat, dest.chat]) {
        await db.saveChat({
            chatId: c.id,
            title: chatTitle(c),
            username: c.username,
            type: c.type
        });
    }
    await db.setChatMap(ctx.me.id, source.chat.id, dest.chat.id);

    await ctx.reply(
        `Forwarding <b>${escapeHtml(source.chat.title ?? String(source.chat.id))}</b> → ` +
            `<b>${escapeHtml(dest.chat.title ?? String(dest.chat.id))}</b>.`
    );
}
