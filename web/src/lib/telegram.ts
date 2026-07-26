/** Only the parts of the WebApp object this app uses. */
type WebApp = {
    initData: string;
    initDataUnsafe?: { user?: { id: number } };
    ready(): void;
    expand(): void;
    close(): void;
    isExpanded?: boolean;
    disableVerticalSwipes?(): void;
    openTelegramLink?(url: string): void;
    HapticFeedback?: {
        notificationOccurred(t: "error" | "success" | "warning"): void;
    };
    showConfirm?(message: string, cb: (ok: boolean) => void): void;
    BackButton?: {
        show(): void;
        hide(): void;
        onClick(cb: () => void): void;
    };
};

export const webApp: WebApp | undefined = (globalThis as any).Telegram?.WebApp;

/**
 * From the launch URL, not initData. Cannot be forged: the server verifies the
 * signature against this bot_id, so a wrong value fails to authenticate.
 */
export function botId(): number {
    const fromQuery = new URLSearchParams(location.search).get("bot");
    const fromStart = new URLSearchParams(location.search).get(
        "tgWebAppStartParam"
    );
    return Number(fromQuery ?? fromStart ?? 0);
}

/** Display only — unsigned. Anything that matters is checked server-side. */
export const myId = (): number | undefined => webApp?.initDataUnsafe?.user?.id;

export function init() {
    if (!webApp) return;
    webApp.ready();
    webApp.expand();
    // A long settings list would otherwise collapse the app while scrolling.
    webApp.disableVerticalSwipes?.();
}

export const close = () => webApp?.close();

/** Telegram's own back control, so the system gesture matches the in-app one. */
export function backButton(visible: boolean) {
    if (visible) webApp?.BackButton?.show();
    else webApp?.BackButton?.hide();
}

export const onBackButton = (cb: () => void) => webApp?.BackButton?.onClick(cb);

export const openTelegramLink = (url: string) => {
    if (webApp?.openTelegramLink) webApp.openTelegramLink(url);
    else globalThis.open(url, "_blank");
};

/** navigator.clipboard needs a gesture and a secure context; neither is certain. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const el = document.createElement("textarea");
            el.value = text;
            el.setAttribute("readonly", "");
            el.style.position = "fixed";
            el.style.opacity = "0";
            document.body.appendChild(el);
            el.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(el);
            return ok;
        } catch {
            return false;
        }
    }
}

export const haptic = (type: "success" | "warning" | "error" = "success") =>
    webApp?.HapticFeedback?.notificationOccurred(type);

export function confirm(message: string): Promise<boolean> {
    if (!webApp?.showConfirm)
        return Promise.resolve(globalThis.confirm(message));
    return new Promise((resolve) => webApp.showConfirm?.(message, resolve));
}
