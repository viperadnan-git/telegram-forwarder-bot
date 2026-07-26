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

export type Rule =
    | { type: "keyword"; value: string; caseSensitive?: boolean }
    | { type: "regex"; pattern: string }
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
};

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
