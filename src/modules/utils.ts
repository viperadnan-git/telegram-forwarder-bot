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

export type ResolveResult =
    | { ok: true; chat: ChatFullInfo }
    | { ok: false; error: string };

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
