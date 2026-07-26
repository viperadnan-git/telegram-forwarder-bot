import type { Route, RouteConfig } from "./types";
import { botId, webApp } from "./telegram";

/** Status and reason so callers can branch, not just display. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly reason?: string
    ) {
        super(message);
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            authorization: `tma ${webApp?.initData ?? ""}`,
            "x-bot-id": String(botId()),
            ...init.headers
        }
    });

    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(
            body.error ?? `Request failed (${res.status})`,
            res.status,
            body.reason
        );
    }
    return body as T;
}

export type ResolvedChat = {
    chatId: number;
    title?: string;
    username?: string;
    type: string;
};

/** Ids need no round trip; the client short-circuits those. */
export const resolveChat = (input: string) =>
    request<ResolvedChat>("/resolve", {
        method: "POST",
        body: JSON.stringify({ input })
    });

export const createRoute = (sourceChatId: number, destChatId: number) =>
    request<{ route: Route }>("/routes", {
        method: "POST",
        body: JSON.stringify({ sourceChatId, destChatId })
    }).then((r) => r.route);

/** Asks the bot to send the picker into the private chat. */
export const startSetFlow = () =>
    request<void>("/flow/set", { method: "POST" });

export const listRoutes = () =>
    request<{ routes: Route[] }>("/routes").then((r) => r.routes);

/** User-triggered, never automatic. */
export const refreshChatNames = () =>
    request<{ updated: number; failed: number; routes: Route[] }>(
        "/chats/refresh",
        { method: "POST" }
    );

export const updateRoute = (
    id: string,
    patch: { config?: RouteConfig; enabled?: boolean }
) =>
    request<{ route: Route }>(`/routes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
    }).then((r) => r.route);

export const deleteRoute = (id: string) =>
    request<void>(`/routes/${id}`, { method: "DELETE" });
