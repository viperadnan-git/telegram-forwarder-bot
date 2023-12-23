import { BotContext } from "../bot";

export default async function start_handler(ctx: BotContext) {
    await ctx.reply(
        `Hello, I am a bot that forwards messages from one chat to another. I only work for the owner of this bot. If you want to create a bot like me, just create a bot on @BotFather and foward the message with bot token to me. I will clone the new bot and set you as the owner of that bot.\n\nIf you are the owner of this bot, you can forward messages from one chat to another learn more using /help command.`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Create a bot",
                            url: "https://t.me/BotFather",
                        },
                        {
                            text: "Feature Request",
                            url: "https://github.com/viperadnan-git/telegram-forwarder-bot/issues",
                        },
                    ],
                    [
                        {
                            text: "Source Code",
                            url: "https://github.com/viperadnan-git/telegram-forwarder-bot",
                        },
                    ],
                    [
                        {
                            text: "Support Group",
                            url: "https://t.me/vipercommunity",
                        },
                    ],
                ],
            },
        }
    );
}
