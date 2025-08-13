import { Redis } from "ioredis";
import logger from "./modules/logger";

const REDIS_PREFIX = "fwdbot";

class Database {
    private client: Redis;
    private healthCheckInterval: NodeJS.Timeout | undefined;

    constructor(uri: string) {
        this.client = this.createClient(uri);
        this.startHealthCheck();
    }

    private createClient(uri: string) {
        const client = new Redis(uri, {
            keepAlive: 30_000, // 30 seconds
            reconnectOnError: (err) => {
                const targetErrors = [
                    "READONLY",
                    "ECONNRESET",
                    "ETIMEDOUT",
                    "ENOTFOUND",
                    "ECONNREFUSED"
                ];
                const shouldReconnect = targetErrors.some((targetError) =>
                    err.message.toUpperCase().includes(targetError)
                );
                logger.warn(`Redis error: ${err.message}. Reconnecting...`);
                return shouldReconnect;
            }
        });
        client.on("connect", () => {
            logger.debug("Redis connected");
        });
        client.on("ready", () => {
            logger.info("Redis connection ready");
        });
        client.on("reconnecting", () => {
            logger.debug("Redis reconnecting...");
        });
        client.on("error", (err) => {
            logger.error(`Redis error: ${err}`);
        });
        client.on("end", () => {
            logger.warn("Redis connection ended");
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
        });
        return client;
    }

    private startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            this.client
                .ping()
                .catch((err) => {
                    logger.error(`Redis health check failed: ${err}`);
                }); 
        }, 30_000);
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
