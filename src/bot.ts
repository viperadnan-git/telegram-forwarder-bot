import { Bot, Composer, Context } from "grammy";
import { ParseModeFlavor, parseMode } from "@grammyjs/parse-mode";

import bot_token_handler from "./handlers/bot_token";
import get_chat_handler from "./handlers/get_chat";
import help_handler from "./handlers/help";
import message_handler from "./handlers/message";
import owner_only from "./handlers/owner_only";
import rem_chat_handler from "./handlers/rem_chat";
import set_chat_handler from "./handlers/set_chat";
import set_owner_handler from "./handlers/set_owner";
import start_handler from "./handlers/start";

export type BotContext = ParseModeFlavor<Context>;

const composer = new Composer<BotContext>();

export const WEBHOOK_HOST = process.env.WEBHOOK_HOST;
export const bots = new Map<string, Bot<BotContext>>();

export const botCreator = (token: string) => {
    const bot = new Bot<BotContext>(token, {
        client: {
            canUseWebhookReply: (method) => method === "sendChatAction",
        },
    });
    bot.api.config.use(parseMode("HTML"));
    bot.api.setMyCommands([
        {
            command: "start",
            description: "Start the bot",
        },
        {
            command: "help",
            description: "Show help message",
        },
        {
            command: "set",
            description: "Set a new chat forwarding",
        },
        {
            command: "get",
            description: "Get a existing setting",
        },
        {
            command: "rem",
            description: "Remove a chat forwarding",
        },
        {
            command: "set_owner",
            description: "Set the owner of the bot",
        },
    ]);
    bots.set(token, bot);
    bot.use(composer);
    return bot;
};

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
privateChat
    .command(["help", "settings"])
    .filter(owner_only, wrapper(help_handler));
privateChat.command("set").filter(owner_only, wrapper(set_chat_handler));
privateChat.command("get").filter(owner_only, wrapper(get_chat_handler));
privateChat.command("rem").filter(owner_only, wrapper(rem_chat_handler));

privateChat
    .on("msg:text")
    .filter(
        (ctx) => ctx.msg.forward_from?.username?.toLowerCase() === "botfather",
        wrapper(bot_token_handler)
    );

composer.on("msg", message_handler);

export default composer;
