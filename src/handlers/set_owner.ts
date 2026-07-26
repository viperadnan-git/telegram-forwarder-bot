import { BotContext } from "../bot";
import db from "../store";
import { resolveChat } from "../modules/utils";

export default async function set_owner_handler(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);

    if (owner && ctx.from?.id !== owner) {
        await ctx.reply("You are not the owner of this bot.");
        return;
    }

    if (ctx.match) {
        const resolved = await resolveChat(ctx.api, ctx.match as string);

        if (!resolved.ok) {
            await ctx.reply(
                `Could not find that user: ${resolved.error}\n` +
                    "They need to have started a conversation with me first."
            );
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
                "You are now the owner of this bot.\n\nTo change owner:\n<pre>/set_owner (user_id)</pre>"
            );
        }
    }
}
