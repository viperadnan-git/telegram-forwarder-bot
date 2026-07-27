import type { BotContext } from "../bot";
import { escapeHtml, resolveChat } from "../lib/utils";
import db from "../store";

export default async function rem_chat_handler(ctx: BotContext) {
    const match = (ctx.match as string)?.trim();
    if (!match) {
        await ctx.reply(
            "<pre>/rem (source) (destination)</pre>removes one destination.\n" +
                "<pre>/rem (source)</pre>removes all of them."
        );
        return;
    }

    const [sourceInput, destInput] = match.split(/\s+/, 2);

    const source = await resolveChat(ctx.api, sourceInput);
    if (!source.ok) {
        await ctx.reply(
            `Could not use <code>${escapeHtml(sourceInput)}</code>: ${source.error}`
        );
        return;
    }

    let destChatId: number | undefined;
    if (destInput) {
        const dest = await resolveChat(ctx.api, destInput);
        if (!dest.ok) {
            await ctx.reply(
                `Could not use <code>${escapeHtml(destInput)}</code>: ${dest.error}`
            );
            return;
        }
        destChatId = dest.chat.id;
    }

    await db.remChatMap(ctx.me.id, source.chat.id, destChatId);
    await ctx.reply(
        `Forwarding stopped.\n<pre>${source.chat.id}${
            destChatId ? ` -> ${destChatId}` : " (all destinations)"
        }</pre>`
    );
}
