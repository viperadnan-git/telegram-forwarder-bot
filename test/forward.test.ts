import { describe, expect, test } from "bun:test";
import type { Api } from "grammy";
import type { Message } from "grammy/types";
import { deliver, fanOut } from "../src/forward";
import type { Route } from "../src/store";

type Call = { method: string; args: any[] };

function stubApi() {
    const calls: Call[] = [];
    const record =
        (method: string) =>
        (...args: any[]) => {
            calls.push({ method, args });
            return Promise.resolve({} as any);
        };
    const api = {
        copyMessage: record("copyMessage"),
        copyMessages: record("copyMessages"),
        forwardMessage: record("forwardMessage"),
        forwardMessages: record("forwardMessages"),
        sendMessage: record("sendMessage"),
        sendMediaGroup: record("sendMediaGroup")
    } as unknown as Api;
    return { api, calls };
}

const SRC = -1001;
const route = (config: unknown = {}): Route => ({
    destChatId: -2002,
    config: config as any
});

const textMsg = (text = "hello world"): Message =>
    ({
        message_id: 5,
        date: 0,
        chat: { id: SRC, type: "channel", title: "s" },
        text
    }) as Message;

const photoMsg = (caption = "a caption"): Message =>
    ({
        message_id: 6,
        date: 0,
        chat: { id: SRC, type: "channel", title: "s" },
        photo: [{ file_id: "F1", file_unique_id: "u", width: 1, height: 1 }],
        caption
    }) as Message;

const albumPart = (id: number, caption?: string): Message =>
    ({
        message_id: id,
        date: 0,
        chat: { id: SRC, type: "channel", title: "s" },
        media_group_id: "g1",
        photo: [
            { file_id: `F${id}`, file_unique_id: "u", width: 1, height: 1 }
        ],
        caption
    }) as Message;

describe("single message dispatch", () => {
    test("no transform uses copyMessage", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route(), SRC, [photoMsg()]);
        expect(calls.map((c) => c.method)).toEqual(["copyMessage"]);
        expect(calls[0].args[3].caption).toBeUndefined();
    });

    test("forward mode uses forwardMessage", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ mode: "forward" }), SRC, [photoMsg()]);
        expect(calls.map((c) => c.method)).toEqual(["forwardMessage"]);
    });

    test("protectContent and silent are passed through", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ protectContent: true, silent: true }), SRC, [
            photoMsg()
        ]);
        expect(calls[0].args[3]).toMatchObject({
            protect_content: true,
            disable_notification: true
        });
    });

    test("media with a caption transform uses copyMessage with a new caption", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { append: "[x]" } }), SRC, [
            photoMsg("a caption")
        ]);
        expect(calls[0].method).toBe("copyMessage");
        expect(calls[0].args[3].caption).toBe("a caption\n[x]");
    });

    test("text with a transform uses sendMessage, since copyMessage cannot alter text", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { prepend: ">>" } }), SRC, [
            textMsg("hello")
        ]);
        expect(calls[0].method).toBe("sendMessage");
        expect(calls[0].args[1]).toBe(">>\nhello");
    });

    test("stripping a text message sends nothing", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { strip: true } }), SRC, [
            textMsg()
        ]);
        expect(calls).toHaveLength(0);
    });

    test("a blacklisted message is not delivered", async () => {
        const { api, calls } = stubApi();
        await deliver(
            api,
            route({
                filters: { blacklist: [{ type: "keyword", value: "spam" }] }
            }),
            SRC,
            [textMsg("this is spam")]
        );
        expect(calls).toHaveLength(0);
    });

    test("a whitelisted message is delivered", async () => {
        const { api, calls } = stubApi();
        await deliver(
            api,
            route({
                filters: { whitelist: [{ type: "keyword", value: "btc" }] }
            }),
            SRC,
            [textMsg("btc news")]
        );
        expect(calls).toHaveLength(1);
    });
});

describe("album dispatch", () => {
    const parts = [albumPart(1, "cap"), albumPart(2), albumPart(3)];

    test("no transform uses copyMessages, preserving grouping", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route(), SRC, parts);
        expect(calls[0].method).toBe("copyMessages");
        expect(calls[0].args[2]).toEqual([1, 2, 3]);
    });

    test("forward mode uses forwardMessages", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ mode: "forward" }), SRC, parts);
        expect(calls[0].method).toBe("forwardMessages");
    });

    test("strip uses copyMessages with remove_caption", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { strip: true } }), SRC, parts);
        expect(calls[0].method).toBe("copyMessages");
        expect(calls[0].args[3].remove_caption).toBe(true);
    });

    test("a caption transform rebuilds the group with sendMediaGroup", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { append: "!" } }), SRC, parts);
        expect(calls[0].method).toBe("sendMediaGroup");
        const media = calls[0].args[1];
        expect(media).toHaveLength(3);
        expect(media[0]).toMatchObject({
            type: "photo",
            media: "F1",
            caption: "cap\n!"
        });
        // Uncaptioned parts stay uncaptioned; an append must not stamp every image.
        expect(media[1].caption).toBeUndefined();
        expect(media[2].caption).toBeUndefined();
    });

    test("with no captions anywhere, the append lands on the first part only", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { append: "sig" } }), SRC, [
            albumPart(1),
            albumPart(2)
        ]);
        const media = calls[0].args[1];
        expect(media[0].caption).toBe("sig");
        expect(media[1].caption).toBeUndefined();
    });

    test("unsupported media in a group falls back to per-message copies", async () => {
        const { api, calls } = stubApi();
        const withSticker = [
            albumPart(1, "cap"),
            {
                message_id: 2,
                date: 0,
                chat: { id: SRC, type: "channel", title: "s" },
                media_group_id: "g1",
                sticker: { file_id: "S" }
            } as unknown as Message
        ];
        await deliver(
            api,
            route({ caption: { append: "!" } }),
            SRC,
            withSticker
        );
        expect(calls.every((c) => c.method === "copyMessage")).toBe(true);
        expect(calls).toHaveLength(2);
    });

    test("filters use the captioned part for the whole album", async () => {
        const { api, calls } = stubApi();
        await deliver(
            api,
            route({
                filters: { blacklist: [{ type: "keyword", value: "cap" }] }
            }),
            SRC,
            parts
        );
        expect(calls).toHaveLength(0);
    });
});

describe("fanOut", () => {
    test("one failing destination does not stop the others", async () => {
        const calls: string[] = [];
        const api = {
            copyMessage: (dest: number) => {
                calls.push(`copy:${dest}`);
                if (dest === -2)
                    return Promise.reject(new Error("chat not found"));
                return Promise.resolve({} as any);
            }
        } as unknown as Api;

        await fanOut(
            api,
            [
                { destChatId: -1, config: {} },
                { destChatId: -2, config: {} },
                { destChatId: -3, config: {} }
            ],
            SRC,
            [photoMsg()]
        );
        expect(calls).toEqual(["copy:-1", "copy:-2", "copy:-3"]);
    });
});

describe("removeButtons", () => {
    const withButtons = (): Message =>
        ({
            message_id: 7,
            date: 0,
            chat: { id: SRC, type: "channel", title: "s" },
            photo: [
                { file_id: "F1", file_unique_id: "u", width: 1, height: 1 }
            ],
            caption: "cap",
            reply_markup: {
                inline_keyboard: [[{ text: "Ad", url: "https://spam.example" }]]
            }
        }) as Message;

    test("buttons are carried over by default", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route(), SRC, [withButtons()]);
        expect(calls[0].args[3].reply_markup).toBeDefined();
    });

    test("removeButtons drops them", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ removeButtons: true }), SRC, [
            withButtons()
        ]);
        expect(calls[0].method).toBe("copyMessage");
        expect(calls[0].args[3].reply_markup).toBeUndefined();
    });

    test("removeButtons also applies when the caption is transformed", async () => {
        const { api, calls } = stubApi();
        await deliver(
            api,
            route({ removeButtons: true, caption: { append: "!" } }),
            SRC,
            [withButtons()]
        );
        expect(calls[0].args[3].caption).toBe("cap\n!");
        expect(calls[0].args[3].reply_markup).toBeUndefined();
    });

    test("and on a re-sent text message", async () => {
        const { api, calls } = stubApi();
        const msg = {
            ...textMsg("hello"),
            reply_markup: {
                inline_keyboard: [[{ text: "Ad", url: "https://x.example" }]]
            }
        } as Message;
        await deliver(
            api,
            route({ removeButtons: true, caption: { prepend: ">" } }),
            SRC,
            [msg]
        );
        expect(calls[0].method).toBe("sendMessage");
        expect(calls[0].args[2].reply_markup).toBeUndefined();
    });
});

describe("media group families", () => {
    const audioPart = (id: number, caption?: string): Message =>
        ({
            message_id: id,
            date: 0,
            chat: { id: SRC, type: "channel", title: "s" },
            media_group_id: "g1",
            audio: { file_id: `A${id}`, duration: 1 },
            caption
        }) as Message;

    test("an all-audio group is still sent as one group", async () => {
        const { api, calls } = stubApi();
        await deliver(api, route({ caption: { append: "!" } }), SRC, [
            audioPart(1, "cap"),
            audioPart(2)
        ]);
        expect(calls[0].method).toBe("sendMediaGroup");
        expect(calls[0].args[1][0]).toMatchObject({ type: "audio" });
    });

    test("mixing audio with photos falls back to per-message", async () => {
        const { api, calls } = stubApi();
        // Telegram rejects a group mixing audio with photos.
        await deliver(api, route({ caption: { append: "!" } }), SRC, [
            albumPart(1, "cap"),
            audioPart(2)
        ]);
        expect(calls.every((c) => c.method === "copyMessage")).toBe(true);
        expect(calls).toHaveLength(2);
    });
});
