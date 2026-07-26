import logger from "./modules/logger";
import db from "./store";

/**
 * '~' and '|' in a bot's display name used to set protected content and caption
 * stripping for every route. Tokens are not stored, so the name is read from
 * ctx.me on the bot's first message rather than by a script.
 *
 * Marked done on the bots row, not just in memory: '|' is a common name
 * separator, so a per-process guard would re-apply the flags after every
 * restart to any route still on defaults.
 *
 * ponytail: delete this and its call in message.ts once deployments have upgraded.
 */

const PROTECT_CHAR = "~";
const STRIP_CAPTION_CHAR = "|";

const checked = new Set<number>();

export function backfillBotNameFlags(botId: number, botName: string) {
    if (checked.has(botId)) return;
    checked.add(botId);

    // Fire and forget; a restart retries only if the marker is still unset.
    void run(botId, botName).catch((err) => {
        checked.delete(botId);
        logger.warn(`Bot-name backfill failed: ${err.message}`);
    });
}

async function run(botId: number, botName: string) {
    if (!(await db.needsLegacyMigration(botId))) return;

    const protectContent = botName.includes(PROTECT_CHAR);
    const strip = botName.includes(STRIP_CAPTION_CHAR);

    if (protectContent || strip) {
        const config = {
            ...(protectContent ? { protectContent: true } : {}),
            ...(strip ? { caption: { strip: true } } : {})
        };
        const count = await db.backfillDefaultConfig(botId, config);
        if (count) {
            logger.info(
                `Migrated bot-name modifiers for ${botId} (${botName}) ` +
                    `onto ${count} routes`
            );
        }
    }

    await db.markLegacyMigrated(botId);
}
