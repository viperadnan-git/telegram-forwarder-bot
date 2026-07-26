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

describe("invalidation during an in-flight load", () => {
    test("a loader that started before invalidate does not repopulate", async () => {
        const cache = new Cache<string>("race1", { ttlMs: 60_000 });

        let release: (v: string) => void = () => {};
        const slow = () => new Promise<string>((r) => (release = r));

        // Start a load, invalidate mid-flight, then let the load finish.
        const inflight = cache.get("k", slow);
        await cache.invalidate("k");
        release("stale");
        expect(await inflight).toBe("stale"); // caller still gets its result

        // The next read must hit the loader again, not the stale value.
        let loads = 0;
        const fresh = await cache.get("k", async () => {
            loads++;
            return "fresh";
        });
        expect(fresh).toBe("fresh");
        expect(loads).toBe(1);
    });

    test("without an invalidation the result is cached as usual", async () => {
        const cache = new Cache<string>("race2", { ttlMs: 60_000 });
        expect(await cache.get("k", async () => "v")).toBe("v");

        let loads = 0;
        await cache.get("k", async () => {
            loads++;
            return "other";
        });
        expect(loads).toBe(0);
    });
});
