import { BotContext } from "../bot";
import { ChatFromGetChat } from "grammy/types";
import db from "../database";

export default async function set_owner_handler(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);

    if (owner && ctx.from?.id !== owner) {
        await ctx.reply("You are not the owner of this bot.");
        return;
    }

    if (ctx.match) {
        let user: ChatFromGetChat;

        const entity = Number(ctx.match);

        if (!entity) {
            await ctx.reply(
                "Invalid user ID or user. I only accept a user id."
            );
            return;
        }

        try {
            user = await ctx.api.getChat(entity);
            if (!owner) {
                await db.setOwner(ctx.me.id, user.id);
                await ctx.reply("Owner set.");
            } else {
                await db.setOwner(ctx.me.id, user.id);
                await ctx.reply("Owner changed.");
            }
        } catch (error: any) {
            if (error.error_code === 400) {
                await ctx.reply(
                    "Invalid user ID or user. Make sure the user has started a conversation with me."
                );
                return;
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
