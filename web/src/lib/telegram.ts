/** Only the parts of the WebApp object this app uses. */
type WebApp = {
    initData: string;
    initDataUnsafe?: { user?: { id: number } };
    ready(): void;
    expand(): void;
    close(): void;
    isExpanded?: boolean;
    disableVerticalSwipes?(): void;
    // Colour keys, not hex, so they keep following the user's theme.
    setHeaderColor?(color: string): void;
    setBackgroundColor?(color: string): void;
    setBottomBarColor?(color: string): void;
    openTelegramLink?(url: string): void;
    HapticFeedback?: {
        notificationOccurred(t: "error" | "success" | "warning"): void;
        impactOccurred(
            style: "light" | "medium" | "heavy" | "rigid" | "soft"
        ): void;
        selectionChanged(): void;
    };
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

/**
 * Version-gated methods are present on the object whatever the client's version
 * and *throw* when called on one too old, so optional chaining is no protection.
 * Everything optional goes through here.
 */
export function safely(call: () => void) {
    try {
        call();
    } catch {
        // Older client: the feature is simply absent.
    }
}

export function init() {
    if (!webApp) return;
    const app = webApp;

    app.ready();
    app.expand();

    // A long settings list would otherwise collapse the app while scrolling.
    safely(() => app.disableVerticalSwipes?.());

    // Pages sit on the grouped-list background; the header and the area behind
    // the webview default to bg_color, which shows as a seam in most themes.
    safely(() => app.setHeaderColor?.("secondary_bg_color"));
    safely(() => app.setBackgroundColor?.("secondary_bg_color"));
    safely(() => app.setBottomBarColor?.("secondary_bg_color"));
}

export const close = () => webApp?.close();

/** Telegram's own back control, so the system gesture matches the in-app one. */
export function backButton(visible: boolean) {
    safely(() =>
        visible ? webApp?.BackButton?.show() : webApp?.BackButton?.hide()
    );
}

export const onBackButton = (cb: () => void) =>
    safely(() => webApp?.BackButton?.onClick(cb));

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
