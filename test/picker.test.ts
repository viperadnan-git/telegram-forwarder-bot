import { describe, expect, test } from "bun:test";
import { cancelPicker, startPicker } from "../src/handlers/pick";

const ctx = (botId: number, userId: number) =>
    ({
        me: { id: botId },
        from: { id: userId },
        reply: async () => {}
    }) as any;

describe("cancelPicker", () => {
    test("cancels a flow that has not reached the first pick yet", async () => {
        await startPicker(ctx(1, 100));
        expect(cancelPicker(1, 100)).toBe(true);
    });

    test("reports nothing to cancel when no flow was started", () => {
        expect(cancelPicker(1, 101)).toBe(false);
    });

    test("does not cancel twice", async () => {
        await startPicker(ctx(1, 102));
        expect(cancelPicker(1, 102)).toBe(true);
        expect(cancelPicker(1, 102)).toBe(false);
    });

    test("is scoped to one user of one bot", async () => {
        await startPicker(ctx(1, 103));
        expect(cancelPicker(2, 103)).toBe(false);
        expect(cancelPicker(1, 104)).toBe(false);
        expect(cancelPicker(1, 103)).toBe(true);
    });
});
