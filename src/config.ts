import { compile, isSupportedPattern } from "./regex";

import { z } from "zod";

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

const keywordRule = z.object({
    type: z.literal("keyword"),
    value: z.string().min(1).max(256),
    caseSensitive: z.boolean().default(false)
});

const regexRule = z.object({
    type: z.literal("regex"),
    pattern: z.string().min(1).max(512)
});

const mediaRule = z.object({
    type: z.literal("media"),
    kinds: z.array(z.enum(MEDIA_KINDS)).min(1)
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

const replaceSchema = z.object({
    pattern: z.string().min(1).max(512),
    replacement: z.string().max(1024).default(""),
    isRegex: z.boolean().default(false)
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
            prepend: z.string().max(1024).optional(),
            append: z.string().max(1024).optional(),
            replace: z.array(replaceSchema).default([]),
            removeLinks: z.boolean().default(false),
            removeMentions: z.boolean().default(false)
        })
        .default({
            strip: false,
            replace: [],
            removeLinks: false,
            removeMentions: false
        })
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type Rule = z.infer<typeof ruleSchema>;

/** Caption is rewritten. Drives method selection in forward.ts. */
export const hasCaptionTransform = (c: RouteConfig) =>
    c.caption.strip ||
    c.caption.removeLinks ||
    c.caption.removeMentions ||
    c.caption.replace.length > 0 ||
    c.caption.prepend !== undefined ||
    c.caption.append !== undefined;

/** forwardMessage relays the original untouched, so none of this can apply. */
export const modifiesContent = (c: RouteConfig) =>
    hasCaptionTransform(c) || c.removeButtons;

/** Never throws: a corrupt config falls back to defaults rather than going dark. */
export function parseConfig(raw: unknown): RouteConfig {
    const parsed = routeConfigSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : routeConfigSchema.parse({});
}

export type ValidationResult =
    | { ok: true; config: RouteConfig }
    | { ok: false; error: string };

/** Strict, with the cross-field checks the schema cannot express. */
export function validateConfig(raw: unknown): ValidationResult {
    const parsed = routeConfigSchema.safeParse(raw ?? {});
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
            ok: false,
            error: `${first.path.join(".") || "config"}: ${first.message}`
        };
    }
    const config = parsed.data;

    if (config.mode === "forward" && modifiesContent(config)) {
        return {
            ok: false,
            error:
                "Forward mode relays the original message untouched, so it cannot " +
                "change captions or remove buttons. Switch to copy mode, or clear " +
                "those options."
        };
    }

    const patterns = [
        ...config.filters.whitelist,
        ...config.filters.blacklist
    ].flatMap((r) => (r.type === "regex" ? [r.pattern] : []));
    patterns.push(
        ...config.caption.replace.flatMap((r) => (r.isRegex ? [r.pattern] : []))
    );

    for (const pattern of patterns) {
        const supported = isSupportedPattern(pattern);
        if (!supported.ok) {
            return { ok: false, error: `Pattern /${pattern}/: ${supported.error}` };
        }
    }

    return { ok: true, config };
}

export { compile };
