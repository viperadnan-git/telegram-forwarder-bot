import type { BotContext } from "../bot";
import { resolveUser } from "../modules/utils";
import db from "../store";

export default async function set_owner_handler(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);

    if (owner && ctx.from?.id !== owner) {
        await ctx.reply("You are not the owner of this bot.");
        return;
    }

    if (ctx.match) {
        const resolved = await resolveUser(ctx.api, ctx.match as string);

        if (!resolved.ok) {
            await ctx.reply(resolved.error);
            return;
        }

        await db.setOwner(ctx.me.id, resolved.chat.id);
        await ctx.reply(owner ? "Owner changed." : "Owner set.");
    } else {
        if (owner) {
            await ctx.reply(
                `Owner is: <code>${owner}</code>\n\nTo change owner:\n<pre>/set_owner (user_id)</pre>`
            );
        } else {
            await db.setOwner(ctx.me.id, ctx.from?.id as number);
            await ctx.reply(
                "You own this bot now. Hand it over with /set_owner (user_id)."
            );
        }
    }
}
