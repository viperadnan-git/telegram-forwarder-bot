import { z } from "zod";

// Shared with the Mini App, so nothing here may import the regex engine:
// it would end up in the browser bundle.

export const MEDIA_KINDS = [
    "text",
    "photo",
    "video",
    "animation",
    "audio",
    "document",
    "sticker",
    "voice",
    "video_note",
    "poll",
    "contact",
    "location",
    "dice",
    "paid_media"
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

/** What a keyword or regex rule is tested against. */
export const MATCH_TARGETS = ["text", "filename"] as const;
export type MatchTarget = (typeof MATCH_TARGETS)[number];

const targetField = z.enum(MATCH_TARGETS).default("text");

const keywordRule = z.object({
    type: z.literal("keyword"),
    value: z
        .string()
        .trim()
        .min(1, "Enter the word or phrase to match")
        .max(256, "That keyword is too long (256 characters max)"),
    caseSensitive: z.boolean().default(false),
    target: targetField
});

const regexRule = z.object({
    type: z.literal("regex"),
    pattern: z
        .string()
        .trim()
        .min(1, "Enter a pattern to match")
        .max(512, "That pattern is too long (512 characters max)"),
    target: targetField
});

const mediaRule = z.object({
    type: z.literal("media"),
    kinds: z.array(z.enum(MEDIA_KINDS)).min(1, "Pick at least one media type")
});

const senderRule = z.object({
    type: z.literal("sender"),
    ids: z.array(z.number().int()).default([]),
    usernames: z.array(z.string().min(1)).default([])
});

export const ruleSchema = z.discriminatedUnion("type", [
    keywordRule,
    regexRule,
    mediaRule,
    senderRule
]);

const emptyToUndefined = z
    .string()
    .max(1024, "That text is too long (1024 characters max)")
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const replaceSchema = z.object({
    pattern: z
        .string()
        .trim()
        .min(1, "Enter the text to find")
        .max(512, "That is too long to find (512 characters max)"),
    replacement: z
        .string()
        .max(1024, "That replacement is too long (1024 characters max)")
        .default(""),
    isRegex: z.boolean().default(false),
    // Defaults true, unlike a keyword rule: replacements have always matched
    // case, and flipping that would silently change every stored config.
    caseSensitive: z.boolean().default(true)
});

export const routeConfigSchema = z.object({
    mode: z.enum(["copy", "forward"]).default("copy"),
    protectContent: z.boolean().default(false),
    silent: z.boolean().default(false),
    // copyMessage carries the original's buttons over unless dropped.
    removeButtons: z.boolean().default(false),
    filters: z
        .object({
            whitelist: z.array(ruleSchema).default([]),
            blacklist: z.array(ruleSchema).default([])
        })
        .default({ whitelist: [], blacklist: [] }),
    caption: z
        .object({
            strip: z.boolean().default(false),
            // "" is what an emptied input sends; treat it as absent so the
            // client's truthiness check and hasCaptionTransform agree.
            prepend: emptyToUndefined,
            append: emptyToUndefined,
            replace: z.array(replaceSchema).default([]),
            removeLinks: z.boolean().default(false),
            removeMentions: z.boolean().default(false)
        })
        .default({
            strip: false,
            prepend: undefined,
            append: undefined,
            replace: [],
            removeLinks: false,
            removeMentions: false
        })
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type Rule = z.infer<typeof ruleSchema>;

/**
 * A cheap check for the RE2 limits, so the editor can flag a pattern while it
 * is being typed. Only inspects the pattern text — compiling it needs the
 * regex engine, which stays on the server, and validateConfig is authoritative.
 */
export function patternHint(pattern: string): string | null {
    if (/\(\?<[=!]/.test(pattern)) {
        return "Lookbehind is not supported; RE2 cannot backtrack";
    }
    if (/\\[1-9]/.test(pattern)) return "Backreferences are not supported";
    return null;
}

/**
 * `<bot id>:<secret>`. Matched loosely on the secret so a future format change
 * does not lock anyone out; Telegram is the real authority via getMe.
 */
export const botTokenSchema = z
    .string()
    .trim()
    .regex(
        /^\d{5,}:[A-Za-z0-9_-]{20,}$/,
        "That does not look like a bot token. It reads like 123456789:AA-Hh..."
    );

/** Live feedback while typing; silent until there is something to judge. */
export function tokenIssue(raw: string): string | null {
    if (raw.trim() === "") return null;
    const parsed = botTokenSchema.safeParse(raw);
    return parsed.success ? null : parsed.error.issues[0].message;
}

/** What is wrong with a single rule, in the words the user should read. */
export function ruleIssue(raw: unknown): string | null {
    const parsed = ruleSchema.safeParse(raw);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid";

    const rule = parsed.data;
    if (rule.type === "regex") return patternHint(rule.pattern);
    if (
        rule.type === "sender" &&
        rule.ids.length === 0 &&
        rule.usernames.length === 0
    ) {
        return "Add at least one id or @username";
    }
    return null;
}

export function replacementIssue(raw: unknown): string | null {
    const parsed = replaceSchema.safeParse(raw);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid";
    return parsed.data.isRegex ? patternHint(parsed.data.pattern) : null;
}

/** Defaults come from the schema, so they cannot drift from what is stored. */
export const defaultConfig = (): RouteConfig => routeConfigSchema.parse({});

/**
 * The server stores a partial config; fill the gaps for editing. Deliberately
 * a merge rather than a parse: one bad rule must not reset every other setting.
 */
export const withDefaults = (config: Partial<RouteConfig>): RouteConfig => {
    const base = defaultConfig();
    return {
        ...base,
        ...config,
        filters: { ...base.filters, ...config.filters },
        caption: { ...base.caption, ...config.caption }
    };
};

/** Never throws: a corrupt config falls back to defaults rather than going dark. */
export function parseConfig(raw: unknown): RouteConfig {
    const parsed = routeConfigSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : routeConfigSchema.parse({});
}
