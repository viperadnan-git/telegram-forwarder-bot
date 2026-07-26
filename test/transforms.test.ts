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

    test("prepend shifts entities, append does not", () => {
        const out = applyCaption(cap({ prepend: ">> ", append: " <<" }), {
            text: "hello",
            entities: [bold(0, 5)]
        });
        expect(out.text).toBe(">> hello <<");
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
        // "👍" is one code point but two UTF-16 code units, which is the unit
        // Telegram counts in.
        const input = { text: "👍 hello", entities: [bold(3, 5)] };
        expect(input.text.slice(3, 8)).toBe("hello");

        const out = applyCaption(cap({ prepend: "ab" }), input);
        expect(out.text).toBe("ab👍 hello");
        expect(out.entities).toEqual([bold(5, 5)]);
        expect(out.text.slice(5, 10)).toBe("hello");
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
