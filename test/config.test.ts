import { describe, expect, test } from "bun:test";
import {
    hasCaptionTransform,
    parseConfig,
    validateConfig
} from "../src/config";

describe("parseConfig", () => {
    test("an empty object gets today's behavior as defaults", () => {
        const c = parseConfig({});
        expect(c.mode).toBe("copy");
        expect(c.protectContent).toBe(false);
        expect(c.silent).toBe(false);
        expect(c.filters).toEqual({ whitelist: [], blacklist: [] });
        expect(hasCaptionTransform(c)).toBe(false);
    });

    test("null and undefined are treated as empty", () => {
        expect(parseConfig(null).mode).toBe("copy");
        expect(parseConfig(undefined).mode).toBe("copy");
    });

    test("corrupt config falls back to defaults rather than throwing", () => {
        expect(parseConfig({ mode: "nonsense", filters: 5 }).mode).toBe("copy");
    });

    test("provided values survive", () => {
        const c = parseConfig({ mode: "forward", protectContent: true });
        expect(c.mode).toBe("forward");
        expect(c.protectContent).toBe(true);
    });
});

describe("validateConfig", () => {
    test("accepts an empty config", () => {
        expect(validateConfig({}).ok).toBe(true);
    });

    test("rejects an unknown mode", () => {
        const r = validateConfig({ mode: "sideways" });
        expect(r.ok).toBe(false);
    });

    test("rejects forward mode combined with a caption transform", () => {
        const r = validateConfig({
            mode: "forward",
            caption: { append: "\n\nvia @me" }
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("Forward mode");
    });

    test("allows forward mode with protectContent, which is not a transform", () => {
        expect(
            validateConfig({ mode: "forward", protectContent: true }).ok
        ).toBe(true);
    });

    test("allows copy mode with caption transforms", () => {
        expect(
            validateConfig({ mode: "copy", caption: { append: "x" } }).ok
        ).toBe(true);
    });

    test("rejects a lookbehind pattern with an explanation", () => {
        const r = validateConfig({
            filters: { blacklist: [{ type: "regex", pattern: "(?<=a)b" }] }
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("lookbehind");
    });

    test("rejects a backreference pattern with an explanation", () => {
        const r = validateConfig({
            filters: { whitelist: [{ type: "regex", pattern: "(a)\\1" }] }
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("backreference");
    });

    test("rejects an invalid regex in a caption replacement", () => {
        const r = validateConfig({
            caption: { replace: [{ pattern: "(unclosed", isRegex: true }] }
        });
        expect(r.ok).toBe(false);
    });

    test("a literal replacement is not compiled as a regex", () => {
        expect(
            validateConfig({
                caption: { replace: [{ pattern: "(unclosed", isRegex: false }] }
            }).ok
        ).toBe(true);
    });

    test("accepts a valid regex filter", () => {
        expect(
            validateConfig({
                filters: {
                    blacklist: [{ type: "regex", pattern: "t\\.me/\\w+" }]
                }
            }).ok
        ).toBe(true);
    });
});

describe("removeButtons validation", () => {
    test("defaults to false", () => {
        expect(parseConfig({}).removeButtons).toBe(false);
    });

    test("rejected together with forward mode", () => {
        const r = validateConfig({ mode: "forward", removeButtons: true });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("remove buttons");
    });

    test("allowed with copy mode", () => {
        expect(validateConfig({ mode: "copy", removeButtons: true }).ok).toBe(
            true
        );
    });
});
