import logger from "../lib/logger";
import db from "../store";

/**
 * Forward counts, batched into one statement per window. A per-message UPDATE
 * would serialise every delivery to a busy route on that row's lock.
 */

const FLUSH_MS = Number(process.env.STATS_FLUSH_SECONDS ?? 30) * 1000;
const MAX_BATCH = 1000;

const pending = new Map<string, number>();

export function counted(routeId: string, n: number) {
    if (n > 0) pending.set(routeId, (pending.get(routeId) ?? 0) + n);
}

const merge = (entries: [string, number][]) => {
    for (const [id, n] of entries) counted(id, n);
};

export async function flush() {
    if (!pending.size) return;

    const batch = new Map(pending);
    // Cleared before the await: whatever arrives mid-write belongs to the next.
    pending.clear();

    const entries = [...batch];
    for (let i = 0; i < entries.length; i += MAX_BATCH) {
        const chunk = entries.slice(i, i + MAX_BATCH);
        try {
            await db.addForwarded(chunk);
        } catch (err: any) {
            // Only what did not land: re-queueing a committed chunk would
            // count it twice.
            logger.warn(`Stats flush failed, retrying next: ${err.message}`);
            merge(entries.slice(i));
            return;
        }
    }
}

export function startCounter() {
    const timer = setInterval(() => {
        flush().catch((err) => logger.error(`Stats flush: ${err.message}`));
    }, FLUSH_MS);
    timer.unref?.();
    return timer;
}
