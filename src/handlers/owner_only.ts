import { BotContext } from "../bot";
import db from "../database";

export default async function owner_only(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);
    if (ctx.from?.id !== owner) {
        ctx.reply("You are not the owner of this bot.");
        return false;
    }
    return true;
}
