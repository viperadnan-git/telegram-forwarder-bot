import type {
    ChatAdministratorRights,
    ReplyKeyboardMarkup
} from "grammy/types";
import { type BotContext, miniAppUrl } from "../bot";
import logger from "../modules/logger";
import { escapeHtml } from "../modules/utils";
import db from "../store";

/**
 * Native chat picker: a `request_chat` reply-keyboard button returns a
 * `chat_shared` service message carrying the id.
 *
 * ponytail: pending source kept in process. On serverless the two taps can
 * land in different invocations; move it to a draft row if that matters.
 */

const REQUEST = {
    SOURCE_CHANNEL: 1,
    SOURCE_GROUP: 2,
    DEST_CHANNEL: 3,
    DEST_GROUP: 4
} as const;

const PENDING_TTL_MS = 10 * 60 * 1000;

// chatId is null between /set and the first pick, so /cancel can see the flow.
type Pending = { chatId: number | null; name: string; at: number };
const pending = new Map<string, Pending>();

const key = (botId: number, userId: number) => `${botId}:${userId}`;

function takePending(botId: number, userId: number): Pending | undefined {
    const k = key(botId, userId);
    const entry = pending.get(k);
    if (!entry) return;
    if (Date.now() - entry.at > PENDING_TTL_MS) {
        pending.delete(k);
        return;
    }
    return entry;
}

/**
 * `bot_is_member` is ignored for channels: requestPeerTypeBroadcast has no
 * `bot_participant` field, only requestPeerTypeChat does. Admin rights are the
 * working filter there, and a bot must be an admin to see channel posts anyway.
 */
const adminRights = (
    extra: Partial<ChatAdministratorRights> = {}
): ChatAdministratorRights => ({
    is_anonymous: false,
    // All-false is rejected with ADMIN_RIGHTS_EMPTY. can_manage_chat is implied
    // by any other privilege, so it means "is an admin" without demanding one.
    can_manage_chat: true,
    can_delete_messages: false,
    can_manage_video_chats: false,
    can_restrict_members: false,
    can_promote_members: false,
    can_change_info: false,
    can_invite_users: false,
    can_post_stories: false,
    can_edit_stories: false,
    can_delete_stories: false,
    ...extra
});

function keyboard(
    channelId: number,
    groupId: number,
    step: "source" | "destination"
): ReplyKeyboardMarkup {
    const labels = {
        request_title: true,
        request_username: true
    };

    const channelRights = adminRights(
        step === "destination" ? { can_post_messages: true } : {}
    );

    return {
        keyboard: [
            [
                {
                    text: "Channel",
                    request_chat: {
                        request_id: channelId,
                        chat_is_channel: true,
                        bot_administrator_rights: channelRights,
                        // Required alongside bot rights, and must be a superset,
                        // or Telegram returns USER_RIGHTS_MISSING.
                        user_administrator_rights: channelRights,
                        ...labels
                    }
                },
                {
                    text: "Group",
                    request_chat: {
                        request_id: groupId,
                        chat_is_channel: false,
                        bot_is_member: true,
                        ...labels
                    }
                }
            ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
        input_field_placeholder: "Pick a chat above"
    };
}

export const sourceKeyboard = () =>
    keyboard(REQUEST.SOURCE_CHANNEL, REQUEST.SOURCE_GROUP, "source");

const destinationKeyboard = () =>
    keyboard(REQUEST.DEST_CHANNEL, REQUEST.DEST_GROUP, "destination");

/** Drops a half-finished pick. Returns false if there was nothing to drop. */
export function cancelPicker(botId: number, userId: number): boolean {
    return pending.delete(key(botId, userId));
}

/** Nothing else sweeps the map, and an abandoned /set never comes back. */
function dropExpired() {
    const cutoff = Date.now() - PENDING_TTL_MS;
    for (const [k, entry] of pending) {
        if (entry.at < cutoff) pending.delete(k);
    }
}

export async function startPicker(ctx: BotContext) {
    dropExpired();
    pending.set(key(ctx.me.id, ctx.from?.id ?? 0), {
        chatId: null,
        name: "",
        at: Date.now()
    });
    await ctx.reply(
        "<b>Step 1 of 2</b> — the chat to forward <b>from</b>.\n\n" +
            "<i>Channels need both of us to be administrators. Groups just need me in " +
            "them. /cancel to stop.</i>",
        { reply_markup: sourceKeyboard() }
    );
}

/** Picker filters are client-side only, so confirm the bot can reach the chat. */
async function reachable(ctx: BotContext, chatId: number) {
    try {
        await ctx.api.getChat(chatId);
        return true;
    } catch (err: any) {
        logger.info(
            `Picked chat ${chatId} is unreachable: ${err.description ?? err.message}`
        );
        return false;
    }
}

export default async function chat_shared_handler(ctx: BotContext) {
    const shared = ctx.msg?.chat_shared;
    const userId = ctx.from?.id;
    if (!shared || !userId) return;

    const name = shared.title ?? shared.username ?? String(shared.chat_id);

    if (!(await reachable(ctx, shared.chat_id))) {
        await ctx.reply(
            `I cannot reach <b>${escapeHtml(name)}</b>. Add me there first ` +
                "— as an administrator, if it is a channel — then send /set again.",
            { reply_markup: { remove_keyboard: true } }
        );
        return;
    }

    await db
        .saveChat({
            chatId: shared.chat_id,
            title: shared.title,
            username: shared.username
        })
        .catch((err) =>
            logger.warn(`Could not save chat name: ${err.message}`)
        );

    const isSource =
        shared.request_id === REQUEST.SOURCE_CHANNEL ||
        shared.request_id === REQUEST.SOURCE_GROUP;

    if (isSource) {
        pending.set(key(ctx.me.id, userId), {
            chatId: shared.chat_id,
            name,
            at: Date.now()
        });
        await ctx.reply(
            `Source: <b>${escapeHtml(name)}</b>\n\n` +
                "<b>Step 2 of 2</b> — choose the chat to forward <b>to</b>.",
            { reply_markup: destinationKeyboard() }
        );
        return;
    }

    const source = takePending(ctx.me.id, userId);
    if (!source || source.chatId === null) {
        await ctx.reply("That took too long. Send /set to start again.", {
            reply_markup: { remove_keyboard: true }
        });
        return;
    }
    pending.delete(key(ctx.me.id, userId));

    if (source.chatId === shared.chat_id) {
        await ctx.reply(
            "A chat cannot forward to itself. Send /set to start again.",
            { reply_markup: { remove_keyboard: true } }
        );
        return;
    }

    await db.setChatMap(ctx.me.id, source.chatId, shared.chat_id);

    // reply_markup holds one value, so this carries either the Settings button
    // or the removal; the picker keyboard is one_time_keyboard regardless.
    const url = miniAppUrl(ctx.me.id);
    await ctx.reply(
        `Forwarding <b>${escapeHtml(source.name)}</b> → ` +
            `<b>${escapeHtml(name)}</b>.\n\n` +
            "Filters and caption rules are in Settings.",
        {
            reply_markup: url
                ? {
                      inline_keyboard: [
                          [{ text: "Open settings", web_app: { url } }]
                      ]
                  }
                : { remove_keyboard: true }
        }
    );
}
