import { type BotContext, miniAppUrl } from "../bot";

export default async function help_handler(ctx: BotContext) {
    const help = miniAppUrl(ctx.me.id, "help");
    const settings = miniAppUrl(ctx.me.id);

    if (!help) {
        // No WEBHOOK_HOST, so the Mini App cannot open; keep the essentials.
        await ctx.reply(
            "<b>Commands</b>\n" +
                "<pre>/set                     pick two chats\n" +
                "/set (source) (dest)     add without the picker\n" +
                "/rem (source) (dest)     remove a destination\n" +
                "/get                     list everything\n" +
                "/set_owner (user_id)     hand over the bot</pre>\n" +
                "A chat can be an id, an @username or a t.me link."
        );
        return;
    }

    await ctx.reply(
        "Send /set to pick a source and a destination.\n\n" +
            "Filters, forward mode and caption rules are per destination, in Settings.",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "How it works", web_app: { url: help } }],
                    [{ text: "Settings", web_app: { url: settings! } }]
                ]
            }
        }
    );
}
