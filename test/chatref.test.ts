import { describe, expect, test } from "bun:test";

import { parseChatRef } from "../src/chatref";

const id = (input: string) => {
    const r = parseChatRef(input);
    if (!r.ok || r.ref.kind !== "id") throw new Error(`expected id, got ${JSON.stringify(r)}`);
    return r.ref.id;
};

const username = (input: string) => {
    const r = parseChatRef(input);
    if (!r.ok || r.ref.kind !== "username")
        throw new Error(`expected username, got ${JSON.stringify(r)}`);
    return r.ref.username;
};

const fails = (input: string) => parseChatRef(input).ok === false;

describe("raw ids", () => {
    test("negative channel id", () => expect(id("-1001234567890")).toBe(-1001234567890));
    test("positive user id", () => expect(id("12345")).toBe(12345));
    test("surrounding whitespace", () => expect(id("  -100123  ")).toBe(-100123));
    test("beyond safe integer is rejected", () =>
        expect(fails("999999999999999999999")).toBe(true));
});

describe("usernames", () => {
    test("with @", () => expect(username("@durov")).toBe("durov"));
    test("bare", () => expect(username("durov")).toBe("durov"));
    test("underscores and digits", () => expect(username("my_chan_99")).toBe("my_chan_99"));
    test("too short is rejected", () => expect(fails("@ab")).toBe(true));
    test("leading digit is rejected", () => expect(fails("@1channel")).toBe(true));
    test("empty is rejected", () => expect(fails("   ")).toBe(true));
});

describe("public links", () => {
    test("chat link", () => expect(username("https://t.me/durov")).toBe("durov"));
    test("message link keeps the chat, drops the message id", () =>
        expect(username("https://t.me/durov/123")).toBe("durov"));
    test("without scheme", () => expect(username("t.me/durov")).toBe("durov"));
    test("with www", () => expect(username("https://www.t.me/durov")).toBe("durov"));
    test("telegram.me mirror", () =>
        expect(username("https://telegram.me/durov/5")).toBe("durov"));
    test("preview link t.me/s/name", () =>
        expect(username("https://t.me/s/durov")).toBe("durov"));
    test("query string is ignored", () =>
        expect(username("https://t.me/durov?single")).toBe("durov"));
    test("trailing slash", () => expect(username("https://t.me/durov/")).toBe("durov"));
});

describe("private links", () => {
    test("message link yields the -100 prefixed id", () =>
        expect(id("https://t.me/c/1234567890/42")).toBe(-1001234567890));
    test("without a message id", () =>
        expect(id("https://t.me/c/1234567890")).toBe(-1001234567890));
    test("comment thread link", () =>
        expect(id("https://t.me/c/2246789012/8/9")).toBe(-1002246789012));
    test("missing id is rejected", () => expect(fails("https://t.me/c/")).toBe(true));
});

describe("unsupported", () => {
    test("invite link explains what to do instead", () => {
        const r = parseChatRef("https://t.me/+AbCdEfGh123");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("Invite links");
    });
    test("joinchat link", () => {
        const r = parseChatRef("https://t.me/joinchat/AbCdEf");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("Invite links");
    });
    test("non-telegram host", () => expect(fails("https://example.com/durov")).toBe(true));
    test("bare t.me with no path", () => expect(fails("https://t.me/")).toBe(true));
});
