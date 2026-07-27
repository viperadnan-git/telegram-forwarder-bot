import { describe, expect, test } from "bun:test";
import {
    isSupportedPattern,
    test as matches,
    matchSpans
} from "../src/forwarding/regex";

// The RE2 boundary: a bad pattern hangs the bot or silently forwards nothing,
// and a swapped engine once broke matching without failing loudly.
describe("matchSpans", () => {
    test("returns every match in order", () => {
        expect(matchSpans("a", "banana")).toEqual([
            { start: 1, end: 2 },
            { start: 3, end: 4 },
            { start: 5, end: 6 }
        ]);
    });

    test("no match is an empty list, not a throw", () => {
        expect(matchSpans("zzz", "banana")).toEqual([]);
    });

    test("skips zero-width matches, which would not advance", () => {
        expect(matchSpans("x*", "abc")).toEqual([]);
    });

    test("spans are UTF-16 code units, as message entities are", () => {
        // "😀" is one code point but two UTF-16 units.
        expect(matchSpans("b", "😀b")).toEqual([{ start: 2, end: 3 }]);
    });

    test("anchors work against the whole subject", () => {
        expect(matchSpans("^a", "aa")).toEqual([{ start: 0, end: 1 }]);
        expect(matchSpans("a$", "aa")).toEqual([{ start: 1, end: 2 }]);
    });

    test("alternation and groups", () => {
        expect(matchSpans("(cat|dog)", "a dog and a cat")).toEqual([
            { start: 2, end: 5 },
            { start: 12, end: 15 }
        ]);
    });
});

describe("test", () => {
    test("is a search, not a full match", () => {
        expect(matches("me/", "t.me/x")).toBe(true);
        expect(matches("^me/", "t.me/x")).toBe(false);
    });

    test("is case sensitive unless the pattern says otherwise", () => {
        expect(matches("abc", "ABC")).toBe(false);
        expect(matches("(?i)abc", "ABC")).toBe(true);
    });
});

describe("isSupportedPattern", () => {
    test("accepts an ordinary pattern", () => {
        expect(isSupportedPattern("t\\.me/\\w+")).toEqual({ ok: true });
    });

    test("names lookbehind and points at the supported syntax", () => {
        const result = isSupportedPattern("(?<=a)b");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("lookbehind");
        expect(result.error).toContain("(?P<name>");
    });

    test("names backreferences", () => {
        const result = isSupportedPattern("(a)\\1");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("backreference");
    });

    test("a named group in RE2 syntax is supported", () => {
        expect(isSupportedPattern("(?P<word>\\w+)")).toEqual({ ok: true });
    });

    test("unbalanced parenthesis is reported without the library prefix", () => {
        const result = isSupportedPattern("(unclosed");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).not.toContain("error parsing regexp");
    });
});
