import { compile, isSupportedPattern } from "./forwarding/regex";
import { type RouteConfig, routeConfigSchema } from "./schema";

export * from "./schema";

/** Caption is rewritten. Drives method selection in forward.ts. */
export const hasCaptionTransform = (c: RouteConfig) =>
    c.caption.strip ||
    c.caption.removeLinks ||
    c.caption.removeMentions ||
    c.caption.replace.length > 0 ||
    c.caption.prepend !== undefined ||
    c.caption.append !== undefined;

/** forwardMessage relays the original untouched, so none of this can apply. */
const modifiesContent = (c: RouteConfig) =>
    hasCaptionTransform(c) || c.removeButtons;

/** Names the field as the app labels it, so a rejection reads as an instruction. */
function describe(path: readonly PropertyKey[]): string {
    const [a, b, i] = path;
    const nth = typeof i === "number" ? i + 1 : 0;

    if (a === "filters" && nth) {
        const list = b === "whitelist" ? "Allow only" : "Never forward";
        return `${list}, rule ${nth}`;
    }
    if (a === "caption" && b === "replace" && nth) {
        return `Replacement ${nth}`;
    }
    if (a === "caption" && b === "prepend") return "Text added before";
    if (a === "caption" && b === "append") return "Text added after";
    return "";
}

export type ValidationResult =
    | { ok: true; config: RouteConfig }
    | { ok: false; error: string };

/** Strict, with the cross-field checks the schema cannot express. */
export function validateConfig(raw: unknown): ValidationResult {
    const parsed = routeConfigSchema.safeParse(raw ?? {});
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        const where = describe(first.path);
        return {
            ok: false,
            error: where ? `${where}: ${first.message}` : first.message
        };
    }
    const config = parsed.data;

    const emptySender = [
        ...config.filters.whitelist,
        ...config.filters.blacklist
    ].some(
        (r) =>
            r.type === "sender" &&
            r.ids.length === 0 &&
            r.usernames.length === 0
    );
    if (emptySender) {
        return {
            ok: false,
            error:
                "A sender rule needs at least one user id or @username. " +
                "An empty one matches nothing, which would block everything."
        };
    }

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
            return {
                ok: false,
                error: `Pattern /${pattern}/: ${supported.error}`
            };
        }
    }

    return { ok: true, config };
}
