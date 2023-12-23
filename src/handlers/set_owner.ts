import { BotContext } from "../bot";
import db from "../database";

export default async function set_owner_handler(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);
    if (ctx.match) {
        if (!owner) {
            await db.setOwner(ctx.me.id, Number(ctx.match));
            await ctx.reply("Owner set.");
        } else {
            if (ctx.from?.id === owner) {
                await db.setOwner(ctx.me.id, Number(ctx.match));
                await ctx.reply("Owner changed.");
            } else {
                await ctx.reply("You are not the owner of this bot.");
            }
        }
    } else {
        if (owner) {
            await ctx.reply(
                `Owner is: <code>${owner}</code>\n\nTo change owner:\n<pre>/set_owner (user_id)</pre>`
            );
        } else {
            await db.setOwner(ctx.me.id, ctx.from?.id as number);
            await ctx.reply(
                "You are now the owner of this bot.\n\nTo change owner:\n<pre>/set_owner (user_id)</pre>"
            );
        }
    }
}
