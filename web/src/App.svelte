<script lang="ts">
import { tick } from "svelte";
import * as api from "./lib/api";
import { ApiError } from "./lib/api";
import ConfirmDialog from "./lib/components/ConfirmDialog.svelte";
import { run } from "./lib/haptics";
import {
    back,
    currentDepth,
    isOverlay,
    type Loc,
    needsRoutes,
    onLocation,
    parse,
    push,
    replace
} from "./lib/router";
import AddRoute from "./lib/screens/AddRoute.svelte";
import Clone from "./lib/screens/Clone.svelte";
import Help from "./lib/screens/Help.svelte";
import NoAccess from "./lib/screens/NoAccess.svelte";
import Owner from "./lib/screens/Owner.svelte";
import RouteEditor from "./lib/screens/RouteEditor.svelte";
import Routes from "./lib/screens/Routes.svelte";
import {
    backButton,
    botId,
    close,
    confirm,
    init,
    onBackButton
} from "./lib/telegram";
import type { Route, RouteConfig } from "./lib/types";

let routes = $state<Route[]>([]);
let loading = $state(true);
let error = $state("");

// The URL is the state: every screen is a history entry, so the system back
// gesture pops one screen instead of closing the whole app.
const initialLoc = parse();
let loc = $state<Loc>(initialLoc);
let depth = $state(0);
let editorDirty = $state(false);

// TS cannot narrow `loc` inside the closure, so pull the id out first.
const editing = $derived.by(() => {
    if (loc.name !== "route") return null;
    const id = loc.id;
    return routes.find((r) => r.id === id) ?? null;
});
const pane = $derived(loc.name === "route" ? loc.pane : null);
const manual = $derived(loc.name === "add");

/** Sheets sit over the settings screen, so it stays the page behind them. */
const view = $derived(
    loc.name === "route" || loc.name === "add" ? "settings" : loc.name
);
let refreshing = $state(false);
let confirmingRefresh = $state(false);
let starting = $state(false);
// The picker is a reply keyboard, which a Mini App cannot render.
async function startSetFlow() {
    starting = true;
    error = "";
    try {
        await api.startSetFlow();
        close();
    } catch (e: any) {
        error = e.message;
        starting = false;
    }
}

/** Scoped to one route: two getChat calls, so no confirmation is warranted. */
async function refresh(route: Route) {
    confirmingRefresh = false;
    refreshing = true;
    error = "";
    try {
        // Some chats unreachable is a partial result, not a clean success.
        const result = await run(
            () => api.refreshChatNames([route.sourceChatId, route.destChatId]),
            (r) => (r.failed ? "warning" : "success")
        );
        routes = result.routes;
    } catch (e: any) {
        error = e.message;
    } finally {
        refreshing = false;
    }
}

const NO_BOT =
    "Open this page from your bot so it knows which bot to configure.";

let loaded = false;

/** Routes are fetched once, whichever screen the app happened to open on. */
function ensureRoutes(next: Loc) {
    if (!needsRoutes(next) || loaded) return;
    if (botId()) load();
    else {
        loading = false;
        error = NO_BOT;
    }
}

/** Scrolling must wait for the new screen to render, or there is nothing to scroll. */
async function show(next: Loc, scrollY: number) {
    loc = next;
    depth = currentDepth();
    ensureRoutes(next);
    if (isOverlay(next)) return;
    await tick();
    window.scrollTo(0, scrollY);
}

function go(next: Loc) {
    error = "";
    push(next);
    show(next, 0);
}

/** Replaces rather than pushes: an access refusal is not a screen to go back to. */
function land(next: Loc) {
    error = "";
    replace(next);
    show(next, 0);
}

onLocation(async (next, scrollY) => {
    // Leaving the editor with pending edits is easy to do by accident once the
    // system gesture is wired up.
    if (
        loc.name === "route" &&
        next.name !== "route" &&
        editorDirty &&
        !(await confirm("Discard unsaved changes?"))
    ) {
        push(loc);
        depth = currentDepth();
        return;
    }
    error = "";
    show(next, scrollY);
});

onBackButton(back);

$effect(() => {
    backButton(depth > 0);
});

// A fixed sheet does not stop the document behind it scrolling.
$effect(() => {
    document.body.classList.toggle("sheet-open", isOverlay(loc));
});

async function load() {
    loading = true;
    error = "";
    try {
        routes = await api.listRoutes();
        loaded = true;
        // Deep link to a route that has since been deleted.
        if (loc.name === "route") {
            const id = loc.id;
            if (!routes.some((r) => r.id === id)) land({ name: "settings" });
        }
    } catch (e: any) {
        if (e instanceof ApiError && e.status === 403) {
            // The URL should say which screen you are on.
            land({
                name: e.reason === "unclaimed" ? "unclaimed" : "not-owner"
            });
        } else {
            error = e.message;
        }
    } finally {
        loading = false;
    }
}

async function save(patch: { config: RouteConfig; enabled: boolean }) {
    const updated = await run(() => api.updateRoute(editing!.id, patch));
    routes = routes.map((r) =>
        r.id === updated.id ? { ...r, ...updated } : r
    );
    editorDirty = false;
}

async function remove() {
    if (!(await confirm("Delete this destination?"))) return;
    await run(() => api.deleteRoute(editing!.id));
    routes = routes.filter((r) => r.id !== editing!.id);
    editorDirty = false;
    back();
}

// Last, so nothing in the Telegram handshake can stop the app wiring up.
init();

// Seeds history state so the first popstate knows it is back at the root.
replace(initialLoc);
if (needsRoutes(initialLoc)) ensureRoutes(initialLoc);
else loading = false;
</script>

{#if view === "help"}
    <Help
        onback={() => (depth > 0 ? back() : close())}
        backLabel={depth > 0 ? "Back" : "Close"}
    />
{:else if view === "owner"}
    <Owner
        onback={() => (depth > 0 ? back() : close())}
        backLabel={depth > 0 ? "Back" : "Close"}
    />
{:else if view === "clone"}
    <Clone
        onback={() => (depth > 0 ? back() : close())}
        backLabel={depth > 0 ? "Back" : "Close"}
        onclaimed={() => go({ name: "settings" })}
    />
{:else if view === "not-owner" || view === "unclaimed"}
    <NoAccess
        reason={view}
        onhelp={() => go({ name: "help" })}
        onclone={() => go({ name: "clone" })}
    />
{:else}
    <Routes
        {routes}
        {loading}
        {error}
        {starting}
        onopen={(route) => go({ name: "route", id: route.id, pane: null })}
        onpick={startSetFlow}
        onmanual={() => go({ name: "add" })}
        onhelp={() => go({ name: "help" })}
        onowner={() => go({ name: "owner" })}
        onclone={() => go({ name: "clone" })}
    />
{/if}

{#if editing}
    <!-- Keyed so a different route remounts rather than reusing its state. -->
    {#key editing.id}
        <RouteEditor
            route={editing}
            {pane}
            onpane={(next) =>
                next
                    ? go({ name: "route", id: editing.id, pane: next })
                    : back()}
            onsave={save}
            onclose={back}
            ondelete={remove}
            ondirty={(d) => (editorDirty = d)}
            onrefresh={() => (confirmingRefresh = true)}
            {refreshing}
        />
    {/key}

    {#if confirmingRefresh}
        <ConfirmDialog
            title="Refresh chat names?"
            confirmLabel="Refresh"
            oncancel={() => (confirmingRefresh = false)}
            onconfirm={() => refresh(editing)}
        >
            <p>
                I will ask Telegram for the current name of both chats in this
                route — the source and the destination.
            </p>
            <p>
                Telegram limits how often a bot can do this, so refreshing
                repeatedly can get the bot temporarily rate limited, which also
                delays forwarding.
            </p>
        </ConfirmDialog>
    {/if}
{/if}

{#if manual}
    <AddRoute
        onclose={back}
        oncreated={(route) => {
            routes = [...routes, route];
            back();
        }}
    />
{/if}
