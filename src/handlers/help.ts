import { type BotContext, miniAppUrl } from "../bot";
import { ownership } from "./owner_only";

export default async function help_handler(ctx: BotContext) {
    const { isOwner, unclaimed } = await ownership(ctx);

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
                "/cancel                  stop a half-finished /set\n" +
                "/set_owner (user_id)     hand over the bot</pre>\n" +
                "A chat can be an id, an @username or a t.me link.\n" +
                "Only the owner can use /set, /get and /rem."
        );
        return;
    }

    let body: string;
    if (isOwner) {
        body =
            "Send /set to pick a chat to forward from, and one to forward to.\n\n" +
            "Filters, forward mode and caption rules are set per destination, " +
            "in Settings.";
    } else if (unclaimed) {
        body =
            "I copy new messages from one chat into another.\n\n" +
            "Nobody owns me yet. Send /set_owner to claim me, then /set to pick " +
            "the two chats.";
    } else {
        body =
            "I copy new messages from one chat into another.\n\n" +
            "This one belongs to someone else, so its forwarding is not yours to " +
            "change. To run your own clone, create a bot with @BotFather and " +
            "forward me the message with its token.";
    }

    await ctx.reply(body, {
        reply_markup: {
            inline_keyboard: [
                ...(isOwner
                    ? [[{ text: "Settings", web_app: { url: settings! } }]]
                    : []),
                [{ text: "How it works", web_app: { url: help } }]
            ]
        }
    });
}
