<script lang="ts">
    import * as api from "./lib/api";

    import { type Route, type RouteConfig, withDefaults } from "./lib/types";
    import { botId, close, confirm, init } from "./lib/telegram";

    import { ApiError } from "./lib/api";
    import ChatInput from "./lib/ChatInput.svelte";
    import ChatLabel from "./lib/ChatLabel.svelte";
    import Skeleton from "./lib/Skeleton.svelte";
    import NoAccess from "./lib/NoAccess.svelte";
    import RouteEditor from "./lib/RouteEditor.svelte";

    let routes = $state<Route[]>([]);
    let loading = $state(true);
    let error = $state("");
    let denied = $state<"unclaimed" | "not_owner" | null>(null);
    let editing = $state<Route | null>(null);
    let refreshing = $state(false);
    let refreshNote = $state("");
    let confirmingRefresh = $state(false);

    // How many getChat calls a refresh costs.
    const chatCount = $derived(
        new Set(routes.flatMap((r) => [r.sourceChatId, r.destChatId])).size
    );
    let starting = $state(false);
    let manual = $state(false);
    let adding = $state(false);
    let newSource = $state<number | null>(null);
    let newDest = $state<number | null>(null);
    let sourceInput = $state<ChatInput>();
    let destInput = $state<ChatInput>();

    const canAdd = $derived(
        newSource !== null && newDest !== null && newSource !== newDest
    );

    function cancelManual() {
        sourceInput?.reset();
        destInput?.reset();
        manual = false;
        error = "";
    }

    async function addManually() {
        if (!canAdd) return;
        adding = true;
        error = "";
        try {
            routes = [...routes, await api.createRoute(newSource!, newDest!)];
            sourceInput?.reset();
            destInput?.reset();
            manual = false;
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
        if (c.filters.whitelist.length) out.push(`${c.filters.whitelist.length} allow`);
        if (c.filters.blacklist.length) out.push(`${c.filters.blacklist.length} block`);
        if (c.caption.strip) out.push("no caption");
        if (c.caption.removeLinks) out.push("no links");
        if (c.caption.removeMentions) out.push("no mentions");
        if (c.caption.prepend || c.caption.append) out.push("signature");
        if (c.caption.replace.length) out.push(`${c.caption.replace.length} replace`);
        return out;
    }

    const plural = (n: number, one: string, many = one + "s") =>
        `${n} ${n === 1 ? one : many}`;

    async function load() {
        loading = true;
        error = "";
        try {
            routes = await api.listRoutes();
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 403) {
                denied = e.reason === "unclaimed" ? "unclaimed" : "not_owner";
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
    }

    async function remove() {
        if (!(await confirm("Delete this destination?"))) return;
        await api.deleteRoute(editing!.id);
        routes = routes.filter((r) => r.id !== editing!.id);
        editing = null;
    }

    if (botId()) {
        load();
    } else {
        loading = false;
        error = "Open this page from your bot so it knows which bot to configure.";
    }
</script>

{#snippet addSection()}
    <div style="margin-top:14px">
        <button type="button" class="btn" disabled={starting} onclick={startSetFlow}>
            {starting ? "Opening picker…" : "Add forwarding"}
        </button>
    </div>
    <p class="note">
        Telegram shows the chat picker in your chat with the bot, so this window
        closes when you tap it.
    </p>

    {#if manual}
        <div class="card" style="margin-top:14px">
            <ChatInput bind:this={sourceInput} bind:chatId={newSource} label="Source" />
            <ChatInput bind:this={destInput} bind:chatId={newDest} label="Destination" />
        </div>
        <div style="margin-top:10px">
            <button
                type="button"
                class="btn"
                disabled={!canAdd || adding}
                onclick={addManually}
            >
                {adding ? "Adding…" : "Add route"}
            </button>
        </div>
        <div style="margin-top:8px">
            <button type="button" class="btn secondary" onclick={cancelManual}>
                Cancel
            </button>
        </div>
        <p class="note">
            I must already be in both chats — an administrator, if it is a channel.
        </p>
    {:else}
        <div style="margin-top:10px">
            <button type="button" class="btn secondary" onclick={() => (manual = true)}>
                Add forwarding (manual)
            </button>
        </div>
        <p class="note">
            Enter chats yourself with a chat id, @username or t.me link. Use this for
            chats the picker does not list — but I still have to be in both.
        </p>
    {/if}
{/snippet}

{#if denied}
    <NoAccess reason={denied} />
{:else}
<div class="page">
    <header class="masthead">
        <div class="grow">
            <h1>Forwarding</h1>
            <p>
            {#if loading}
                &nbsp;
            {:else if routes.length}
                {plural(grouped.length, "source")} · {plural(
                    routes.length,
                    "destination"
                )}
            {:else}
                Nothing forwarding yet
            {/if}
            </p>
        </div>

        {#if routes.length}
            <button
                type="button"
                class="icon-btn"
                class:busy={refreshing}
                disabled={refreshing}
                aria-label="Refresh chat names"
                onclick={() => (confirmingRefresh = true)}
            >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.1" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path d="M21 3v6h-6" />
                </svg>
            </button>
        {/if}
    </header>

    {#if error}<p class="banner">{error}</p>{/if}

    {#if loading}
        <Skeleton />
    {:else if routes.length === 0}
        <div class="empty">
            <strong>No routes yet</strong>
            <p>Pick a chat to forward from, and one to forward to.</p>
        </div>

    {:else}
        <div class="stagger">
            {#each grouped as [source, dests], gi (source)}
                <div class="bay" style="animation-delay:{gi * 45}ms">
                    <div class="node">
                        <span class="dot"></span>
                        <div class="grow">
                            <ChatLabel id={source} name={dests[0].sourceName} />
                            <div class="sub">
                                {plural(dests.length, "destination")}
                            </div>
                        </div>
                    </div>

                    {#each dests as route (route.id)}
                        {@const tags = chips(route)}
                        <button
                            type="button"
                            class="drop"
                            class:paused={!route.enabled}
                            onclick={() => (editing = route)}
                        >
                            <span
                                class="dot"
                                class:hollow={tags.length === 0 || !route.enabled}
                            ></span>
                            <div class="grow">
                                <ChatLabel
                                    id={route.destChatId}
                                    name={route.destName}
                                />
                                {#if !route.enabled || tags.length}
                                    <div class="chips">
                                        {#if !route.enabled}
                                            <span class="chip off">paused</span>
                                        {/if}
                                        {#each tags as tag}
                                            <span class="chip">{tag}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <span class="chevron" aria-hidden="true">›</span>
                        </button>
                    {/each}
                </div>
            {/each}
        </div>
    {/if}

    {@render addSection()}

    {#if refreshNote}<p class="note">{refreshNote}</p>{/if}
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
            onsave={save}
            onclose={() => (editing = null)}
            ondelete={remove}
        />
    {/key}
{/if}
