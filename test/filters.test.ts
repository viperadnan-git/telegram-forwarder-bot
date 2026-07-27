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
                {
                    type: "keyword",
                    value: "HELLO",
                    caseSensitive: false,
                    target: "text"
                },
                msg({ text: "hello there" })
            )
        ).toBe(true);
    });

    test("keyword honors caseSensitive", () => {
        expect(
            matches(
                {
                    type: "keyword",
                    value: "HELLO",
                    caseSensitive: true,
                    target: "text"
                },
                msg({ text: "hello there" })
            )
        ).toBe(false);
    });

    test("regex matches", () => {
        expect(
            matches(
                { type: "regex", pattern: "t\\.me/\\w+", target: "text" },
                msg({ text: "join t.me/channel" })
            )
        ).toBe(true);
        expect(
            matches(
                { type: "regex", pattern: "^\\d+$", target: "text" },
                msg({ text: "not a number" })
            )
        ).toBe(false);
    });

    test("a catastrophic pattern returns promptly", () => {
        const started = performance.now();
        matches(
            { type: "regex", pattern: "(a+)+$", target: "text" },
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

describe("filename matching (issue #1)", () => {
    const doc = (name: string) =>
        msg({ document: { file_name: name } as any, caption: "holiday pics" });

    test("keyword targets the file name, not the caption", () => {
        const rule: Rule = {
            type: "keyword",
            value: "invoice",
            caseSensitive: false,
            target: "filename"
        };
        expect(matches(rule, doc("invoice-2026.pdf"))).toBe(true);
        expect(matches(rule, doc("holiday.pdf"))).toBe(false);
    });

    test("a filename rule ignores caption text", () => {
        const rule: Rule = {
            type: "keyword",
            value: "holiday",
            caseSensitive: false,
            target: "filename"
        };
        // "holiday" is in the caption but not the file name.
        expect(matches(rule, doc("invoice.pdf"))).toBe(false);
    });

    test("regex matches an extension", () => {
        const rule: Rule = {
            type: "regex",
            pattern: "\\.(mkv|avi)$",
            target: "filename"
        };
        expect(matches(rule, doc("movie.mkv"))).toBe(true);
        expect(matches(rule, doc("movie.mp4"))).toBe(false);
    });

    test("reads the name off video and audio too", () => {
        const rule: Rule = {
            type: "regex",
            pattern: "\\.mp3$",
            target: "filename"
        };
        expect(
            matches(rule, msg({ audio: { file_name: "song.mp3" } as any }))
        ).toBe(true);
        expect(
            matches(rule, msg({ video: { file_name: "clip.mp4" } as any }))
        ).toBe(false);
    });

    test("target defaults to text, so existing rules are unchanged", () => {
        const parsed = parseConfig({
            filters: { blacklist: [{ type: "keyword", value: "spam" }] }
        });
        expect(parsed.filters.blacklist[0]).toMatchObject({ target: "text" });
    });

    test("blocking a file extension stops the forward", () => {
        const c = cfg({
            blacklist: [
                { type: "regex", pattern: "\\.exe$", target: "filename" }
            ]
        });
        expect(passes(c, doc("setup.exe"))).toBe(false);
        expect(passes(c, doc("notes.txt"))).toBe(true);
    });
});

describe("sender username normalisation", () => {
    const msg = {
        from: { id: 7, username: "Someone" },
        text: "hi"
    } as unknown as Message;

    // The @, the case and any stray whitespace are all normalised, so a rule
    // matches however the owner happened to type or paste the username.
    test.each([
        ["as typed", "Someone"],
        ["with an @", "@someone"],
        ["leading space", " someone"],
        ["trailing space", "someone "],
        ["all three", " @Someone "]
    ])("matches %s", (_name, username) => {
        const config = parseConfig({
            filters: {
                blacklist: [{ type: "sender", ids: [], usernames: [username] }]
            }
        });
        expect(passes(config, msg)).toBe(false);
    });

    test("a different username is left alone", () => {
        const config = parseConfig({
            filters: {
                blacklist: [{ type: "sender", ids: [], usernames: ["nobody"] }]
            }
        });
        expect(passes(config, msg)).toBe(true);
    });
});
