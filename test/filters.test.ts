import { describe, expect, test } from "bun:test";
import type { Message } from "grammy/types";
import type { Rule } from "../src/config";
import { parseConfig } from "../src/config";
import { matches, mediaKind, passes } from "../src/filters";

const msg = (over: Partial<Message> = {}) =>
    ({
        message_id: 1,
        date: 0,
        chat: { id: -100, type: "channel", title: "src" },
        ...over
    }) as Message;

const cfg = (filters: unknown) => parseConfig({ filters });

describe("mediaKind", () => {
    test("plain text", () =>
        expect(mediaKind(msg({ text: "hi" }))).toBe("text"));
    test("photo", () =>
        expect(mediaKind(msg({ photo: [] as any, caption: "c" }))).toBe(
            "photo"
        ));
    test("document", () =>
        expect(mediaKind(msg({ document: {} as any }))).toBe("document"));
});

describe("passes", () => {
    test("an empty config forwards everything", () => {
        expect(passes(parseConfig({}), msg({ text: "anything" }))).toBe(true);
    });

    test("whitelist only: match forwards, no match drops", () => {
        const c = cfg({ whitelist: [{ type: "keyword", value: "btc" }] });
        expect(passes(c, msg({ text: "buy BTC now" }))).toBe(true);
        expect(passes(c, msg({ text: "buy eth now" }))).toBe(false);
    });

    test("blacklist only: match drops, no match forwards", () => {
        const c = cfg({ blacklist: [{ type: "keyword", value: "spam" }] });
        expect(passes(c, msg({ text: "this is spam" }))).toBe(false);
        expect(passes(c, msg({ text: "this is fine" }))).toBe(true);
    });

    test("deny beats allow", () => {
        const c = cfg({
            whitelist: [{ type: "keyword", value: "btc" }],
            blacklist: [{ type: "keyword", value: "scam" }]
        });
        expect(passes(c, msg({ text: "btc giveaway" }))).toBe(true);
        expect(passes(c, msg({ text: "btc scam giveaway" }))).toBe(false);
    });

    test("rules within a list are ORed", () => {
        const c = cfg({
            whitelist: [
                { type: "keyword", value: "btc" },
                { type: "keyword", value: "eth" }
            ]
        });
        expect(passes(c, msg({ text: "eth news" }))).toBe(true);
    });

    test("matches against caption as well as text", () => {
        const c = cfg({ blacklist: [{ type: "keyword", value: "ad" }] });
        expect(passes(c, msg({ photo: [] as any, caption: "an ad" }))).toBe(
            false
        );
    });
});

describe("rule types", () => {
    test("keyword is case insensitive by default", () => {
        expect(
            matches(
                { type: "keyword", value: "HELLO", caseSensitive: false },
                msg({ text: "hello there" })
            )
        ).toBe(true);
    });

    test("keyword honors caseSensitive", () => {
        expect(
            matches(
                { type: "keyword", value: "HELLO", caseSensitive: true },
                msg({ text: "hello there" })
            )
        ).toBe(false);
    });

    test("regex matches", () => {
        expect(
            matches(
                { type: "regex", pattern: "t\\.me/\\w+" },
                msg({ text: "join t.me/channel" })
            )
        ).toBe(true);
        expect(
            matches(
                { type: "regex", pattern: "^\\d+$" },
                msg({ text: "not a number" })
            )
        ).toBe(false);
    });

    test("a catastrophic pattern returns promptly", () => {
        const started = performance.now();
        matches(
            { type: "regex", pattern: "(a+)+$" },
            msg({ text: `${"a".repeat(50)}!` })
        );
        expect(performance.now() - started).toBeLessThan(500);
    });

    test("media kind", () => {
        const rule: Rule = { type: "media", kinds: ["photo", "video"] };
        expect(matches(rule, msg({ photo: [] as any }))).toBe(true);
        expect(matches(rule, msg({ text: "hi" }))).toBe(false);
    });

    test("sender by id", () => {
        const rule: Rule = { type: "sender", ids: [42], usernames: [] };
        expect(matches(rule, msg({ from: { id: 42 } as any }))).toBe(true);
        expect(matches(rule, msg({ from: { id: 7 } as any }))).toBe(false);
    });

    test("sender by username, @ and case insensitive", () => {
        const rule: Rule = { type: "sender", ids: [], usernames: ["@Spammer"] };
        expect(
            matches(rule, msg({ from: { id: 1, username: "spammer" } as any }))
        ).toBe(true);
    });

    test("sender matches forward origin", () => {
        const rule: Rule = { type: "sender", ids: [999], usernames: [] };
        expect(
            matches(
                rule,
                msg({
                    text: "x",
                    forward_origin: {
                        type: "channel",
                        chat: { id: 999, type: "channel", title: "orig" },
                        message_id: 1,
                        date: 0
                    } as any
                })
            )
        ).toBe(true);
    });
});
