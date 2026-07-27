import { describe, expect, test } from "bun:test";
import { validateConfig } from "../src/config";
import {
    botTokenSchema,
    isBlankRule,
    patternHint,
    pruneConfig,
    replacementIssue,
    routeConfigSchema,
    ruleIssue,
    tokenIssue,
    withDefaults
} from "../src/schema";

// Drives the editor's live feedback: a wrong answer blocks a valid save or lets
// an invalid one through.
describe("ruleIssue", () => {
    test("a complete keyword rule has no issue", () => {
        expect(
            ruleIssue({ type: "keyword", value: "sale", target: "text" })
        ).toBeNull();
    });

    test("an empty keyword asks for the word", () => {
        expect(ruleIssue({ type: "keyword", value: "", target: "text" })).toBe(
            "Enter the word or phrase to match"
        );
    });

    test("an empty pattern asks for the pattern", () => {
        expect(ruleIssue({ type: "regex", pattern: "", target: "text" })).toBe(
            "Enter a pattern to match"
        );
    });

    test("a media rule with nothing selected asks for a kind", () => {
        expect(ruleIssue({ type: "media", kinds: [] })).toBe(
            "Pick at least one media type"
        );
    });

    // An empty sender rule matches nothing, which would block everything.
    test("an empty sender rule asks for an id", () => {
        expect(ruleIssue({ type: "sender", ids: [], usernames: [] })).toBe(
            "Add at least one id or @username"
        );
    });

    test("a sender rule with only a username is complete", () => {
        expect(
            ruleIssue({ type: "sender", ids: [], usernames: ["someone"] })
        ).toBeNull();
    });

    test("an unsupported pattern is flagged while typing", () => {
        expect(
            ruleIssue({ type: "regex", pattern: "(?<=a)b", target: "text" })
        ).toContain("Lookbehind");
    });
});

describe("replacementIssue", () => {
    test("a literal replacement needs only something to find", () => {
        expect(replacementIssue({ pattern: "a", replacement: "" })).toBeNull();
        expect(replacementIssue({ pattern: "", replacement: "b" })).toBe(
            "Enter the text to find"
        );
    });

    // Only a regex replacement is subject to the RE2 limits.
    test("a literal pattern is not checked as a regex", () => {
        expect(
            replacementIssue({
                pattern: "(?<=a)b",
                replacement: "",
                isRegex: false
            })
        ).toBeNull();
        expect(
            replacementIssue({
                pattern: "(?<=a)b",
                replacement: "",
                isRegex: true
            })
        ).toContain("Lookbehind");
    });
});

describe("patternHint", () => {
    test("catches the two limits users actually hit", () => {
        expect(patternHint("(?<=a)b")).toContain("Lookbehind");
        expect(patternHint("(?<!a)b")).toContain("Lookbehind");
        expect(patternHint("(a)\\1")).toContain("Backreferences");
    });

    test("passes ordinary patterns, including RE2 named groups", () => {
        expect(patternHint("t\\.me/\\w+")).toBeNull();
        expect(patternHint("(?P<word>\\w+)")).toBeNull();
    });

    // It only reads the text; the server still compiles it.
    test("is a hint, so it does not attempt full validation", () => {
        expect(patternHint("(unclosed")).toBeNull();
    });
});

describe("withDefaults", () => {
    test("fills every field the server omitted", () => {
        const config = withDefaults({});
        expect(config.mode).toBe("copy");
        expect(config.filters).toEqual({ whitelist: [], blacklist: [] });
        expect(config.caption.replace).toEqual([]);
        expect(config.removeButtons).toBe(false);
    });

    test("its defaults are the schema's, so they cannot drift", () => {
        expect(withDefaults({})).toEqual(routeConfigSchema.parse({}));
    });

    test("keeps stored values", () => {
        expect(withDefaults({ mode: "forward" }).mode).toBe("forward");
    });

    // A merge, not a parse: one bad rule must not reset unrelated settings.
    test("a partial nested object does not drop its siblings", () => {
        const config = withDefaults({
            caption: { strip: true } as never,
            filters: { whitelist: [] } as never
        });
        expect(config.caption.strip).toBe(true);
        expect(config.caption.removeLinks).toBe(false);
        expect(config.filters.blacklist).toEqual([]);
    });
});

describe("trimming of matched text", () => {
    // A phone keyboard appends an invisible space that would stop the rule
    // matching anything.
    test("a keyword is trimmed", () => {
        const rule = { type: "keyword", value: "Test ", target: "text" };
        expect(ruleIssue(rule)).toBeNull();
        expect(
            routeConfigSchema.parse({
                filters: { whitelist: [rule] }
            }).filters.whitelist[0]
        ).toMatchObject({ value: "Test" });
    });

    test("a pattern is trimmed", () => {
        expect(
            routeConfigSchema.parse({
                filters: { whitelist: [{ type: "regex", pattern: " a|b " }] }
            }).filters.whitelist[0]
        ).toMatchObject({ pattern: "a|b" });
    });

    test("the text to find is trimmed", () => {
        expect(
            routeConfigSchema.parse({
                caption: {
                    replace: [{ pattern: "Test ", replacement: "Worked" }]
                }
            }).caption.replace[0]
        ).toMatchObject({ pattern: "Test" });
    });

    test("whitespace-only is still rejected, with the same message", () => {
        expect(
            ruleIssue({ type: "keyword", value: "   ", target: "text" })
        ).toBe("Enter the word or phrase to match");
    });

    // Interior spaces are the point of a phrase, and must survive.
    test("spaces inside the value are kept", () => {
        expect(
            routeConfigSchema.parse({
                filters: {
                    whitelist: [{ type: "keyword", value: " two words " }]
                }
            }).filters.whitelist[0]
        ).toMatchObject({ value: "two words" });
    });

    // Every kind of edge whitespace a signature might carry on purpose.
    test.each([
        ["a trailing newline", "TOP\n"],
        ["leading spaces", "   TOP"],
        ["trailing spaces", "TOP   "],
        ["only newlines", "\n\n"],
        ["only spaces", "   "],
        ["tabs", "\tTOP\t"]
    ])("prepend keeps %s verbatim", (_name, value) => {
        const config = routeConfigSchema.parse({ caption: { prepend: value } });
        expect(config.caption.prepend).toBe(value);
    });

    // A signature is deliberately spaced or newline-separated.
    test("prepend, append and the replacement text are left alone", () => {
        const config = routeConfigSchema.parse({
            caption: {
                prepend: "\n\nJoin us ",
                append: " — via bot",
                replace: [{ pattern: "a", replacement: " spaced " }]
            }
        });
        expect(config.caption.prepend).toBe("\n\nJoin us ");
        expect(config.caption.append).toBe(" — via bot");
        expect(config.caption.replace[0].replacement).toBe(" spaced ");
    });
});

describe("botTokenSchema", () => {
    const real = "123456789:AAExampleTokenForTestsOnly_0000000";

    test("accepts a real token shape", () => {
        expect(tokenIssue(real)).toBeNull();
    });

    test("tolerates the whitespace a paste brings with it", () => {
        expect(botTokenSchema.parse(`  ${real}\n`)).toBe(real);
    });

    // Nagging before there is anything to judge is noise.
    test("says nothing about an empty field", () => {
        expect(tokenIssue("")).toBeNull();
        expect(tokenIssue("   ")).toBeNull();
    });

    test("rejects text that is not a token, and shows the shape", () => {
        for (const bad of ["123", "abc:def", "notatoken", "811863648:short"]) {
            expect(tokenIssue(bad)).toContain("123456789:AA-Hh");
        }
    });

    test("rejects a bot id that is not numeric", () => {
        expect(
            tokenIssue("abcdefghi:AAExampleTokenForTestsOnly_000000")
        ).not.toBeNull();
    });
});

describe("blank rows versus invalid ones", () => {
    // A row just added is unfinished, not wrong: no error until it has content.
    test.each([
        ["a fresh keyword", { type: "keyword", value: "", target: "text" }],
        ["a fresh pattern", { type: "regex", pattern: "", target: "text" }],
        ["a fresh sender", { type: "sender", ids: [], usernames: [] }]
    ])("%s is blank, not invalid", (_name, rule) => {
        expect(isBlankRule(rule)).toBe(true);
    });

    // Media starts with a kind selected, so an empty one is a real mistake.
    test("a media rule with nothing ticked is invalid, not blank", () => {
        const rule = { type: "media", kinds: [] };
        expect(isBlankRule(rule)).toBe(false);
        expect(ruleIssue(rule)).toBe("Pick at least one media type");
    });

    test("a filled rule is neither blank nor invalid", () => {
        const rule = { type: "keyword", value: "sale", target: "text" };
        expect(isBlankRule(rule)).toBe(false);
        expect(ruleIssue(rule)).toBeNull();
    });

    test("pruneConfig drops the unfilled rows and keeps the rest", () => {
        const config = routeConfigSchema.parse({
            filters: {
                whitelist: [{ type: "keyword", value: "sale", target: "text" }]
            }
        });
        const withBlanks = {
            ...config,
            filters: {
                whitelist: [
                    ...config.filters.whitelist,
                    { type: "sender", ids: [], usernames: [] } as never
                ],
                blacklist: []
            },
            caption: {
                ...config.caption,
                replace: [
                    {
                        pattern: "",
                        replacement: "",
                        isRegex: false,
                        caseSensitive: true
                    },
                    {
                        pattern: "a",
                        replacement: "b",
                        isRegex: false,
                        caseSensitive: true
                    }
                ]
            }
        };

        const pruned = pruneConfig(withBlanks);
        expect(pruned.filters.whitelist).toHaveLength(1);
        expect(pruned.caption.replace).toHaveLength(1);
        // What survives must still validate.
        expect(validateConfig(pruned).ok).toBe(true);
    });
});
