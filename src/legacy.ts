import logger from "./modules/logger";
import db from "./store";

/**
 * '~' and '|' in a bot's display name used to set protected content and caption
 * stripping for every route. Tokens are not stored, so the name is read from
 * ctx.me on the bot's first message rather than by a script.
 *
 * ponytail: delete this and its call in message.ts once deployments have upgraded.
 */

const PROTECT_CHAR = "~";
const STRIP_CAPTION_CHAR = "|";

const done = new Set<number>();

export function backfillBotNameFlags(botId: number, botName: string) {
    if (done.has(botId)) return;
    done.add(botId);

    const protectContent = botName.includes(PROTECT_CHAR);
    const strip = botName.includes(STRIP_CAPTION_CHAR);
    if (!protectContent && !strip) return;

    const config = {
        ...(protectContent ? { protectContent: true } : {}),
        ...(strip ? { caption: { strip: true } } : {})
    };

    // Fire and forget; a restart retries.
    db.backfillDefaultConfig(botId, config)
        .then((count) => {
            if (count) {
                logger.info(
                    `Migrated bot-name modifiers for ${botId} (${botName}) ` +
                        `onto ${count} routes`
                );
            }
        })
        .catch((err) =>
            logger.warn(`Bot-name backfill failed: ${err.message}`)
        );
}
