import { beforeEach, describe, expect, mock, test } from "bun:test";

const writes: [string, number][][] = [];
let fail = false;
let failOn: () => boolean = () => false;

mock.module("../src/store", () => ({
    default: {
        addForwarded: async (entries: [string, number][]) => {
            if (fail || failOn()) throw new Error("postgres down");
            writes.push(entries);
        }
    }
}));

const { counted, flush } = await import("../src/forwarding/counter");

const A = "aaaaaaaa-0000-7000-8000-000000000000";
const B = "bbbbbbbb-0000-7000-8000-000000000000";

describe("forward counter", () => {
    beforeEach(async () => {
        fail = false;
        failOn = () => false;
        writes.length = 0;
        await flush();
        writes.length = 0;
    });

    test("sums repeats per route into one entry", async () => {
        counted(A, 1);
        counted(A, 10);
        counted(B, 3);
        await flush();
        expect(writes).toHaveLength(1);
        expect(new Map(writes[0])).toEqual(
            new Map([
                [A, 11],
                [B, 3]
            ])
        );
    });

    test("an album counts as its part count", async () => {
        counted(A, 10);
        await flush();
        expect(writes[0]).toEqual([[A, 10]]);
    });

    test("writes nothing when nothing was forwarded", async () => {
        await flush();
        expect(writes).toEqual([]);
    });

    test("ignores a zero count", async () => {
        counted(A, 0);
        await flush();
        expect(writes).toEqual([]);
    });

    test("a failed flush keeps the counts for the next window", async () => {
        fail = true;
        counted(A, 5);
        await flush();
        expect(writes).toEqual([]);

        fail = false;
        await flush();
        expect(writes[0]).toEqual([[A, 5]]);
    });

    test("counts arriving during a failed flush are added, not lost", async () => {
        fail = true;
        counted(A, 5);
        await flush();

        counted(A, 2);
        fail = false;
        await flush();
        expect(writes[0]).toEqual([[A, 7]]);
    });

    test("a flushed window does not write twice", async () => {
        counted(A, 4);
        await flush();
        await flush();
        expect(writes).toHaveLength(1);
    });
});

describe("flush chunking", () => {
    beforeEach(async () => {
        fail = false;
        failOn = () => false;
        await flush();
        writes.length = 0;
    });

    test("a mid-batch failure re-queues only what did not land", async () => {
        // The write is additive, so a committed chunk must not be sent twice.
        const many = Array.from(
            { length: 2500 },
            (_, i) =>
                `${i.toString(16).padStart(8, "0")}-0000-7000-8000-000000000000`
        );
        for (const id of many) counted(id, 1);

        let calls = 0;
        failOn = () => ++calls === 2;
        await flush();
        expect(writes).toHaveLength(1);

        failOn = () => false;
        writes.length = 0;
        await flush();

        const total = writes.flat().length;
        expect(total).toBe(2500 - 1000);
    });
});
