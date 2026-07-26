import { RouteConfig, hasCaptionTransform, parseConfig } from "./config";
import { TextAndEntities, applyCaption, clamp } from "./transforms";

import type { Api } from "grammy";
import type { InputMediaAudio, InputMediaDocument, InputMediaPhoto, InputMediaVideo, Message } from "grammy/types";
import type { Route } from "./store";
import logger from "./modules/logger";
import { passes } from "./filters";

const TEXT_LIMIT = 4096;
const CAPTION_LIMIT = 1024;

const isTextMessage = (msg: Message) => msg.text !== undefined;

const contentOf = (msg: Message): TextAndEntities => ({
    text: msg.text ?? msg.caption ?? "",
    entities: msg.entities ?? msg.caption_entities ?? []
});

/** The captioned part decides filtering for the whole album. */
const primaryOf = (parts: Message[]) =>
    parts.find((p) => (p.caption ?? p.text)) ?? parts[0];

type GroupMedia =
    | InputMediaPhoto
    | InputMediaVideo
    | InputMediaAudio
    | InputMediaDocument;

function toInputMedia(
    msg: Message,
    caption: TextAndEntities | undefined
): GroupMedia | undefined {
    const shared = caption
        ? { caption: caption.text || undefined, caption_entities: caption.entities }
        : {};

    if (msg.photo?.length) {
        return { type: "photo", media: msg.photo[msg.photo.length - 1].file_id, ...shared };
    }
    if (msg.video) return { type: "video", media: msg.video.file_id, ...shared };
    if (msg.audio) return { type: "audio", media: msg.audio.file_id, ...shared };
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
    return clamp(applyCaption(config.caption, contentOf(msg)), limit);
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
        await api.forwardMessage(destChatId, sourceChatId, msg.message_id, common);
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

    if (media.some((m) => m === undefined)) {
        // ponytail: loses grouping, keeps config.
        logger.debug("Album has unsupported media, falling back to per-message");
        for (const part of parts) {
            await deliverSingle(api, config, destChatId, sourceChatId, part);
        }
        return;
    }

    await api.sendMediaGroup(destChatId, media as GroupMedia[], common);
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
        await deliverSingle(api, config, route.destChatId, sourceChatId, parts[0]);
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
