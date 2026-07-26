import { type BotContext, miniAppUrl } from "../bot";
import { ownership } from "./owner_only";

export default async function settings_handler(ctx: BotContext) {
    const { isOwner, unclaimed } = await ownership(ctx);

    // A button labelled Settings that opens a refusal is worse than no button.
    const url = miniAppUrl(ctx.me.id, isOwner ? "settings" : "help");

    if (!url) {
        await ctx.reply(
            "Settings needs WEBHOOK_HOST to be set on this instance."
        );
        return;
    }

    let body: string;
    if (isOwner) {
        body =
            "Add a forward, or open one to change its filters, mode and captions.";
    } else if (unclaimed) {
        body = "Nobody owns me yet. Send /set_owner to claim me.";
    } else {
        body =
            "This bot belongs to someone else, so there is nothing here for you " +
            "to change.";
    }

    await ctx.reply(body, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: isOwner ? "Settings" : "How it works",
                        web_app: { url }
                    }
                ]
            ]
        }
    });
}
