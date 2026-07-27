import { describe, expect, test } from "bun:test";
import type { Message } from "grammy/types";
import {
    AlbumBuffer,
    isAlbumPart,
    TELEGRAM_ALBUM_MAX
} from "../src/forwarding/albums";

const part = (id: number, group?: string, chat = -100) =>
    ({
        message_id: id,
        date: 0,
        chat: { id: chat, type: "channel", title: "src" },
        media_group_id: group,
        photo: []
    }) as unknown as Message;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("isAlbumPart", () => {
    test("true only when media_group_id is present", () => {
        expect(isAlbumPart(part(1, "g1"))).toBe(true);
        expect(isAlbumPart(part(1))).toBe(false);
    });
});

describe("AlbumBuffer", () => {
    test("groups parts and flushes once after the wait", async () => {
        const flushed: Message[][] = [];
        const buf = new AlbumBuffer<null>(
            (_id, parts) => flushed.push(parts),
            30
        );

        buf.add(1, part(10, "g1"), null);
        buf.add(1, part(11, "g1"), null);
        buf.add(1, part(12, "g1"), null);
        expect(flushed).toHaveLength(0);

        await sleep(60);
        expect(flushed).toHaveLength(1);
        expect(flushed[0].map((p) => p.message_id)).toEqual([10, 11, 12]);
    });

    test("flushes in strictly increasing message id order", async () => {
        const flushed: Message[][] = [];
        const buf = new AlbumBuffer<null>(
            (_id, parts) => flushed.push(parts),
            20
        );

        // Updates can arrive out of order; copyMessages requires them sorted.
        buf.add(1, part(12, "g1"), null);
        buf.add(1, part(10, "g1"), null);
        buf.add(1, part(11, "g1"), null);

        await sleep(50);
        expect(flushed[0].map((p) => p.message_id)).toEqual([10, 11, 12]);
    });

    test("the timer resets while parts keep arriving", async () => {
        const flushed: Message[][] = [];
        const buf = new AlbumBuffer<null>(
            (_id, parts) => flushed.push(parts),
            40
        );

        buf.add(1, part(1, "g1"), null);
        await sleep(25);
        buf.add(1, part(2, "g1"), null);
        await sleep(25);
        expect(flushed).toHaveLength(0); // would have fired without the reset

        await sleep(40);
        expect(flushed[0]).toHaveLength(2);
    });

    test("flushes immediately at the Telegram album maximum", () => {
        const flushed: Message[][] = [];
        const buf = new AlbumBuffer<null>(
            (_id, parts) => flushed.push(parts),
            5000
        );

        for (let i = 0; i < TELEGRAM_ALBUM_MAX; i++) {
            buf.add(1, part(i, "g1"), null);
        }
        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toHaveLength(TELEGRAM_ALBUM_MAX);
        expect(buf.size).toBe(0);
    });

    test("separate groups, chats and bots do not mix", async () => {
        const flushed: Message[][] = [];
        const buf = new AlbumBuffer<null>(
            (_id, parts) => flushed.push(parts),
            20
        );

        buf.add(1, part(1, "g1"), null);
        buf.add(1, part(2, "g2"), null);
        buf.add(1, part(3, "g1", -200), null);
        buf.add(2, part(4, "g1"), null);
        expect(buf.size).toBe(4);

        await sleep(50);
        expect(flushed).toHaveLength(4);
        expect(flushed.every((g) => g.length === 1)).toBe(true);
    });

    test("passes the context through to the flush handler", async () => {
        let seen: string | undefined;
        const buf = new AlbumBuffer<string>(
            (_id, _parts, ctx) => (seen = ctx),
            20
        );
        buf.add(1, part(1, "g1"), "api-handle");
        await sleep(50);
        expect(seen).toBe("api-handle");
    });
});
