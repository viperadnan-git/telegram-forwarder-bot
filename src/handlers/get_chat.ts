import { type BotContext, miniAppUrl } from "../bot";
import { escapeHtml, formatObject, resolveChat } from "../modules/utils";
import db from "../store";

export default async function get_chat_handler(ctx: BotContext) {
    const match = (ctx.match as string)?.trim();
    const url = miniAppUrl(ctx.me.id);
    const settings = url
        ? {
              reply_markup: {
                  inline_keyboard: [[{ text: "Settings", web_app: { url } }]]
              }
          }
        : undefined;

    if (!match) {
        const chatMap = await db.getAllChatMap(ctx.me.id);
        if (!Object.keys(chatMap).length) {
            await ctx.reply("Nothing forwarding yet. Send /set to add one.");
            return;
        }
        await ctx.reply(
            `<b>Sources and their destinations</b>\n\n${formatObject(chatMap)}`,
            settings
        );
        return;
    }

    const source = await resolveChat(ctx.api, match);
    if (!source.ok) {
        await ctx.reply(
            `Could not use <code>${escapeHtml(match)}</code>: ${source.error}`
        );
        return;
    }

    const destinations = (await db.getRoutes(ctx.me.id, source.chat.id)).map(
        (r) => r.destChatId
    );

    if (!destinations.length) {
        await ctx.reply(`No destinations for <code>${source.chat.id}</code>.`);
        return;
    }

    await ctx.reply(
        `<b>Source</b>\n<pre>${source.chat.id}</pre>\n\n` +
            `<b>Destinations</b>\n<pre>${destinations.join("\n")}</pre>`,
        settings
    );
}
