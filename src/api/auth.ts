import { createPublicKey, verify } from "node:crypto";

/**
 * Ed25519 validation of Mini App initData. Chosen over HMAC-SHA256 so no bot
 * tokens need storing: HMAC would need every cloned bot's token.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export const TELEGRAM_PUBLIC_KEY_PROD =
    "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
export const TELEGRAM_PUBLIC_KEY_TEST =
    "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec";

// SPKI DER prefix for a raw 32-byte Ed25519 key.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const publicKeyFromHex = (hex: string) =>
    createPublicKey({
        key: Buffer.concat([SPKI_PREFIX, Buffer.from(hex, "hex")]),
        format: "der",
        type: "spki"
    });

export type TelegramUser = {
    id: number;
    username?: string;
    first_name?: string;
};

export type VerifyOptions = {
    publicKeyHex?: string;
    maxAgeSeconds?: number;
    now?: number;
};

export type VerifyResult =
    | { ok: true; user: TelegramUser; authDate: number }
    | { ok: false; error: string };

export function verifyInitData(
    initData: string,
    botId: number,
    opts: VerifyOptions = {}
): VerifyResult {
    const {
        publicKeyHex = TELEGRAM_PUBLIC_KEY_PROD,
        maxAgeSeconds = 300,
        now = Date.now()
    } = opts;

    if (!Number.isSafeInteger(botId) || botId <= 0) {
        return { ok: false, error: "invalid bot_id" };
    }

    let params: URLSearchParams;
    try {
        params = new URLSearchParams(initData);
    } catch {
        return { ok: false, error: "malformed initData" };
    }

    const signature = params.get("signature");
    // Fail closed: an HMAC fallback would mean storing tokens.
    if (!signature) return { ok: false, error: "missing signature" };

    const pairs = [...params.entries()]
        .filter(([key]) => key !== "hash" && key !== "signature")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`);

    const dataCheckString = [`${botId}:WebAppData`, ...pairs].join("\n");

    let valid: boolean;
    try {
        valid = verify(
            null,
            Buffer.from(dataCheckString, "utf8"),
            publicKeyFromHex(publicKeyHex),
            Buffer.from(signature, "base64url")
        );
    } catch {
        return { ok: false, error: "malformed signature" };
    }
    if (!valid) return { ok: false, error: "signature verification failed" };

    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate) || authDate <= 0) {
        return { ok: false, error: "missing auth_date" };
    }
    const ageSeconds = now / 1000 - authDate;
    if (ageSeconds > maxAgeSeconds) {
        return { ok: false, error: "initData has expired" };
    }

    const rawUser = params.get("user");
    if (!rawUser) return { ok: false, error: "missing user" };

    let user: TelegramUser;
    try {
        user = JSON.parse(rawUser);
    } catch {
        return { ok: false, error: "malformed user" };
    }
    if (!Number.isSafeInteger(user?.id)) {
        return { ok: false, error: "missing user id" };
    }

    return { ok: true, user, authDate };
}
