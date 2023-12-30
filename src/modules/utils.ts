import { BotContext } from "../bot";
import { ChatFromGetChat } from "grammy/types";

export const formatObject = (obj: {
    [key: string]: number[] | undefined;
}): string => {
    let text = "";
    for (const key in obj) {
        text += `(${key})\n`;

        if (obj[key] === undefined) {
            text += "\n";
        } else {
            const len = obj[key]?.length ?? 0;
            obj[key]?.forEach((value, index) => {
                index === len - 1
                    ? (text += `└─(${value})\n`)
                    : (text += `├─(${value})\n`);
            });
        }
    }

    return text;
};


export const parseEntity = (text: string): string | number => {
    if (!isNaN(Number(text))) {
        return Number(text);
    } else if (text.match(/^@/)) {
        return text
    } else {
        return `@${text}`
    }
}

export const getEntity = async (ctx: BotContext, chatId: string): Promise<ChatFromGetChat | undefined> => {
    try {
        return await ctx.api.getChat(parseEntity(chatId));
    } catch (error: any) {
        if (error.error_code === 400) {
            return;
        }
    }
}