import { describe, expect, mock, test } from "bun:test";

const stops: { chatId: number; status: string; scope: string }[] = [];

mock.module("../src/store", () => ({
    default: {
        stopRoutesForChat: async (
            _botId: number,
            chatId: number,
            status: string,
            scope: string
        ) => {
            stops.push({ chatId, status, scope });
            return 1;
        }
    }
}));

const { default: handler } = await import("../src/handlers/my_chat_member");

const ctx = (chatType: string, member: any) =>
    ({
        me: { id: 1 },
        myChatMember: {
            chat: { id: -100123, type: chatType },
            new_chat_member: member
        }
    }) as any;

const run = async (chatType: string, member: any) => {
    stops.length = 0;
    await handler(ctx(chatType, member));
    return stops[0];
};

describe("my_chat_member", () => {
    test("being kicked from a group stops both directions", async () => {
        expect(await run("supergroup", { status: "kicked" })).toEqual({
            chatId: -100123,
            status: "removed",
            scope: "any"
        });
    });

    test("leaving a chat stops both directions", async () => {
        expect(await run("group", { status: "left" })).toEqual({
            chatId: -100123,
            status: "removed",
            scope: "any"
        });
    });

    test("a person blocking the bot reads as blocked, not removed", async () => {
        expect(await run("private", { status: "kicked" })).toEqual({
            chatId: -100123,
            status: "blocked",
            scope: "any"
        });
    });

    test("losing the right to send stops destinations only", async () => {
        // The bot can still read, so a source keeps working.
        expect(
            await run("supergroup", {
                status: "restricted",
                can_send_messages: false
            })
        ).toEqual({
            chatId: -100123,
            status: "no_rights",
            scope: "destination"
        });
    });

    test("a restricted bot that may still send is left alone", async () => {
        expect(
            await run("supergroup", {
                status: "restricted",
                can_send_messages: true
            })
        ).toBeUndefined();
    });

    test("demotion in a channel stops both directions", async () => {
        expect(await run("channel", { status: "member" })).toEqual({
            chatId: -100123,
            status: "not_admin",
            scope: "any"
        });
    });

    test("a channel admin is left alone", async () => {
        expect(
            await run("channel", { status: "administrator" })
        ).toBeUndefined();
    });

    test("being added to a group is not a reason to stop anything", async () => {
        expect(await run("supergroup", { status: "member" })).toBeUndefined();
        expect(
            await run("supergroup", { status: "administrator" })
        ).toBeUndefined();
    });
});
