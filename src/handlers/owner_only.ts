import type { BotContext } from "../bot";
import db from "../store";

/** Unclaimed and someone-else's are different situations, and read differently. */
export async function ownership(ctx: BotContext) {
    const owner = await db.getOwner(ctx.me.id);
    return {
        isOwner: owner !== undefined && owner === ctx.from?.id,
        unclaimed: owner === undefined
    };
}

export default async function owner_only(ctx: BotContext) {
    const { isOwner, unclaimed } = await ownership(ctx);
    if (!isOwner) {
        ctx.reply(
            unclaimed
                ? "Nobody owns me yet. Send /set_owner to claim me."
                : "You are not the owner of this bot."
        );
        return false;
    }
    return true;
}
