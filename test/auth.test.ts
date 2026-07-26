import { beforeAll, describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";

import { verifyInitData } from "../src/api/auth";

const BOT_ID = 7342037359;
const NOW = 1_800_000_000_000; // fixed clock
const AUTH_DATE = Math.floor(NOW / 1000) - 10;

let publicKeyHex: string;
let signInitData: (fields: Record<string, string>, botId?: number) => string;

beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    publicKeyHex = publicKey
        .export({ format: "der", type: "spki" })
        .subarray(12)
        .toString("hex");

    signInitData = (fields, botId = BOT_ID) => {
        const pairs = Object.entries(fields)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => `${k}=${v}`);
        const dcs = [`${botId}:WebAppData`, ...pairs].join("\n");
        const signature = sign(null, Buffer.from(dcs, "utf8"), privateKey)
            .toString("base64url");

        const params = new URLSearchParams(fields);
        params.set("signature", signature);
        params.set("hash", "irrelevant-for-ed25519");
        return params.toString();
    };
});

const validFields = () => ({
    auth_date: String(AUTH_DATE),
    chat_instance: "-12345",
    user: JSON.stringify({ id: 42, username: "owner" })
});

const opts = () => ({ publicKeyHex, now: NOW });

describe("verifyInitData", () => {
    test("accepts correctly signed initData", () => {
        const r = verifyInitData(signInitData(validFields()), BOT_ID, opts());
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.user.id).toBe(42);
            expect(r.user.username).toBe("owner");
        }
    });

    test("rejects a tampered field", () => {
        const initData = signInitData(validFields());
        const tampered = initData.replace("%22id%22%3A42", "%22id%22%3A99");
        expect(tampered).not.toBe(initData); // the tamper must actually apply
        const r = verifyInitData(tampered, BOT_ID, opts());
        expect(r.ok).toBe(false);
    });

    test("rejects a different bot_id than the one signed", () => {
        // This is what makes it safe for the client to supply bot_id: a wrong
        // value simply fails verification.
        const r = verifyInitData(signInitData(validFields()), 999999, opts());
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("verification failed");
    });

    test("rejects stale initData", () => {
        const stale = { ...validFields(), auth_date: String(AUTH_DATE - 3600) };
        const r = verifyInitData(signInitData(stale), BOT_ID, opts());
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("expired");
    });

    test("accepts initData inside the freshness window", () => {
        const recent = { ...validFields(), auth_date: String(AUTH_DATE - 200) };
        expect(verifyInitData(signInitData(recent), BOT_ID, opts()).ok).toBe(true);
    });

    test("fails closed when signature is absent", () => {
        const params = new URLSearchParams(validFields());
        params.set("hash", "deadbeef");
        const r = verifyInitData(params.toString(), BOT_ID, opts());
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("missing signature");
    });

    test("rejects a signature that is not valid base64url", () => {
        const initData = signInitData(validFields());
        const broken = initData.replace(/signature=[^&]*/, "signature=!!!!");
        expect(verifyInitData(broken, BOT_ID, opts()).ok).toBe(false);
    });

    test("rejects a signature from the wrong key", () => {
        const r = verifyInitData(signInitData(validFields()), BOT_ID, {
            ...opts(),
            publicKeyHex:
                "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d"
        });
        expect(r.ok).toBe(false);
    });

    test("rejects a nonsense bot_id", () => {
        expect(verifyInitData(signInitData(validFields()), 0, opts()).ok).toBe(
            false
        );
        expect(verifyInitData(signInitData(validFields()), -5, opts()).ok).toBe(
            false
        );
    });

    test("rejects when the user field is missing", () => {
        const { user, ...rest } = validFields();
        const r = verifyInitData(signInitData(rest), BOT_ID, opts());
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("user");
    });

    test("field order in the query string does not matter", () => {
        // The data-check-string sorts, so a reordered query still verifies.
        const initData = signInitData(validFields());
        const params = new URLSearchParams(initData);
        const reversed = new URLSearchParams(
            [...params.entries()].reverse()
        ).toString();
        expect(verifyInitData(reversed, BOT_ID, opts()).ok).toBe(true);
    });
});
