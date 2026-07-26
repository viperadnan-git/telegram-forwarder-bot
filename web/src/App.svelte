<script lang="ts">
import { tick } from "svelte";
import * as api from "./lib/api";
import { ApiError } from "./lib/api";
import ChatInput from "./lib/ChatInput.svelte";
import Help from "./lib/Help.svelte";
import Hero from "./lib/Hero.svelte";
import Icon from "./lib/Icon.svelte";
import NoAccess from "./lib/NoAccess.svelte";
import Owner from "./lib/Owner.svelte";
import RouteEditor from "./lib/RouteEditor.svelte";
import RouteLink from "./lib/RouteLink.svelte";
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
import Skeleton from "./lib/Skeleton.svelte";
import {
    backButton,
    botId,
    close,
    confirm,
    init,
    onBackButton
} from "./lib/telegram";
import { type Route, type RouteConfig, withDefaults } from "./lib/types";

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
let refreshNote = $state("");
let confirmingRefresh = $state(false);

// How many getChat calls a refresh costs.
const chatCount = $derived(
    new Set(routes.flatMap((r) => [r.sourceChatId, r.destChatId])).size
);
let starting = $state(false);
let adding = $state(false);
let newSource = $state("");
let newDest = $state("");
let sourceInput = $state<ChatInput>();
let destInput = $state<ChatInput>();

const canAdd = $derived(
    newSource.trim() !== "" &&
        newDest.trim() !== "" &&
        newSource.trim() !== newDest.trim()
);

function resetManual() {
    sourceInput?.reset();
    destInput?.reset();
    error = "";
}

/** Both chats are looked up here, once, rather than on every keystroke. */
async function addManually() {
    if (!canAdd) return;
    adding = true;
    error = "";
    try {
        const [source, dest] = await Promise.all([
            api.resolveChat(newSource.trim()),
            api.resolveChat(newDest.trim())
        ]);
        routes = [...routes, await api.createRoute(source.chatId, dest.chatId)];
        resetManual();
        back();
    } catch (e: any) {
        error = e.message;
    } finally {
        adding = false;
    }
}

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

init();

async function refresh() {
    confirmingRefresh = false;
    refreshing = true;
    refreshNote = "";
    error = "";
    try {
        const result = await api.refreshChatNames();
        routes = result.routes;
        refreshNote = result.failed
            ? `${result.updated} updated, ${result.failed} unreachable — I may have been removed from those chats.`
            : `${result.updated} chat ${result.updated === 1 ? "name" : "names"} updated.`;
    } catch (e: any) {
        error = e.message;
    } finally {
        refreshing = false;
    }
}

const grouped = $derived(
    [
        ...new Map(
            routes.map((r) => [
                r.sourceChatId,
                routes.filter((x) => x.sourceChatId === r.sourceChatId)
            ])
        )
    ].sort(([a], [b]) => a - b)
);

/** Only non-default settings, so divergence between destinations shows. */
function chips(route: Route): string[] {
    const c = withDefaults(route.config);
    const out: string[] = [];
    if (c.mode === "forward") out.push("forward");
    if (c.protectContent) out.push("protected");
    if (c.silent) out.push("silent");
    if (c.removeButtons) out.push("no buttons");
    if (c.filters.whitelist.length)
        out.push(`${c.filters.whitelist.length} allow`);
    if (c.filters.blacklist.length)
        out.push(`${c.filters.blacklist.length} block`);
    if (c.caption.strip) out.push("no caption");
    if (c.caption.removeLinks) out.push("no links");
    if (c.caption.removeMentions) out.push("no mentions");
    if (c.caption.prepend || c.caption.append) out.push("signature");
    if (c.caption.replace.length)
        out.push(`${c.caption.replace.length} replace`);
    return out;
}

const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;

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
    const updated = await api.updateRoute(editing!.id, patch);
    routes = routes.map((r) =>
        r.id === updated.id ? { ...r, ...updated } : r
    );
    editorDirty = false;
}

async function remove() {
    if (!(await confirm("Delete this destination?"))) return;
    await api.deleteRoute(editing!.id);
    routes = routes.filter((r) => r.id !== editing!.id);
    editorDirty = false;
    back();
}

// Seeds history state so the first popstate knows it is back at the root.
replace(initialLoc);
if (needsRoutes(initialLoc)) ensureRoutes(initialLoc);
else loading = false;
</script>

{#snippet actionRow(
    icon: string,
    label: string,
    action: () => void,
    tone = ""
)}
    <button type="button" class="row {tone}" onclick={action}>
        <span class="icon"><Icon name={icon} /></span>
        <span class="grow"><span class="row-label">{label}</span></span>
        <span class="chevron" aria-hidden="true">›</span>
    </button>
{/snippet}

{#snippet addSection()}
    <h2 class="section-title">Add forwarding</h2>
    <div class="card inset-rules">
        {@render actionRow(
            "plus",
            starting ? "Opening picker…" : "Pick from a list",
            startSetFlow,
            "accent"
        )}
        {@render actionRow(
            "plus",
            "Enter chats yourself",
            () => go({ name: "add" }),
            "accent"
        )}
    </div>
    <p class="note">
        The picker lists channels where we are both administrators, and groups I
        am in. Enter a chat yourself when it is not listed.
    </p>
{/snippet}

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
{:else if view === "not-owner" || view === "unclaimed"}
    <NoAccess
        reason={view}
        onhelp={() => go({ name: "help" })}
        onclaimed={() => go({ name: "settings" })}
    />
{:else}
<div class="page">
    <Hero icon="forward" title="Forwarding">
        {#if loading}
            &nbsp;
        {:else if routes.length}
            {plural(grouped.length, "source")} · {plural(
                routes.length,
                "destination"
            )}
        {:else}
            Copy new messages from one chat into another
        {/if}
    </Hero>

    {#if error}<p class="banner">{error}</p>{/if}
    {#if refreshNote}<p class="note refresh-note">{refreshNote}</p>{/if}

    {#if loading}
        <Skeleton />
    {:else if routes.length === 0}
        <div class="empty">
            <strong>Nothing forwarding yet</strong>
            <p>Pick a chat to forward from, and one to forward to.</p>
        </div>
    {:else}
        <div class="stagger">
            {#each grouped as [source, dests], gi (source)}
                <div style="animation-delay:{gi * 45}ms">
                    <RouteLink
                        sourceChatId={source}
                        sourceName={dests[0].sourceName}
                        routes={dests}
                        {chips}
                        onopen={(route) => go({ name: "route", id: route.id, pane: null })}
                    />
                </div>
            {/each}
        </div>
    {/if}

    {@render addSection()}

    <h2 class="section-title">This bot</h2>
    <div class="card inset-rules">
        {@render actionRow("help", "How it works", () => go({ name: "help" }))}
        {@render actionRow("owner", "Owner", () => go({ name: "owner" }))}
        {#if routes.length}
            {@render actionRow("refresh", refreshing ? "Refreshing…" : "Refresh chat names", () => (confirmingRefresh = true))}
        {/if}
    </div>
    <p class="note">
        Refreshing asks Telegram for the current name of every chat, one request
        each.
    </p>
</div>
{/if}

<svelte:window
    onkeydown={(e) => e.key === "Escape" && (confirmingRefresh = false)}
/>

{#if confirmingRefresh}
    <div
        class="scrim"
        role="presentation"
        onclick={() => (confirmingRefresh = false)}
    >
        <div
            class="dialog"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-labelledby="refresh-title"
            onclick={(e) => e.stopPropagation()}
            onkeydown={() => {}}
        >
            <h2 id="refresh-title">Refresh chat names?</h2>
            <p>
                I will ask Telegram for the current name of
                {chatCount === 1 ? "1 chat" : `all ${chatCount} chats`}, one request
                each.
            </p>
            <p>
                Telegram limits how often a bot can do this. Refreshing repeatedly,
                or with many chats, can get the bot temporarily rate limited — which
                also delays forwarding.
            </p>
            <div class="actions">
                <button
                    type="button"
                    class="btn secondary"
                    onclick={() => (confirmingRefresh = false)}>Cancel</button
                >
                <button type="button" class="btn" onclick={refresh}>Refresh</button>
            </div>
        </div>
    </div>
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
        />
    {/key}
{/if}

{#if manual}
    <div class="sheet">
        <div class="sheet-bar">
            <button type="button" class="pill" onclick={back}>
                <Icon name="back" size={16} /> Back
            </button>
            <span class="sheet-title">Add forwarding</span>
            <span></span>
        </div>

        <div class="page">
            <Hero icon="plus" title="Enter chats yourself">
                For chats the picker will not list. I must already be in both of
                them.
            </Hero>

            {#if error}<p class="banner">{error}</p>{/if}

            <div class="card">
                <ChatInput
                    bind:this={sourceInput}
                    bind:value={newSource}
                    label="Source"
                />
                <ChatInput
                    bind:this={destInput}
                    bind:value={newDest}
                    label="Destination"
                />
            </div>
            <p class="note">
                A chat id, an @username or a t.me link. Both are looked up when
                you tap Add, so nothing is checked while you type. In a channel I
                have to be an administrator.
            </p>

            <div class="actions-stack">
                <button
                    type="button"
                    class="btn"
                    disabled={!canAdd || adding}
                    onclick={addManually}
                >
                    {adding ? "Adding…" : "Add forwarding"}
                </button>
            </div>
        </div>
    </div>
{/if}
