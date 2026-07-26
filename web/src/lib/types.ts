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

export type MatchTarget = "text" | "filename";

export type Rule =
    | {
          type: "keyword";
          value: string;
          caseSensitive?: boolean;
          target: MatchTarget;
      }
    | { type: "regex"; pattern: string; target: MatchTarget }
    | { type: "media"; kinds: MediaKind[] }
    | { type: "sender"; ids: number[]; usernames: string[] };

export type Replacement = {
    pattern: string;
    replacement: string;
    isRegex: boolean;
};

export type RouteConfig = {
    mode: "copy" | "forward";
    protectContent: boolean;
    silent: boolean;
    removeButtons: boolean;
    filters: { whitelist: Rule[]; blacklist: Rule[] };
    caption: {
        strip: boolean;
        prepend?: string;
        append?: string;
        replace: Replacement[];
        removeLinks: boolean;
        removeMentions: boolean;
    };
};

export type Route = {
    id: string;
    sourceChatId: number;
    destChatId: number;
    enabled: boolean;
    config: Partial<RouteConfig>;
    sourceName?: string;
    destName?: string;
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

export const defaultConfig = (): RouteConfig => ({
    mode: "copy",
    protectContent: false,
    silent: false,
    removeButtons: false,
    filters: { whitelist: [], blacklist: [] },
    caption: {
        strip: false,
        replace: [],
        removeLinks: false,
        removeMentions: false
    }
});

/** Server stores partial config; fill the gaps for editing. */
export const withDefaults = (config: Partial<RouteConfig>): RouteConfig => {
    const base = defaultConfig();
    return {
        ...base,
        ...config,
        filters: { ...base.filters, ...config.filters },
        caption: { ...base.caption, ...config.caption }
    };
};
