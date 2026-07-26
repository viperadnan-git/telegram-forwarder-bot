import type { Api } from "grammy";
import type {
    InputMediaAudio,
    InputMediaDocument,
    InputMediaPhoto,
    InputMediaVideo,
    Message
} from "grammy/types";
import { hasCaptionTransform, parseConfig, type RouteConfig } from "./config";
import { passes } from "./filters";
import logger from "./modules/logger";
import type { Route } from "./store";
import { applyCaption, clamp, type TextAndEntities } from "./transforms";

const TEXT_LIMIT = 4096;
const CAPTION_LIMIT = 1024;

const isTextMessage = (msg: Message) => msg.text !== undefined;

const contentOf = (msg: Message): TextAndEntities => ({
    text: msg.text ?? msg.caption ?? "",
    entities: msg.entities ?? msg.caption_entities ?? []
});

/** The captioned part decides filtering for the whole album. */
const primaryOf = (parts: Message[]) =>
    parts.find((p) => p.caption ?? p.text) ?? parts[0];

type VisualMedia = InputMediaPhoto | InputMediaVideo;
type GroupMedia = VisualMedia | InputMediaAudio | InputMediaDocument;

// Telegram accepts a group of photos/videos, of audio, or of documents —
// never a mix. grammY's types encode this, so the array has to be narrowed.
const family = (m: GroupMedia) =>
    m.type === "audio" || m.type === "document" ? m.type : "visual";

function toInputMedia(
    msg: Message,
    caption: TextAndEntities | undefined
): GroupMedia | undefined {
    const shared = caption
        ? {
              caption: caption.text || undefined,
              caption_entities: caption.entities
          }
        : {};

    if (msg.photo?.length) {
        return {
            type: "photo",
            media: msg.photo[msg.photo.length - 1].file_id,
            ...shared
        };
    }
    if (msg.video)
        return { type: "video", media: msg.video.file_id, ...shared };
    if (msg.audio)
        return { type: "audio", media: msg.audio.file_id, ...shared };
    if (msg.document) {
        return { type: "document", media: msg.document.file_id, ...shared };
    }
    return undefined;
}

function transformed(
    config: RouteConfig,
    msg: Message,
    limit: number
): TextAndEntities {
    const input = contentOf(msg);
    const out = clamp(applyCaption(config.caption, input), limit);
    // A caption rule that quietly does nothing is hard to diagnose from the
    // outside. Only the no-op case is worth a line, and only its length: this
    // instance hosts other people's bots and the text is their users' chat.
    if (out.text === input.text) {
        logger.debug(
            `Caption rules changed nothing (${input.text.length} chars)`
        );
    }
    return out;
}

async function deliverSingle(
    api: Api,
    config: RouteConfig,
    destChatId: number,
    sourceChatId: number,
    msg: Message
) {
    const common = {
        protect_content: config.protectContent,
        disable_notification: config.silent
    };

    if (config.mode === "forward") {
        await api.forwardMessage(
            destChatId,
            sourceChatId,
            msg.message_id,
            common
        );
        return;
    }

    const buttons = config.removeButtons ? undefined : msg.reply_markup;

    if (!hasCaptionTransform(config)) {
        await api.copyMessage(destChatId, sourceChatId, msg.message_id, {
            ...common,
            reply_markup: buttons
        });
        return;
    }

    if (isTextMessage(msg)) {
        // copyMessage's caption is media-only, so text has to be re-sent.
        const out = transformed(config, msg, TEXT_LIMIT);
        if (!out.text) return; // nothing left to send
        await api.sendMessage(destChatId, out.text, {
            ...common,
            entities: out.entities,
            reply_markup: buttons
        });
        return;
    }

    const out = transformed(config, msg, CAPTION_LIMIT);
    await api.copyMessage(destChatId, sourceChatId, msg.message_id, {
        ...common,
        caption: out.text,
        caption_entities: out.entities,
        reply_markup: buttons
    });
}

async function deliverAlbum(
    api: Api,
    config: RouteConfig,
    destChatId: number,
    sourceChatId: number,
    parts: Message[]
) {
    const common = {
        protect_content: config.protectContent,
        disable_notification: config.silent
    };
    const ids = parts.map((p) => p.message_id);

    if (config.mode === "forward") {
        await api.forwardMessages(destChatId, sourceChatId, ids, common);
        return;
    }

    if (!hasCaptionTransform(config)) {
        await api.copyMessages(destChatId, sourceChatId, ids, common);
        return;
    }

    if (config.caption.strip) {
        await api.copyMessages(destChatId, sourceChatId, ids, {
            ...common,
            remove_caption: true
        });
        return;
    }

    // Only captioned parts, so an append does not stamp every image.
    const anyCaptioned = parts.some((p) => p.caption);
    const media = parts.map((part, i) => {
        const carries = part.caption ? true : !anyCaptioned && i === 0;
        return toInputMedia(
            part,
            carries ? transformed(config, part, CAPTION_LIMIT) : undefined
        );
    });

    const kinds = new Set(
        media.filter((m) => m !== undefined).map((m) => family(m))
    );

    if (media.some((m) => m === undefined) || kinds.size > 1) {
        // Unsupported media, or a mix Telegram would reject.
        // ponytail: loses grouping, keeps config.
        logger.debug("Album cannot be sent as one group, falling back");
        for (const part of parts) {
            await deliverSingle(api, config, destChatId, sourceChatId, part);
        }
        return;
    }

    const group = media as GroupMedia[];
    if (kinds.has("audio")) {
        await api.sendMediaGroup(
            destChatId,
            group as InputMediaAudio[],
            common
        );
    } else if (kinds.has("document")) {
        await api.sendMediaGroup(
            destChatId,
            group as InputMediaDocument[],
            common
        );
    } else {
        await api.sendMediaGroup(destChatId, group as VisualMedia[], common);
    }
}

/** One message, or one album, to one destination. */
export async function deliver(
    api: Api,
    route: Route,
    sourceChatId: number,
    parts: Message[]
) {
    const config = parseConfig(route.config);
    if (!passes(config, primaryOf(parts))) return;

    if (parts.length > 1) {
        await deliverAlbum(api, config, route.destChatId, sourceChatId, parts);
    } else {
        await deliverSingle(
            api,
            config,
            route.destChatId,
            sourceChatId,
            parts[0]
        );
    }
}

/** Failures are isolated per destination. */
export async function fanOut(
    api: Api,
    routes: Route[],
    sourceChatId: number,
    parts: Message[]
) {
    for (const route of routes) {
        try {
            await deliver(api, route, sourceChatId, parts);
        } catch (error: any) {
            logger.warn(
                `Forward ${sourceChatId}:${parts[0]?.message_id} -> ` +
                    `${route.destChatId} failed: ${error.description || error.message}`
            );
        }
    }
}
