import { beforeAll, describe, expect, test } from "bun:test";

let Cache: typeof import("../src/cache").Cache;

beforeAll(async () => {
    // Must be cleared before importing: cache.ts opens Redis at module load.
    delete process.env.REDIS_URI;
    ({ Cache } = await import("../src/cache"));
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Cache", () => {
    test("miss invokes the loader exactly once, hit does not", async () => {
        const cache = new Cache<number>("t1");
        let calls = 0;
        const loader = async () => ++calls;

        expect(await cache.get("k", loader)).toBe(1);
        expect(await cache.get("k", loader)).toBe(1);
        expect(calls).toBe(1);
    });

    test("an empty result is cached, not re-loaded", async () => {
        const cache = new Cache<number[]>("t2");
        let calls = 0;
        const loader = async () => {
            calls++;
            return [] as number[];
        };

        expect(await cache.get("k", loader)).toEqual([]);
        expect(await cache.get("k", loader)).toEqual([]);
        expect(calls).toBe(1);
    });

    test("an entry past its TTL is re-loaded", async () => {
        const cache = new Cache<number>("t3", { ttlMs: 20 });
        let calls = 0;
        const loader = async () => ++calls;

        expect(await cache.get("k", loader)).toBe(1);
        await sleep(35);
        expect(await cache.get("k", loader)).toBe(2);
    });

    test("invalidate forces a reload", async () => {
        const cache = new Cache<number>("t4");
        let calls = 0;
        const loader = async () => ++calls;

        expect(await cache.get("k", loader)).toBe(1);
        await cache.invalidate("k");
        expect(await cache.get("k", loader)).toBe(2);
    });

    test("a failing loader serves a stale entry instead of throwing", async () => {
        const cache = new Cache<number>("t5", { ttlMs: 20 });
        expect(await cache.get("k", async () => 42)).toBe(42);
        await sleep(35);

        expect(
            await cache.get("k", async () => {
                throw new Error("postgres down");
            })
        ).toBe(42);
    });

    test("a failing loader with no cached entry throws", async () => {
        const cache = new Cache<number>("t6");
        expect(
            cache.get("k", async () => {
                throw new Error("postgres down");
            })
        ).rejects.toThrow("postgres down");
    });

    test("the L1 map is bounded", async () => {
        const cache = new Cache<number>("t7", { maxEntries: 4 });
        for (let i = 0; i < 10; i++) {
            await cache.get(`k${i}`, async () => i);
        }
        // Post-clear, an early key must reload rather than return a stale hit.
        let reloaded = false;
        await cache.get("k0", async () => {
            reloaded = true;
            return 0;
        });
        expect(reloaded).toBe(true);
    });
});
