import { describe, expect, test } from "bun:test";
import type { Api } from "grammy";
import {
    chatTitle,
    escapeHtml,
    formatObject,
    resolveChat,
    resolveUser
} from "../src/lib/utils";

/** Only getChat is used, and only its shape matters. */
const api = (impl: (id: string | number) => unknown) =>
    ({ getChat: async (id: string | number) => impl(id) }) as unknown as Api;

const fails = (description: string) =>
    api(() => {
        throw Object.assign(new Error(description), { description });
    });

describe("escapeHtml", () => {
    test("escapes what would break an HTML-parsed reply", () => {
        expect(escapeHtml('<b>&"x"')).toBe('&lt;b&gt;&amp;"x"');
    });

    test("leaves ordinary text alone", () => {
        expect(escapeHtml("Just a title")).toBe("Just a title");
    });
});

describe("formatObject", () => {
    test("renders destinations as a tree with a closing branch", () => {
        expect(formatObject({ "-1001": [2, 3] })).toBe(
            "(-1001)\n├─(2)\n└─(3)\n"
        );
    });

    test("a single destination is the last branch", () => {
        expect(formatObject({ "-1001": [2] })).toBe("(-1001)\n└─(2)\n");
    });

    // undefined and [] are different states and must not render alike.
    test("undefined renders a blank line, an empty array renders nothing", () => {
        expect(formatObject({ a: undefined })).toBe("(a)\n\n");
        expect(formatObject({ a: [] })).toBe("(a)\n");
    });
});

describe("resolveUser", () => {
    test("accepts a numeric id belonging to a person", async () => {
        const result = await resolveUser(
            api((id) => ({ id: Number(id), type: "private" })),
            "811863648"
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.chat.id).toBe(811863648);
    });

    // getChat resolves a @username for public chats only, never for a person.
    test("rejects a username, explaining why", async () => {
        const result = await resolveUser(
            api(() => ({})),
            "@someone"
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("numeric id");
    });

    test("rejects a negative id, which cannot be a user", async () => {
        const result = await resolveUser(
            api(() => ({})),
            "-1001234567890"
        );
        expect(result.ok).toBe(false);
    });

    test("rejects a chat that is not a person", async () => {
        const result = await resolveUser(
            api(() => ({ id: 1, type: "channel" })),
            "1"
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("not a person");
    });

    test("an unknown id is reported as never having messaged", async () => {
        const result = await resolveUser(
            fails("Bad Request: chat not found"),
            "1"
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("messaged me");
    });

    // A rate limit is not the owner typing the wrong id.
    test("other Telegram failures are surfaced, not blamed on the id", async () => {
        const result = await resolveUser(
            fails("Too Many Requests: retry after 30"),
            "1"
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("Too Many Requests");
        expect(result.error).not.toContain("messaged me");
    });
});

describe("resolveChat", () => {
    test("passes an id straight through", async () => {
        const result = await resolveChat(
            api((id) => ({ id: Number(id), type: "channel" })),
            "-1001234567890"
        );
        expect(result.ok).toBe(true);
    });

    test("turns a t.me link into an @username lookup", async () => {
        let asked: string | number = "";
        const result = await resolveChat(
            api((id) => {
                asked = id;
                return { id: -100, type: "channel" };
            }),
            "https://t.me/mychannel"
        );
        expect(result.ok).toBe(true);
        expect(asked).toBe("@mychannel");
    });

    test("a chat the bot is not in says so", async () => {
        const result = await resolveChat(
            fails("Bad Request: chat not found"),
            "@nope"
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("Add the bot");
    });

    test("an invite link is rejected before any lookup", async () => {
        const result = await resolveChat(
            api(() => {
                throw new Error("should not be called");
            }),
            "https://t.me/+abcdef"
        );
        expect(result.ok).toBe(false);
    });
});

describe("chatTitle", () => {
    test("uses the title of a group or channel", () => {
        expect(
            chatTitle({ id: -100, type: "channel", title: "News" } as any)
        ).toBe("News");
    });

    test("falls back to a person's name, which has no title", () => {
        expect(
            chatTitle({
                id: 7,
                type: "private",
                first_name: "Ada",
                last_name: "Lovelace"
            } as any)
        ).toBe("Ada Lovelace");
    });

    test("handles a first name on its own", () => {
        expect(
            chatTitle({ id: 7, type: "private", first_name: "Ada" } as any)
        ).toBe("Ada");
    });

    test("uses the supergroup title", () => {
        expect(
            chatTitle({ id: -100, type: "supergroup", title: "Chat" } as any)
        ).toBe("Chat");
    });
});
