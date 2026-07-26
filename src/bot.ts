import { autoRetry } from "@grammyjs/auto-retry";
import { type ParseModeFlavor, parseMode } from "@grammyjs/parse-mode";
import { Bot, Composer, type Context } from "grammy";
import bot_token_handler from "./handlers/bot_token";
import get_chat_handler from "./handlers/get_chat";
import help_handler from "./handlers/help";
import message_handler from "./handlers/message";
import owner_only from "./handlers/owner_only";
import chat_shared_handler from "./handlers/pick";
import rem_chat_handler from "./handlers/rem_chat";
import set_chat_handler from "./handlers/set_chat";
import set_owner_handler from "./handlers/set_owner";
import start_handler from "./handlers/start";
import logger from "./modules/logger";

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
                description: "Start the bot"
            },
            {
                command: "help",
                description: "Show help message"
            },
            {
                command: "set",
                description: "Add forwarding — pick chats from a list"
            },
            {
                command: "get",
                description: "Get a existing setting"
            },
            {
                command: "rem",
                description: "Remove a chat forwarding"
            },
            {
                command: "set_owner",
                description: "Set the owner of the bot"
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
export const miniAppUrl = (botId: number, page?: string) =>
    WEBHOOK_HOST
        ? `${WEBHOOK_HOST}/app?bot=${botId}${page ? `&page=${page}` : ""}`
        : undefined;

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
privateChat.command(["help", "settings"], wrapper(help_handler));

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

export default composer;
