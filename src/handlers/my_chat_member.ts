import type { Chat, ChatMemberUpdated } from "grammy/types";
import type { BotContext } from "../bot";
import logger from "../lib/logger";
import type { RouteStatus } from "../schema";
import db from "../store";

/**
 * Telegram reports the bot's own membership changing, so a removal stops the
 * routes at once instead of on the next failed delivery. Private chats report
 * only block and unblock.
 */

// Losing the right to send breaks a destination but not a source: the bot can
// still read. Losing membership breaks both.
type Scope = "any" | "destination";

function stopFor(
    chat: Chat,
    member: ChatMemberUpdated["new_chat_member"]
): { status: RouteStatus; scope: Scope } | undefined {
    if (member.status === "kicked") {
        return {
            status: chat.type === "private" ? "blocked" : "removed",
            scope: "any"
        };
    }
    if (member.status === "left") return { status: "removed", scope: "any" };

    if (member.status === "restricted" && !member.can_send_messages) {
        return { status: "no_rights", scope: "destination" };
    }
    // A demoted bot sees no channel posts and can send none either.
    if (chat.type === "channel" && member.status !== "administrator") {
        return { status: "not_admin", scope: "any" };
    }
    return undefined;
}

export default async function my_chat_member_handler(ctx: BotContext) {
    const update = ctx.myChatMember;
    if (!update) return;

    const stop = stopFor(update.chat, update.new_chat_member);
    if (!stop) return;

    const count = await db.stopRoutesForChat(
        ctx.me.id,
        update.chat.id,
        stop.status,
        stop.scope
    );
    if (count) {
        logger.info(
            `Chat ${update.chat.id} is now ${update.new_chat_member.status}: ` +
                `${count} route(s) stopped as ${stop.status}`
        );
    }
}
