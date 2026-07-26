import { Redis } from "ioredis";
import logger from "./modules/logger";

// Not the legacy `fwdbot:` root: it is scanned with patterns like
// `fwdbot:*:owner`, which a cache key must never match.
const PREFIX = "tgfwd:cache";
const INVALIDATE_CHANNEL = `${PREFIX}:invalidate`;
const SEP = "|";

// Backstop only: every write invalidates explicitly. Bounds staleness from
// direct SQL, or instances not sharing a Redis.
const DEFAULT_TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 3600) * 1000;
const DEFAULT_MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES) || 10_000;

const REDIS_URI = process.env.REDIS_URI;

type Entry<T> = { value: T; expiresAt: number };

const registry = new Map<string, Cache<any>>();

function createRedis(uri: string, role: string, commandTimeout?: number) {
    const client = new Redis(uri, {
        keepAlive: 30_000,
        maxRetriesPerRequest: 1,
        // Off would fail every command before "ready", killing L2 at startup
        // and after each reconnect.
        enableOfflineQueue: true,
        connectTimeout: 5_000,
        ...(commandTimeout ? { commandTimeout } : {})
    });
    client.on("ready", () => logger.info(`Redis ${role} ready`));
    client.on("error", (err) => logger.warn(`Redis ${role}: ${err.message}`));
    return client;
}

// Separate from the subscriber, which cannot issue normal commands. The
// timeout keeps a slow Redis off the forwarding path.
const redis = REDIS_URI ? createRedis(REDIS_URI, "cache", 500) : undefined;

if (REDIS_URI) {
    // No command timeout: it would kill SUBSCRIBE before the connection is ready.
    const subscriber = createRedis(REDIS_URI, "subscriber");

    subscriber.on("ready", () => {
        subscriber.subscribe(INVALIDATE_CHANNEL).catch((err) => {
            logger.error(`Redis subscribe failed: ${err.message}`);
        });
    });
    subscriber.on("message", (_channel, payload) => {
        const i = payload.indexOf(SEP);
        registry.get(payload.slice(0, i))?.dropLocal(payload.slice(i + 1));
    });
} else {
    logger.info("REDIS_URI not set, using in-process cache only");
}

export class Cache<T> {
    private l1 = new Map<string, Entry<T>>();
    private ttlMs: number;
    private maxEntries: number;

    constructor(
        private namespace: string,
        opts: { ttlMs?: number; maxEntries?: number } = {}
    ) {
        this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
        this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
        registry.set(namespace, this);
    }

    private redisKey(key: string) {
        return `${PREFIX}:${this.namespace}:${key}`;
    }

    /** This process only; the pub/sub listener calls it on other instances. */
    dropLocal(key: string) {
        this.l1.delete(key);
    }

    private setL1(key: string, value: T) {
        // ponytail: wholesale clear, not LRU. Swap in an LRU if the refill
        // burst after a clear ever matters.
        if (this.l1.size >= this.maxEntries) this.l1.clear();
        this.l1.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    async get(key: string, loader: () => Promise<T>): Promise<T> {
        const cached = this.l1.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.value;

        if (redis) {
            try {
                const raw = await redis.get(this.redisKey(key));
                if (raw !== null) {
                    const value = JSON.parse(raw).v as T;
                    this.setL1(key, value);
                    return value;
                }
            } catch (err: any) {
                logger.warn(`Cache L2 read failed: ${err.message}`);
            }
        }

        let value: T;
        try {
            value = await loader();
        } catch (err: any) {
            // Stale beats dropping the message.
            if (cached) {
                logger.warn(`Loader failed, serving stale: ${err.message}`);
                return cached.value;
            }
            throw err;
        }

        this.setL1(key, value);
        if (redis) {
            redis
                .set(
                    this.redisKey(key),
                    JSON.stringify({ v: value }),
                    "PX",
                    this.ttlMs
                )
                .catch((err) =>
                    logger.warn(`Cache L2 write failed: ${err.message}`)
                );
        }
        return value;
    }

    async invalidate(key: string) {
        this.dropLocal(key);
        if (!redis) return;
        try {
            await redis.del(this.redisKey(key));
            await redis.publish(INVALIDATE_CHANNEL, this.namespace + SEP + key);
        } catch (err: any) {
            logger.warn(`Cache invalidation failed: ${err.message}`);
        }
    }
}
