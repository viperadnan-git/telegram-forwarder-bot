export {
    defaultConfig,
    isStopped,
    MATCH_TARGETS,
    type MatchTarget,
    MEDIA_KINDS,
    type MediaKind,
    ROUTE_STATUS,
    type RouteConfig,
    type RouteStatus,
    type Rule,
    statusLabel,
    withDefaults
} from "$schema";

import type { RouteConfig } from "$schema";

export type Replacement = RouteConfig["caption"]["replace"][number];

export type Route = {
    id: string;
    sourceChatId: number;
    destChatId: number;
    // "active" | "paused" | a stop reason.
    status: string;
    forwarded: number;
    lastForwardedAt?: string | null;
    config: Partial<RouteConfig>;
    sourceName: string;
    destName: string;
    updatedAt?: string;
};

/** "3 minutes ago". Intl picks the unit and handles pluralisation. */
export function relativeTime(iso?: string): string {
    if (!iso) return "";
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return "";

    const seconds = Math.round((then - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60]
    ];
    const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return fmt.format(Math.round(seconds / size), unit);
        }
    }
    return fmt.format(Math.round(seconds), "second");
}
