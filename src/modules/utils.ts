import type { Api } from "grammy";
import type { ChatFullInfo } from "grammy/types";
import { parseChatRef } from "../chatref";

/** Renders a source and its destinations as a tree, for /get. */
export const formatObject = (obj: {
    [key: string]: number[] | undefined;
}): string =>
    Object.entries(obj)
        .map(([key, values]) => {
            // undefined renders a blank line; an empty array renders nothing.
            if (values === undefined) return `(${key})\n\n`;
            const lines = values.map(
                (value, i) =>
                    `${i === values.length - 1 ? "└─" : "├─"}(${value})\n`
            );
            return `(${key})\n${lines.join("")}`;
        })
        .join("");

/**
 * parseMode is HTML for every reply, so anything a user or a chat title
 * supplies has to be escaped or Telegram rejects the whole message.
 */
export const escapeHtml = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type ResolveResult =
    | { ok: true; chat: ChatFullInfo }
    | { ok: false; error: string };

/**
 * getChat resolves a @username only for public chats, never for a person, so
 * an owner can only ever be given as a numeric id.
 */
export async function resolveUser(
    api: Api,
    input: string
): Promise<ResolveResult> {
    const id = Number(input.trim());
    if (!Number.isSafeInteger(id) || id <= 0) {
        return {
            ok: false,
            error: "Telegram only finds people by numeric id, not by @username"
        };
    }

    try {
        const chat = await api.getChat(id);
        if (chat.type !== "private") {
            return { ok: false, error: "That id is a chat, not a person" };
        }
        return { ok: true, chat };
    } catch (error: any) {
        const description: string = error.description ?? error.message ?? "";
        if (/not found/i.test(description)) {
            return {
                ok: false,
                error: "Nobody with that id has messaged me yet"
            };
        }
        return { ok: false, error: description || "Could not read that id" };
    }
}

/** Resolves an id, @username or t.me link. Shared by the commands and the API. */
export async function resolveChat(
    api: Api,
    input: string
): Promise<ResolveResult> {
    const parsed = parseChatRef(input);
    if (!parsed.ok) return parsed;

    const target =
        parsed.ref.kind === "id" ? parsed.ref.id : `@${parsed.ref.username}`;

    try {
        return { ok: true, chat: await api.getChat(target) };
    } catch (error: any) {
        const description: string = error.description ?? error.message ?? "";
        if (/not found/i.test(description)) {
            return {
                ok: false,
                error: "Chat not found. Add the bot to that chat first."
            };
        }
        return { ok: false, error: description || "Could not read that chat" };
    }
}
