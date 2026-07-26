import { type BotContext, miniAppUrl } from "../bot";

export default async function start_handler(ctx: BotContext) {
    const settings = miniAppUrl(ctx.me.id);
    const help = miniAppUrl(ctx.me.id, "help");

    const buttons = [
        ...(settings
            ? [[{ text: "Settings", web_app: { url: settings } }]]
            : []),
        ...(help ? [[{ text: "How it works", web_app: { url: help } }]] : []),
        [{ text: "Make your own copy", url: "https://t.me/BotFather" }]
    ];

    await ctx.reply(
        "I copy new messages from one chat into another.\n\n" +
            "Send /set to pick the two chats.\n\n" +
            "Want your own copy of me? Create a bot with @BotFather and " +
            "forward me the message with its token.\n\n" +
            '<a href="https://t.me/vipercommunity">Support</a> · ' +
            '<a href="https://github.com/viperadnan-git/telegram-forwarder-bot">Source</a> · ' +
            '<a href="https://github.com/viperadnan-git/telegram-forwarder-bot/issues">Report a problem</a>',
        {
            link_preview_options: { is_disabled: true },
            reply_markup: { inline_keyboard: buttons }
        }
    );
}
