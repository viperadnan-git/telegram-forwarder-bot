import type { BotContext } from "../bot";
import { resolveChat } from "../modules/utils";
import db from "../store";

export default async function rem_chat_handler(ctx: BotContext) {
    const match = (ctx.match as string)?.trim();
    if (!match) {
        await ctx.reply(
            "Send the source chat, and optionally one destination.\n" +
                "<pre>/rem (source) (destination)</pre>\n" +
                "To remove every destination for a source:\n" +
                "<pre>/rem (source)</pre>\n" +
                "Each can be a chat id, an @username, or a t.me link."
        );
        return;
    }

    const [sourceInput, destInput] = match.split(/\s+/, 2);

    const source = await resolveChat(ctx.api, sourceInput);
    if (!source.ok) {
        await ctx.reply(
            `Could not use <code>${sourceInput}</code>: ${source.error}`
        );
        return;
    }

    let destChatId: number | undefined;
    if (destInput) {
        const dest = await resolveChat(ctx.api, destInput);
        if (!dest.ok) {
            await ctx.reply(
                `Could not use <code>${destInput}</code>: ${dest.error}`
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
