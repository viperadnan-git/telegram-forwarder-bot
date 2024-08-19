import { BotContext } from "../bot";
import db from "../database";
import { getEntity } from "../modules/utils";

export default async function set_owner_handler(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);

    if (owner && ctx.from?.id !== owner) {
        await ctx.reply("You are not the owner of this bot.");
        return;
    }

    if (ctx.match) {
        const entity = await getEntity(ctx, ctx.match as string);

        if (!entity) {
            await ctx.reply(
                "Invalid user ID. Make sure the user ID is correct and the user has started a conversation with me."
            );
            return;
        }

        if (!owner) {
            await db.setOwner(ctx.me.id, entity.id);
            await ctx.reply("Owner set.");
        } else {
            await db.setOwner(ctx.me.id, entity.id);
            await ctx.reply("Owner changed.");
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
