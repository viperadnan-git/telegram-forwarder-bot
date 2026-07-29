import { autoRetry } from "@grammyjs/auto-retry";
import { type ParseModeFlavor, parseMode } from "@grammyjs/parse-mode";
import { Bot, Composer, type Context } from "grammy";
import bot_token_handler from "./handlers/bot_token";
import cancel_handler from "./handlers/cancel";
import get_chat_handler from "./handlers/get_chat";
import help_handler from "./handlers/help";
import message_handler from "./handlers/message";
import my_chat_member_handler from "./handlers/my_chat_member";
import owner_only from "./handlers/owner_only";
import chat_shared_handler from "./handlers/pick";
import rem_chat_handler from "./handlers/rem_chat";
import set_chat_handler from "./handlers/set_chat";
import set_owner_handler from "./handlers/set_owner";
import settings_handler from "./handlers/settings";
import start_handler from "./handlers/start";
import logger from "./lib/logger";

export type BotContext = ParseModeFlavor<Context>;

const composer = new Composer<BotContext>();

export const WEBHOOK_HOST = process.env.WEBHOOK_HOST;
export const bots = new Map<string, Bot<BotContext>>();

export const botCreator = (token: string) => {
    const bot = new Bot<BotContext>(token, {
        client: {
            canUseWebhookReply: (method) => method === "sendChatAction"
        }
    });
    bot.api.config.use(parseMode("HTML"));
    // Fan-out multiplies outgoing calls; honor retry_after on 429s.
    bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));
    bot.api
        .setMyCommands([
            {
                command: "start",
                description: "What this bot does"
            },
            {
                command: "help",
                description: "How it works, and the commands"
            },
            {
                command: "set",
                description: "Forward a chat to another"
            },
            {
                command: "get",
                description: "List what is being forwarded"
            },
            {
                command: "rem",
                description: "Stop forwarding a chat"
            },
            {
                command: "settings",
                description: "Change how a chat is forwarded"
            },
            {
                command: "cancel",
                description: "Stop what you started"
            },
            {
                command: "set_owner",
                description: "Hand the bot to someone else"
            }
            // A revoked token rejects here; unhandled it kills the process.
        ])
        .catch((err) =>
            logger.warn(`Could not set commands for bot: ${err.message}`)
        );

    const url = miniAppUrl(Number(token.split(":")[0]));
    if (url) {
        bot.api
            .setChatMenuButton({
                menu_button: {
                    type: "web_app",
                    text: "Settings",
                    web_app: { url }
                }
            })
            .catch((err) =>
                logger.warn(`Could not set menu button: ${err.message}`)
            );
    }

    bots.set(token, bot);
    bot.use(composer);
    return bot;
};

/** Only bots that have handled an update in this process. Callers handle a miss. */
export const getBotById = (botId: number) => {
    const prefix = `${botId}:`;
    for (const [token, bot] of bots) {
        if (token.startsWith(prefix)) return bot;
    }
};

/** The bot id is verified against the initData signature, so it is safe in the URL. */
export const miniAppUrl = (
    botId: number,
    view: "settings" | "help" | "not-owner" = "settings"
) => (WEBHOOK_HOST ? `${WEBHOOK_HOST}/app/${view}?bot=${botId}` : undefined);

const wrapper =
    (handler: (ctx: BotContext) => Promise<void>) =>
    async (ctx: BotContext) => {
        handler(ctx).catch((err) => {
            console.error(`Error in ${handler.name}: ${err}`);
            ctx.reply("An error has occurred. Please try again later.");
        });
    };

const privateChat = composer.chatType("private");

privateChat.command("start", wrapper(start_handler));
privateChat.command(["set_owner", "setowner"], wrapper(set_owner_handler));
privateChat.command("help", wrapper(help_handler));
privateChat.command("settings", wrapper(settings_handler));
privateChat.command("cancel", wrapper(cancel_handler));

privateChat.command("set").filter(owner_only, wrapper(set_chat_handler));
privateChat.command("get").filter(owner_only, wrapper(get_chat_handler));
privateChat.command("rem").filter(owner_only, wrapper(rem_chat_handler));

privateChat
    .on("msg:chat_shared")
    .filter(owner_only, wrapper(chat_shared_handler));

privateChat.on("msg:text").filter(
    // @ts-expect-error
    (ctx) => ctx.msg.forward_from?.username?.toLowerCase() === "botfather",
    wrapper(bot_token_handler)
);

composer.on("msg", message_handler);

// No wrapper: it replies to the chat, and this fires for chats the bot has
// just been thrown out of.
composer.on("my_chat_member", (ctx) =>
    my_chat_member_handler(ctx).catch((err) =>
        logger.error(`my_chat_member failed: ${err.message}`)
    )
);
