import type { Message } from "grammy/types";
import {
    MEDIA_KINDS,
    type MediaKind,
    type RouteConfig,
    type Rule
} from "../config";
import { test as regexTest } from "./regex";

/** The message's content type, used by media rules. */
export function mediaKind(msg: Message): MediaKind {
    for (const kind of MEDIA_KINDS) {
        if (kind !== "text" && kind in msg) return kind;
    }
    return "text";
}

const messageText = (msg: Message): string => msg.text ?? msg.caption ?? "";

/** Attachment file name, for rules targeting names and extensions. */
const messageFileName = (msg: Message): string =>
    msg.document?.file_name ??
    msg.video?.file_name ??
    msg.audio?.file_name ??
    msg.animation?.file_name ??
    "";

const haystack = (msg: Message, target: "text" | "filename") =>
    target === "filename" ? messageFileName(msg) : messageText(msg);

/** Every identity a sender rule can match: author, on-behalf-of chat, origin. */
function senderIdentities(msg: Message) {
    const ids: number[] = [];
    const usernames: string[] = [];

    const add = (id?: number, username?: string) => {
        if (id !== undefined) ids.push(id);
        if (username) usernames.push(username.toLowerCase());
    };

    add(msg.from?.id, msg.from?.username);
    add(msg.sender_chat?.id, msg.sender_chat?.username);

    const origin = msg.forward_origin;
    if (origin?.type === "user") {
        add(origin.sender_user.id, origin.sender_user.username);
    } else if (origin?.type === "chat") {
        add(origin.sender_chat.id, origin.sender_chat.username);
    } else if (origin?.type === "channel") {
        add(origin.chat.id, origin.chat.username);
    }

    return { ids, usernames };
}

export function matches(rule: Rule, msg: Message): boolean {
    switch (rule.type) {
        case "keyword": {
            const text = haystack(msg, rule.target);
            if (!text) return false;
            return rule.caseSensitive
                ? text.includes(rule.value)
                : text.toLowerCase().includes(rule.value.toLowerCase());
        }
        case "regex": {
            const text = haystack(msg, rule.target);
            return text ? regexTest(rule.pattern, text) : false;
        }
        case "media":
            return rule.kinds.includes(mediaKind(msg));
        case "sender": {
            const { ids, usernames } = senderIdentities(msg);
            return (
                rule.ids.some((id) => ids.includes(id)) ||
                rule.usernames.some((name) =>
                    usernames.includes(name.replace(/^@/, "").toLowerCase())
                )
            );
        }
    }
}

/** Deny wins; an empty config forwards everything. */
export function passes(config: RouteConfig, msg: Message): boolean {
    const { whitelist, blacklist } = config.filters;

    if (blacklist.some((rule) => matches(rule, msg))) return false;
    if (whitelist.length === 0) return true;
    return whitelist.some((rule) => matches(rule, msg));
}
