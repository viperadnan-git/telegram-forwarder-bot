import { describe, expect, test } from "bun:test";
import type { MessageEntity } from "grammy/types";
import { parseConfig } from "../src/config";
import { applyCaption, clamp } from "../src/transforms";

const cap = (over: Record<string, unknown> = {}) =>
    parseConfig({ caption: over }).caption;

const bold = (offset: number, length: number): MessageEntity => ({
    type: "bold",
    offset,
    length
});

describe("applyCaption", () => {
    test("an empty config is a no-op", () => {
        const input = { text: "hello world", entities: [bold(6, 5)] };
        expect(applyCaption(cap(), input)).toEqual(input);
    });

    test("strip clears text and entities", () => {
        expect(
            applyCaption(cap({ strip: true }), {
                text: "hello",
                entities: [bold(0, 5)]
            })
        ).toEqual({ text: "", entities: [] });
    });

    // Each part is its own line, so the shift is the prepend plus its newline.
    test("prepend shifts entities, append does not", () => {
        const out = applyCaption(cap({ prepend: ">>", append: "<<" }), {
            text: "hello",
            entities: [bold(0, 5)]
        });
        expect(out.text).toBe(">>\nhello\n<<");
        expect(out.entities).toEqual([bold(3, 5)]);
    });

    describe("replacement versus entity position", () => {
        // "0123hello89" with bold over "hello" at offset 4
        const input = () => ({
            text: "0123hello89",
            entities: [bold(4, 5)]
        });

        test("edit before the entity shifts it", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "0123", replacement: "X" }] }),
                input()
            );
            expect(out.text).toBe("Xhello89");
            expect(out.entities).toEqual([bold(1, 5)]);
        });

        test("edit after the entity leaves it alone", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "89", replacement: "" }] }),
                input()
            );
            expect(out.text).toBe("0123hello");
            expect(out.entities).toEqual([bold(4, 5)]);
        });

        test("edit inside the entity resizes it", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "ell", replacement: "ELLO" }] }),
                input()
            );
            expect(out.text).toBe("0123hELLOo89");
            expect(out.entities).toEqual([bold(4, 6)]);
        });

        test("an entity wholly inside a replacement is dropped", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "hello", replacement: "bye" }] }),
                input()
            );
            expect(out.text).toBe("0123bye89");
            expect(out.entities).toEqual([]);
        });

        test("an entity straddling from the left is clamped", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "llo89", replacement: "" }] }),
                input()
            );
            expect(out.text).toBe("0123he");
            expect(out.entities).toEqual([bold(4, 2)]);
        });

        test("an entity straddling from the right is clamped", () => {
            const out = applyCaption(
                cap({ replace: [{ pattern: "0123hel", replacement: "" }] }),
                input()
            );
            expect(out.text).toBe("lo89");
            expect(out.entities).toEqual([bold(0, 2)]);
        });
    });

    test("multiple replacements apply without corrupting each other", () => {
        const out = applyCaption(
            cap({
                replace: [
                    { pattern: "aa", replacement: "X" },
                    { pattern: "cc", replacement: "YYY" }
                ]
            }),
            { text: "aa-bb-cc", entities: [bold(3, 2)] }
        );
        expect(out.text).toBe("X-bb-YYY");
        expect(out.entities).toEqual([bold(2, 2)]);
    });

    test("regex replacement replaces every occurrence", () => {
        const out = applyCaption(
            cap({
                replace: [{ pattern: "\\d+", replacement: "#", isRegex: true }]
            }),
            { text: "a1b22c333", entities: [] }
        );
        expect(out.text).toBe("a#b#c#");
    });

    test("emoji keep correct UTF-16 offsets", () => {
        // "👍" is two UTF-16 code units, which is what Telegram counts in.
        const input = { text: "👍 hello", entities: [bold(3, 5)] };
        expect(input.text.slice(3, 8)).toBe("hello");

        const out = applyCaption(cap({ prepend: "ab" }), input);
        expect(out.text).toBe("ab\n👍 hello");
        expect(out.entities).toEqual([bold(6, 5)]);
        expect(out.text.slice(6, 11)).toBe("hello");
    });

    test("removeLinks deletes url and text_link spans", () => {
        const out = applyCaption(cap({ removeLinks: true }), {
            text: "see t.me/spam ok",
            entities: [{ type: "url", offset: 4, length: 9 }, bold(14, 2)]
        });
        expect(out.text).toBe("see  ok");
        expect(out.entities).toEqual([bold(5, 2)]);
    });

    test("removeMentions deletes mention spans", () => {
        const out = applyCaption(cap({ removeMentions: true }), {
            text: "hi @someone bye",
            entities: [{ type: "mention", offset: 3, length: 8 }]
        });
        expect(out.text).toBe("hi  bye");
    });

    test("overlapping edits do not double-apply", () => {
        const out = applyCaption(
            cap({
                replace: [
                    { pattern: "abcd", replacement: "X" },
                    { pattern: "bc", replacement: "Y" }
                ]
            }),
            { text: "abcd", entities: [] }
        );
        expect(out.text).toBe("X");
    });
});

describe("clamp", () => {
    test("leaves short text alone", () => {
        const input = { text: "hi", entities: [bold(0, 2)] };
        expect(clamp(input, 10)).toEqual(input);
    });

    test("truncates and clamps a straddling entity", () => {
        const out = clamp({ text: "abcdefghij", entities: [bold(3, 6)] }, 5);
        expect(out.text).toBe("abcde");
        expect(out.entities).toEqual([bold(3, 2)]);
    });

    test("drops entities past the limit", () => {
        const out = clamp({ text: "abcdefghij", entities: [bold(7, 3)] }, 5);
        expect(out.entities).toEqual([]);
    });
});

describe("case-insensitive replacement", () => {
    const run = (text: string, rule: Record<string, unknown>) =>
        applyCaption(cap({ replace: [rule] }), { text, entities: [] });

    // Stored configs predate the option, so the default must not change them.
    test("defaults to matching case, as it always has", () => {
        expect(
            run("Buy NOW and buy later", {
                pattern: "buy",
                replacement: "get"
            }).text
        ).toBe("Buy NOW and get later");
    });

    test("literal matching ignores case when asked", () => {
        expect(
            run("Buy NOW and buy later", {
                pattern: "buy",
                replacement: "get",
                caseSensitive: false
            }).text
        ).toBe("get NOW and get later");
    });

    test("a regex ignores case when asked", () => {
        expect(
            run("Visit T.ME/x and t.me/y", {
                pattern: "t\\.me/\\w+",
                replacement: "[link]",
                isRegex: true,
                caseSensitive: false
            }).text
        ).toBe("Visit [link] and [link]");
    });

    test("an explicit inline flag still works", () => {
        expect(
            run("ABC abc", {
                pattern: "(?i)abc",
                replacement: "x",
                isRegex: true
            }).text
        ).toBe("x x");
    });

    // Offsets come from the original text, not the lower-cased copy.
    test("entities survive a case-insensitive replacement", () => {
        const result = applyCaption(
            cap({
                replace: [
                    { pattern: "buy", replacement: "get", caseSensitive: false }
                ]
            }),
            { text: "Hello BUY world", entities: [bold(0, 5)] }
        );
        expect(result.text).toBe("Hello get world");
        expect(result.entities).toEqual([bold(0, 5)]);
    });
});

describe("case folding that changes string length", () => {
    // "İ" (U+0130) lower-cases to two code units, so searching a lower-cased
    // copy and slicing the original shifts every later index.
    const cfg = (over: Record<string, unknown>) =>
        cap({
            replace: [{ replacement: "OFFER", caseSensitive: false, ...over }]
        });

    test("a literal match after a dotted capital I lands correctly", () => {
        expect(
            applyCaption(cfg({ pattern: "deal" }), {
                text: "İstanbul deal today",
                entities: []
            }).text
        ).toBe("İstanbul OFFER today");
    });

    test("entities before the match are untouched", () => {
        const out = applyCaption(cfg({ pattern: "deal" }), {
            text: "İstanbul deal today",
            entities: [bold(0, 8)]
        });
        expect(out.entities).toEqual([bold(0, 8)]);
    });

    test("punctuation in a literal is not treated as a pattern", () => {
        expect(
            applyCaption(cfg({ pattern: "a.b" }), {
                text: "a.b and axb",
                entities: []
            }).text
        ).toBe("OFFER and axb");
    });

    test("a literal with regex metacharacters still matches case-insensitively", () => {
        expect(
            applyCaption(cfg({ pattern: "(SALE)" }), {
                text: "big (sale) here",
                entities: []
            }).text
        ).toBe("big OFFER here");
    });
});

describe("prepend and append", () => {
    // Each part goes on its own line, so a signature needs no typed newline.
    test("parts are joined with a newline", () => {
        expect(
            applyCaption(cap({ prepend: "TOP", append: "Join @chan" }), {
                text: "Body",
                entities: []
            }).text
        ).toBe("TOP\nBody\nJoin @chan");
    });

    test("a missing part leaves no blank line behind", () => {
        expect(
            applyCaption(cap({ append: "Join @chan" }), {
                text: "Body",
                entities: []
            }).text
        ).toBe("Body\nJoin @chan");
    });

    // Uncaptioned media: the two parts must not be separated by a gap.
    test("an empty caption does not leave a hole between the parts", () => {
        expect(
            applyCaption(cap({ prepend: "TOP", append: "Join @chan" }), {
                text: "",
                entities: []
            }).text
        ).toBe("TOP\nJoin @chan");
    });

    test("a multiline part keeps its own newlines", () => {
        expect(
            applyCaption(cap({ append: "A\nB" }), {
                text: "Body",
                entities: []
            }).text
        ).toBe("Body\nA\nB");
    });

    test("entities shift by the prepend and its newline", () => {
        const out = applyCaption(cap({ prepend: "TOP\nLINE" }), {
            text: "Body",
            entities: [bold(0, 4)]
        });
        expect(out.text).toBe("TOP\nLINE\nBody");
        expect(out.entities).toEqual([bold(9, 4)]);
    });
});
