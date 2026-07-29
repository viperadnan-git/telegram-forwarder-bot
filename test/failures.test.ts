import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Api } from "grammy";
import { GrammyError } from "grammy";
import type { Message } from "grammy/types";
import type { Route } from "../src/store";

const stopped: { id: string; status: string }[] = [];
const migrated: { from: number; to: number }[] = [];

// The real store needs a database; fanOut only makes these two calls.
mock.module("../src/store", () => ({
    default: {
        stopRoute: async (_botId: number, id: string, status: string) => {
            stopped.push({ id, status });
        },
        migrateChat: async (from: number, to: number) => {
            migrated.push({ from, to });
        }
    }
}));

const { fanOut } = await import("../src/forwarding/forward");
const { checkChatId } = await import("../src/forwarding/health");

const tgError = (
    error_code: number,
    description: string,
    parameters: Record<string, unknown> = {}
) =>
    new GrammyError(
        "Call to 'copyMessage' failed!",
        { ok: false, error_code, description, parameters } as any,
        "copyMessage",
        {}
    );

const SRC = -1001;
const ROUTE: Route = {
    id: "00000000-0000-7000-8000-000000000001",
    destChatId: -2002,
    config: {} as any
};

const msg = (): Message =>
    ({
        message_id: 7,
        date: 0,
        chat: { id: SRC, type: "channel", title: "s" },
        text: "hi"
    }) as Message;

/** Fails every send until `until` calls have been made. */
const failingApi = (error: unknown, until = Number.POSITIVE_INFINITY) => {
    const dests: number[] = [];
    const api = {
        copyMessage: (dest: number) => {
            dests.push(dest);
            return dests.length <= until
                ? Promise.reject(error)
                : Promise.resolve({} as any);
        }
    } as unknown as Api;
    return { api, dests };
};

describe("fanOut acts on the verdict", () => {
    beforeEach(() => {
        stopped.length = 0;
        migrated.length = 0;
    });

    test("a permanent failure stops that route with its status", async () => {
        const { api } = failingApi(
            tgError(403, "Forbidden: bot was kicked from the channel chat")
        );
        await fanOut(api, 1, [ROUTE], SRC, [msg()]);
        expect(stopped).toEqual([{ id: ROUTE.id, status: "removed" }]);
    });

    test("a transient failure leaves the route alone", async () => {
        const { api } = failingApi(tgError(500, "Internal Server Error"));
        await fanOut(api, 1, [ROUTE], SRC, [msg()]);
        expect(stopped).toEqual([]);
        expect(migrated).toEqual([]);
    });

    test("a content-level failure leaves the route alone", async () => {
        const { api } = failingApi(
            tgError(
                400,
                "Bad Request: not enough rights to send photos to the chat"
            )
        );
        await fanOut(api, 1, [ROUTE], SRC, [msg()]);
        expect(stopped).toEqual([]);
    });

    const migrateError = (to: number) =>
        tgError(
            400,
            "Bad Request: group chat was upgraded to a supergroup chat",
            { migrate_to_chat_id: to }
        );

    test("a migrated destination moves and the message re-sends", async () => {
        const dests: number[] = [];
        const api = {
            copyMessage: (dest: number) => {
                dests.push(dest);
                return dest === -2002
                    ? Promise.reject(migrateError(-1009999))
                    : Promise.resolve({} as any);
            },
            getChat: (id: number) =>
                id === -2002
                    ? Promise.reject(migrateError(-1009999))
                    : Promise.resolve({ id, type: "supergroup" } as any),
            getChatMember: async () => ({ status: "member" })
        } as unknown as Api;

        await fanOut(api, 1, [ROUTE], SRC, [msg()]);

        expect(migrated).toEqual([{ from: -2002, to: -1009999 }]);
        expect(dests).toEqual([-2002, -1009999]);
        expect(stopped).toEqual([]);
    });

    test("a migrated source does not rewrite the destination", async () => {
        // The error names no chat. Here it is the source that moved, so the
        // destination must be left exactly as it is.
        const dests: number[] = [];
        const api = {
            copyMessage: (dest: number) => {
                dests.push(dest);
                return Promise.reject(migrateError(-1007777));
            },
            getChat: async (id: number) => ({ id, type: "supergroup" }) as any,
            getChatMember: async () => ({ status: "member" })
        } as unknown as Api;

        await fanOut(api, 1, [ROUTE], SRC, [msg()]);

        expect(migrated).toEqual([]);
        expect(dests).toEqual([-2002]);
        expect(stopped).toEqual([]);
    });

    test("a check on a migrated chat moves it and answers for the new id", async () => {
        const looked: number[] = [];
        const api = {
            getChat: (id: number) => {
                looked.push(id);
                return id === -2002
                    ? Promise.reject(
                          tgError(
                              400,
                              "Bad Request: group chat was upgraded to a supergroup chat",
                              { migrate_to_chat_id: -1009999 }
                          )
                      )
                    : Promise.resolve({ id, type: "supergroup" } as any);
            },
            getChatMember: async () => ({ status: "member" })
        } as unknown as Api;

        const result = await checkChatId(api, 1, -2002, "destination");

        expect(result.ok).toBe(true);
        expect(migrated).toEqual([{ from: -2002, to: -1009999 }]);
        expect(looked).toEqual([-2002, -1009999]);
    });

    test("a chat that migrates twice is a loop, not a hop", async () => {
        const api = {
            getChat: (id: number) =>
                Promise.reject(
                    tgError(
                        400,
                        "Bad Request: group chat was upgraded to a supergroup chat",
                        { migrate_to_chat_id: id - 1 }
                    )
                ),
            getChatMember: async () => ({ status: "member" })
        } as unknown as Api;

        const result = await checkChatId(api, 1, -2002, "destination");
        expect(result.ok).toBe(false);
        expect(migrated).toHaveLength(1);
    });

    test("one broken destination does not stop the rest", async () => {
        const err = tgError(403, "Forbidden: bot was blocked by the user");
        const dests: number[] = [];
        const api = {
            copyMessage: (dest: number) => {
                dests.push(dest);
                return dest === -2
                    ? Promise.reject(err)
                    : Promise.resolve({} as any);
            }
        } as unknown as Api;

        await fanOut(
            api,
            1,
            [
                { ...ROUTE, id: "a", destChatId: -1 },
                { ...ROUTE, id: "b", destChatId: -2 },
                { ...ROUTE, id: "c", destChatId: -3 }
            ],
            SRC,
            [msg()]
        );

        expect(dests).toEqual([-1, -2, -3]);
        expect(stopped).toEqual([{ id: "b", status: "blocked" }]);
    });
});
