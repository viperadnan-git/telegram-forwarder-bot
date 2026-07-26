import { describe, expect, test } from "bun:test";
import { validateConfig } from "../src/config";

const base = {
    mode: "copy",
    filters: { whitelist: [], blacklist: [] },
    caption: { replace: [] }
};

const rules = (list: "whitelist" | "blacklist", ...rules: unknown[]) => ({
    ...base,
    filters: { ...base.filters, [list]: rules }
});

// Zod's defaults ("Too small: expected string to have >=1 characters") are
// developer text, and this app renders the error straight to the user.
const JARGON =
    /too small|too big|expected|invalid input|at least \d+ character|received/i;

const reject = (raw: unknown): string => {
    const result = validateConfig(raw);
    if (result.ok) throw new Error("expected the config to be rejected");
    return result.error;
};

describe("validation messages", () => {
    const cases: [string, unknown][] = [
        [
            "empty keyword",
            rules("whitelist", {
                type: "keyword",
                value: "",
                target: "text"
            })
        ],
        [
            "empty pattern",
            rules("blacklist", { type: "regex", pattern: "", target: "text" })
        ],
        ["no media kinds", rules("whitelist", { type: "media", kinds: [] })],
        [
            "overlong keyword",
            rules("whitelist", {
                type: "keyword",
                value: "x".repeat(300),
                target: "text"
            })
        ],
        [
            "empty replacement pattern",
            {
                ...base,
                caption: { replace: [{ pattern: "", replacement: "" }] }
            }
        ],
        [
            "overlong prepend",
            { ...base, caption: { ...base.caption, prepend: "x".repeat(2000) } }
        ]
    ];

    for (const [name, raw] of cases) {
        test(`${name} reads as prose`, () => {
            const error = reject(raw);
            expect(error).not.toMatch(JARGON);
            // A schema path would leak the internal shape.
            expect(error).not.toMatch(/whitelist|blacklist|\.\d+\./);
            expect(error[0]).toBe(error[0]!.toUpperCase());
        });
    }

    test("names the list and the rule number", () => {
        const error = reject(
            rules(
                "blacklist",
                { type: "media", kinds: ["photo"] },
                { type: "keyword", value: "", target: "text" }
            )
        );
        expect(error).toBe(
            "Never forward, rule 2: Enter the word or phrase to match"
        );
    });

    test("names the replacement number", () => {
        const error = reject({
            ...base,
            caption: {
                replace: [
                    { pattern: "a", replacement: "b" },
                    { pattern: "", replacement: "" }
                ]
            }
        });
        expect(error).toBe("Replacement 2: Enter the text to find");
    });

    test("hand-written cross-field messages still pass through", () => {
        expect(
            reject({
                ...base,
                mode: "forward",
                caption: { ...base.caption, strip: true }
            })
        ).toMatch(/^Forward mode relays/);
    });
});
