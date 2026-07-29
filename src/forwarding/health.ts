import type { Api } from "grammy";
import { GrammyError } from "grammy";
import type { ChatFullInfo } from "grammy/types";
import logger from "../lib/logger";
import type { CheckFailure, RouteStatus } from "../schema";
import db from "../store";

// error_code is too coarse to act on — 400 covers both "chat not found" and
// "message text is empty" — so these rules match on description only.

export type Verdict =
    | { kind: "permanent"; status: RouteStatus }
    | { kind: "migrate"; toChatId: number }
    | { kind: "transient" };

// One message failed, not the route. Checked first, or "not enough rights to
// send photos" would match the text-rights rule below.
const CONTENT = [
    /not enough rights to send (photos|videos|video notes|documents|audios|voice messages|stickers|animations|games|polls|dice)/i,
    /message (text is empty|is too long)/i,
    /entities too long/i,
    /(wrong file identifier|invalid file id|file is too big)/i,
    /failed to get HTTP URL content/i,
    /message to (copy|forward) not found/i,
    /MESSAGE_ID_INVALID/i,
    /reply message not found/i
];

const PERMANENT: { test: RegExp; status: RouteStatus }[] = [
    // Not in the chat.
    { test: /bot was kicked from/i, status: "removed" },
    {
        test: /bot is not a member of/i,
        status: "removed"
    },
    { test: /bot was blocked by the user/i, status: "blocked" },
    {
        test: /bot can't initiate conversation with a user/i,
        status: "never_messaged"
    },
    {
        test: /bot can't send messages to bots/i,
        status: "is_bot"
    },
    { test: /user is deactivated/i, status: "deactivated" },
    {
        test: /chat not found/i,
        status: "gone"
    },
    { test: /PEER_ID_INVALID/i, status: "gone" },
    {
        test: /group (chat was deactivated|is deactivated)/i,
        status: "gone"
    },
    // Present, but cannot post.
    {
        test: /CHAT_WRITE_FORBIDDEN/i,
        status: "no_rights"
    },
    {
        test: /have no rights to send a message/i,
        status: "no_rights"
    },
    {
        test: /not enough rights to send text messages/i,
        status: "no_rights"
    },
    {
        test: /need administrator rights/i,
        status: "not_admin"
    },
    {
        test: /CHAT_ADMIN_REQUIRED/i,
        status: "not_admin"
    }
];

export function classify(err: unknown): Verdict {
    // Telegram never answered, so it said nothing about the chat.
    if (!(err instanceof GrammyError)) return { kind: "transient" };

    const text = err.description;

    // The new id is what makes this actionable, not the wording.
    const migrateTo = err.parameters?.migrate_to_chat_id;
    if (migrateTo) return { kind: "migrate", toChatId: migrateTo };

    if (CONTENT.some((re) => re.test(text))) return { kind: "transient" };

    for (const rule of PERMANENT) {
        if (rule.test.test(text)) {
            return { kind: "permanent", status: rule.status };
        }
    }

    // Telegram rewords errors; logging twice beats stopping a working route.
    return { kind: "transient" };
}

export type Role = "source" | "destination";
// The chat travels back: the caller needs it to store, and getChat is paid for.
export type Check =
    | { ok: true; chat: ChatFullInfo }
    | { ok: false; reason: CheckFailure };

// A transient failure says nothing about the chat.
const why = (err: unknown): CheckFailure => {
    const verdict = classify(err);
    return verdict.kind === "permanent" ? verdict.status : "unavailable";
};

/**
 * The one gate for adding a route and resuming one. getChat proves a chat is
 * readable, not postable, and the picker's filters are client-side.
 */
export async function checkChat(
    api: Api,
    botId: number,
    chat: ChatFullInfo,
    role: Role
): Promise<Check> {
    // Untestable without messaging them; delivery reports the truth.
    if (chat.type === "private") return { ok: true, chat };

    let member: Awaited<ReturnType<Api["getChatMember"]>>;
    try {
        member = await api.getChatMember(chat.id, botId);
    } catch (err) {
        return { ok: false, reason: why(err) };
    }

    if (member.status === "left" || member.status === "kicked") {
        return { ok: false, reason: "removed" };
    }
    if (member.status === "restricted" && !member.can_send_messages) {
        return { ok: false, reason: "no_rights" };
    }

    if (chat.type === "channel") {
        // A non-admin bot neither sees channel posts nor sends any.
        if (member.status !== "administrator") {
            return { ok: false, reason: "not_admin" };
        }
        if (role === "destination" && !member.can_post_messages) {
            return { ok: false, reason: "no_rights" };
        }
    }

    return { ok: true, chat };
}

export async function checkChatId(
    api: Api,
    botId: number,
    chatId: number,
    role: Role,
    // Telegram hands back one new id, so a second migrate is a loop, not a hop.
    followMigration = true
): Promise<Check> {
    let chat: ChatFullInfo;
    try {
        chat = await api.getChat(chatId);
    } catch (err) {
        const verdict = classify(err);
        // No message in flight to retry, unlike the send path.
        if (verdict.kind === "migrate" && followMigration) {
            logger.info(`Chat ${chatId} migrated to ${verdict.toChatId}`);
            await db.migrateChat(chatId, verdict.toChatId);
            return checkChatId(api, botId, verdict.toChatId, role, false);
        }
        return { ok: false, reason: why(err) };
    }
    return checkChat(api, botId, chat, role);
}
