import type { Api } from "grammy";
import type { ChatFullInfo } from "grammy/types";
import { parseChatRef } from "../chatref";

export const formatObject = (obj: {
    [key: string]: number[] | undefined;
}): string => {
    let text = "";
    for (const key in obj) {
        text += `(${key})\n`;

        if (obj[key] === undefined) {
            text += "\n";
        } else {
            const len = obj[key]?.length ?? 0;
            obj[key]?.forEach((value, index) => {
                index === len - 1
                    ? (text += `└─(${value})\n`)
                    : (text += `├─(${value})\n`);
            });
        }
    }

    return text;
};

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
