import { Redis } from "ioredis";
import logger from "./modules/logger";

const REDIS_PREFIX = "fwdbot";

class Database {
    private client: Redis;

    constructor(uri: string) {
        this.client = this.createClient(uri);
    }

    private createClient(uri: string) {
        const client = new Redis(uri);
        client.on("error", (err) => {
            logger.error(`Redis error: ${err}`);
        });
        client.on("connect", () => {
            logger.info("Connected to redis");
        });
        return client;
    }

    public async getOwner(botId: number): Promise<number | undefined> {
        const id = await this.client.get(`${REDIS_PREFIX}:${botId}:owner`);
        if (id) {
            return Number(id);
        }
    }

    public async setOwner(botId: number, userId: number) {
        return await this.client.set(
            `${REDIS_PREFIX}:${botId}:owner`,
            String(userId)
        );
    }

    public async setChatMap(botId: number, chatId: number, toChatId: number) {
        const count = await this.client.scard(
            `${REDIS_PREFIX}:${botId}:${chatId}`
        );
        if (!count) {
            logger.debug(`Creating new set for ${botId}:${chatId}`);
            await this.client.sadd(
                `${REDIS_PREFIX}:${botId}:chats`,
                String(chatId)
            );
        }
        return await this.client.sadd(
            `${REDIS_PREFIX}:${botId}:${chatId}`,
            String(toChatId)
        );
    }

    public async getChatMap(botId: number, chatId: number) {
        const ids = await this.client.smembers(
            `${REDIS_PREFIX}:${botId}:${chatId}`
        );
        if (ids) {
            return ids.map(Number);
        }
    }

    public async remChatMap(botId: number, chatId: number, toChatId?: number) {
        if (toChatId) {
            return await this.client.srem(
                `${REDIS_PREFIX}:${botId}:${chatId}`,
                String(toChatId)
            );
        } else {
            await this.client.srem(
                `${REDIS_PREFIX}:${botId}:chats`,
                String(chatId)
            );
            return await this.client.del(`${REDIS_PREFIX}:${botId}:${chatId}`);
        }
    }

    public async getAllChatMap(botId: number) {
        const chats = await this.client.smembers(
            `${REDIS_PREFIX}:${botId}:chats`
        );
        const chatMap: { [key: string]: number[] | undefined } = {};

        for (const chat of chats) {
            const ids = await this.getChatMap(botId, Number(chat));
            chatMap[chat] = ids;
        }

        return chatMap;
    }
}

let REDIS_URI = process.env.REDIS_URI;
if (!REDIS_URI) {
    logger.warn("REDIS_URI is not set. Using default redis://localhost:6379");
    REDIS_URI = "redis://localhost:6379";
}

const db = new Database(REDIS_URI);

export default db;
