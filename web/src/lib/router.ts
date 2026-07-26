export type View = "settings" | "help" | "owner" | "not-owner" | "unclaimed";

const VIEWS: readonly string[] = [
    "settings",
    "help",
    "owner",
    "not-owner",
    "unclaimed"
];

export function currentView(): View {
    const segment = location.pathname
        .replace(/^\/app\/?/, "")
        .replace(/\/$/, "");
    if (VIEWS.includes(segment)) return segment as View;
    // Links sent before the app had paths.
    if (new URLSearchParams(location.search).get("page") === "help") {
        return "help";
    }
    return "settings";
}

/**
 * Keeps the URL honest without adding a history entry to go "back" through.
 * The hash carries the Mini App launch payload, so it has to survive.
 */
export function navigate(view: View) {
    history.replaceState(
        null,
        "",
        `/app/${view}${location.search}${location.hash}`
    );
}
