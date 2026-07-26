import type { Message } from "grammy/types";

/**
 * Album parts arrive as separate updates sharing a media_group_id; buffering
 * lets copyMessages keep them grouped.
 *
 * ponytail: in-process only. On serverless the parts land in different
 * invocations and albums degrade to per-message copies.
 */

export const TELEGRAM_ALBUM_MAX = 10;

export const isAlbumPart = (msg: Message) => msg.media_group_id !== undefined;

type Pending<C> = {
    parts: Message[];
    context: C;
    timer: ReturnType<typeof setTimeout>;
};

/** `C` is what the flush handler needs once the update is gone: the bot's Api. */
export class AlbumBuffer<C> {
    private pending = new Map<string, Pending<C>>();

    constructor(
        private onFlush: (botId: number, parts: Message[], context: C) => void,
        private waitMs = 1000
    ) {}

    private key = (botId: number, msg: Message) =>
        `${botId}:${msg.chat.id}:${msg.media_group_id}`;

    add(botId: number, msg: Message, context: C) {
        const key = this.key(botId, msg);
        const existing = this.pending.get(key);

        if (!existing) {
            this.pending.set(key, {
                parts: [msg],
                context,
                timer: setTimeout(() => this.flush(key, botId), this.waitMs)
            });
            return;
        }

        clearTimeout(existing.timer);
        existing.parts.push(msg);
        if (existing.parts.length >= TELEGRAM_ALBUM_MAX) {
            this.flush(key, botId);
            return;
        }
        existing.timer = setTimeout(() => this.flush(key, botId), this.waitMs);
    }

    private flush(key: string, botId: number) {
        const entry = this.pending.get(key);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(key);
        // copyMessages requires strictly increasing message ids.
        entry.parts.sort((a, b) => a.message_id - b.message_id);
        this.onFlush(botId, entry.parts, entry.context);
    }

    get size() {
        return this.pending.size;
    }
}
