import type { BotContext } from "../bot";
import { cancelPicker } from "./pick";

export default async function cancel_handler(ctx: BotContext) {
    const cancelled = cancelPicker(ctx.me.id, ctx.from?.id ?? 0);

    // Clear the keyboard either way: it outlives the flow if a tap was missed.
    await ctx.reply(cancelled ? "Cancelled." : "Nothing to cancel.", {
        reply_markup: { remove_keyboard: true }
    });
}
