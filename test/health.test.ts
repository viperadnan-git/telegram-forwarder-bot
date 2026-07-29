import { describe, expect, test } from "bun:test";
import { GrammyError } from "grammy";
import { checkChat, classify } from "../src/forwarding/health";
import { ROUTE_STATUS } from "../src/schema";

const tgError = (
    error_code: number,
    description: string,
    parameters: Record<string, unknown> = {}
) =>
    new GrammyError(
        "Call to 'sendMessage' failed!",
        { ok: false, error_code, description, parameters } as any,
        "sendMessage",
        {}
    );

describe("classify", () => {
    const permanent = [
        [403, "Forbidden: bot was kicked from the supergroup chat"],
        [403, "Forbidden: bot was kicked from the channel chat"],
        [403, "Forbidden: bot is not a member of the channel chat"],
        [403, "Forbidden: bot was blocked by the user"],
        [403, "Forbidden: bot can't initiate conversation with a user"],
        [403, "Forbidden: bot can't send messages to bots"],
        [403, "Forbidden: user is deactivated"],
        [400, "Bad Request: chat not found"],
        [400, "Bad Request: PEER_ID_INVALID"],
        [400, "Bad Request: group chat was deactivated"],
        [400, "Bad Request: CHAT_WRITE_FORBIDDEN"],
        [403, "Forbidden: CHAT_WRITE_FORBIDDEN"],
        [400, "Bad Request: have no rights to send a message"],
        [
            400,
            "Bad Request: not enough rights to send text messages to the chat"
        ],
        [400, "Bad Request: need administrator rights in the channel chat"],
        [400, "Bad Request: CHAT_ADMIN_REQUIRED"]
    ] as const;

    for (const [code, description] of permanent) {
        test(`permanent: ${description}`, () => {
            const verdict = classify(tgError(code, description));
            expect(verdict.kind).toBe("permanent");
            if (verdict.kind === "permanent") {
                expect(verdict.status in ROUTE_STATUS).toBe(true);
            }
        });
    }

    // These fail one message, not the route.
    const content = [
        "Bad Request: not enough rights to send photos to the chat",
        "Bad Request: not enough rights to send voice messages to the chat",
        "Bad Request: message text is empty",
        "Bad Request: message is too long",
        "Bad Request: entities too long",
        "Bad Request: wrong file identifier/HTTP URL specified",
        "Bad Request: file is too big",
        "Bad Request: failed to get HTTP URL content",
        "Bad Request: message to copy not found",
        "Bad Request: MESSAGE_ID_INVALID",
        "Bad Request: reply message not found"
    ];

    for (const description of content) {
        test(`content-level, keeps the route: ${description}`, () => {
            expect(classify(tgError(400, description)).kind).toBe("transient");
        });
    }

    test("a media-rights error does not match the text-rights rule", () => {
        const photos = classify(
            tgError(
                400,
                "Bad Request: not enough rights to send photos to the chat"
            )
        );
        const text = classify(
            tgError(
                400,
                "Bad Request: not enough rights to send text messages to the chat"
            )
        );
        expect(photos.kind).toBe("transient");
        expect(text.kind).toBe("permanent");
    });

    test("rate limits are transient", () => {
        const verdict = classify(
            tgError(429, "Too Many Requests: retry after 30", {
                retry_after: 30
            })
        );
        expect(verdict.kind).toBe("transient");
    });

    test("server errors are transient", () => {
        expect(classify(tgError(500, "Internal Server Error")).kind).toBe(
            "transient"
        );
        expect(classify(tgError(502, "Bad Gateway")).kind).toBe("transient");
    });

    test("a network failure never reached Telegram, so it is transient", () => {
        expect(classify(new Error("fetch failed")).kind).toBe("transient");
        expect(classify(undefined).kind).toBe("transient");
    });

    test("unknown wording defaults to transient", () => {
        expect(
            classify(tgError(400, "Bad Request: something Telegram reworded"))
                .kind
        ).toBe("transient");
    });

    test("a revoked token is bot-level and must not disable routes", () => {
        expect(classify(tgError(401, "Unauthorized")).kind).toBe("transient");
    });

    test("migration is keyed on the new id, not the wording", () => {
        const verdict = classify(
            tgError(
                400,
                "Bad Request: group chat was upgraded to a supergroup chat",
                { migrate_to_chat_id: -1001234567890 }
            )
        );
        expect(verdict).toEqual({
            kind: "migrate",
            toChatId: -1001234567890
        });
    });

    test("migration outranks a permanent match on the same error", () => {
        const verdict = classify(
            tgError(400, "Bad Request: chat not found", {
                migrate_to_chat_id: -100999
            })
        );
        expect(verdict.kind).toBe("migrate");
    });
});

describe("checkChat", () => {
    const api = (member: any) =>
        ({
            getChatMember: async () => {
                if (member instanceof Error) throw member;
                return member;
            }
        }) as any;

    const chat = (type: string) => ({ id: -100123, type }) as any;

    test("a person cannot be tested without messaging them", async () => {
        const result = await checkChat(
            api(new Error("never called")),
            1,
            chat("private"),
            "destination"
        );
        expect(result.ok).toBe(true);
    });

    test("a channel admin that can post is usable as a destination", async () => {
        const result = await checkChat(
            api({ status: "administrator", can_post_messages: true }),
            1,
            chat("channel"),
            "destination"
        );
        expect(result.ok).toBe(true);
    });

    test("a channel admin without post rights is not a destination", async () => {
        const result = await checkChat(
            api({ status: "administrator", can_post_messages: false }),
            1,
            chat("channel"),
            "destination"
        );
        expect(result).toEqual({ ok: false, reason: "no_rights" });
    });

    test("post rights are irrelevant to a channel source", async () => {
        const result = await checkChat(
            api({ status: "administrator", can_post_messages: false }),
            1,
            chat("channel"),
            "source"
        );
        expect(result.ok).toBe(true);
    });

    test("a non-admin sees no channel posts", async () => {
        const result = await checkChat(
            api({ status: "member" }),
            1,
            chat("channel"),
            "source"
        );
        expect(result.ok).toBe(false);
    });

    test("plain membership is enough for a group", async () => {
        for (const type of ["group", "supergroup"]) {
            const result = await checkChat(
                api({ status: "member" }),
                1,
                chat(type),
                "destination"
            );
            expect(result.ok).toBe(true);
        }
    });

    test("a restricted bot that cannot send is rejected", async () => {
        const result = await checkChat(
            api({ status: "restricted", can_send_messages: false }),
            1,
            chat("supergroup"),
            "destination"
        );
        expect(result).toEqual({ ok: false, reason: "no_rights" });
    });

    test("left and kicked are rejected", async () => {
        for (const status of ["left", "kicked"]) {
            const result = await checkChat(
                api({ status }),
                1,
                chat("supergroup"),
                "destination"
            );
            expect(result.ok).toBe(false);
        }
    });

    test("a failed lookup reports the classified reason", async () => {
        const result = await checkChat(
            api(
                tgError(
                    403,
                    "Forbidden: bot was kicked from the supergroup chat"
                )
            ),
            1,
            chat("supergroup"),
            "destination"
        );
        expect(result).toEqual({ ok: false, reason: "removed" });
    });
});

describe("checkChat separates cannot-verify from broken", () => {
    const failing = (err: unknown) =>
        ({
            getChatMember: async () => {
                throw err;
            }
        }) as any;

    test("a server error reports unavailable, not gone", async () => {
        const result = await checkChat(
            failing(tgError(500, "Internal Server Error")),
            1,
            { id: -100123, type: "supergroup" } as any,
            "destination"
        );
        expect(result).toEqual({ ok: false, reason: "unavailable" });
    });

    test("a network failure reports unavailable", async () => {
        const result = await checkChat(
            failing(new Error("fetch failed")),
            1,
            { id: -100123, type: "supergroup" } as any,
            "destination"
        );
        expect(result).toEqual({ ok: false, reason: "unavailable" });
    });
});
