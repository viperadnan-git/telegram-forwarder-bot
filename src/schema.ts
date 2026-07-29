import { z } from "zod";

// Shared with the Mini App, so nothing here may import the regex engine:
// it would end up in the browser bundle.

/**
 * A route's whole state in one field. Codes rather than sentences, so the
 * wording can change without rewriting rows.
 */
export const ROUTE_STATUS = {
    active: "Forwarding",
    paused: "Paused by you",
    removed: "I was removed from this chat",
    blocked: "This person blocked me",
    no_rights: "I am not allowed to post here",
    not_admin: "I need to be an administrator in this chat",
    gone: "This chat no longer exists, or I was never added",
    deactivated: "This account was deleted",
    is_bot: "I cannot forward to another bot",
    never_messaged: "This person has never messaged me"
} as const;

export type RouteStatus = keyof typeof ROUTE_STATUS;

export const isStopped = (status: string): status is RouteStatus =>
    status !== "active" && status !== "paused" && status in ROUTE_STATUS;

export const statusLabel = (status: string) =>
    ROUTE_STATUS[status as RouteStatus] ?? "Stopped";

/** Not storable: Telegram did not answer, so nothing about the chat is known. */
export const CHECK_LABEL = {
    ...ROUTE_STATUS,
    unavailable: "I could not reach Telegram just now — try again"
} as const;

export type CheckFailure = keyof typeof CHECK_LABEL;

export const checkLabel = (reason: CheckFailure) => CHECK_LABEL[reason];

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
    // Matching strips the @ and lower-cases; whitespace has to go too, or the
    // rule silently matches nothing.
    usernames: z.array(z.string().trim().min(1)).default([])
});

const ruleSchema = z.discriminatedUnion("type", [
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
 * Text-only check for the RE2 limits, for live editor feedback. Compiling needs
 * the server's regex engine, so validateConfig stays authoritative.
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

/**
 * Added but not filled in yet: no error, dropped on save rather than blocking
 * it. A media rule is never blank — it starts with a kind selected, so an empty
 * one is a deliberate mistake.
 */
export function isBlankRule(rule: unknown): boolean {
    const r = rule as Record<string, unknown>;
    if (r?.type === "keyword") return String(r.value ?? "").trim() === "";
    if (r?.type === "regex") return String(r.pattern ?? "").trim() === "";
    if (r?.type === "sender") {
        return (
            (r.ids as unknown[] | undefined)?.length === 0 &&
            (r.usernames as unknown[] | undefined)?.length === 0
        );
    }
    return false;
}

export const isBlankReplacement = (rule: unknown): boolean =>
    String((rule as { pattern?: unknown })?.pattern ?? "").trim() === "";

/** Drops the rows the user never filled in, so they cannot fail validation. */
export function pruneConfig(config: RouteConfig): RouteConfig {
    return {
        ...config,
        filters: {
            whitelist: config.filters.whitelist.filter((r) => !isBlankRule(r)),
            blacklist: config.filters.blacklist.filter((r) => !isBlankRule(r))
        },
        caption: {
            ...config.caption,
            replace: config.caption.replace.filter(
                (r) => !isBlankReplacement(r)
            )
        }
    };
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

const keep = (schema: z.ZodTypeAny, items: unknown) =>
    Array.isArray(items)
        ? items.filter((item) => schema.safeParse(item).success)
        : items;

/**
 * Drops the entries that will not parse, keeping the rest. A rule stored under
 * an older, looser schema must not take every other filter down with it.
 */
function salvage(raw: any) {
    if (!raw || typeof raw !== "object") return raw;
    const { filters, caption } = raw;
    return {
        ...raw,
        ...(filters && typeof filters === "object"
            ? {
                  filters: {
                      ...filters,
                      whitelist: keep(ruleSchema, filters.whitelist),
                      blacklist: keep(ruleSchema, filters.blacklist)
                  }
              }
            : {}),
        ...(caption && typeof caption === "object"
            ? {
                  caption: {
                      ...caption,
                      replace: keep(replaceSchema, caption.replace)
                  }
              }
            : {})
    };
}

/** Never throws: a corrupt config falls back to defaults rather than going dark. */
export function parseConfig(raw: unknown): RouteConfig {
    const parsed = routeConfigSchema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;

    // Failing open on the whole config would silently switch a blacklist off.
    const salvaged = routeConfigSchema.safeParse(salvage(raw));
    return salvaged.success ? salvaged.data : routeConfigSchema.parse({});
}
