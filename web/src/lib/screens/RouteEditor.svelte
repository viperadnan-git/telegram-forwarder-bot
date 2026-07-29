<script lang="ts">
import { untrack } from "svelte";
import {
    defaultConfig,
    isBlankReplacement,
    isBlankRule,
    isStopped,
    pruneConfig,
    replacementIssue,
    ruleIssue,
    statusLabel
} from "$schema";
import Hero from "../components/Hero.svelte";
import Icon from "../components/Icon.svelte";
import RouteLink from "../components/RouteLink.svelte";
import RulePane from "../components/RulePane.svelte";
import Segmented from "../components/Segmented.svelte";
import Sheet from "../components/Sheet.svelte";
import Switch from "../components/Switch.svelte";
import { alert, ask } from "../dialog.svelte";
import type { Pane } from "../router";
import {
    type Route,
    type RouteConfig,
    relativeTime,
    withDefaults
} from "../types";

let {
    route,
    pane,
    onpane,
    onsave,
    onclose,
    ondelete,
    ondirty,
    onrefresh,
    refreshing
}: {
    route: Route;
    pane: Pane | null;
    onpane: (pane: Pane | null) => void;
    onsave: (patch: { config: RouteConfig; status?: string }) => Promise<void>;
    onclose: () => void;
    ondelete: () => Promise<void>;
    ondirty: (dirty: boolean) => void;
    onrefresh: () => void;
    refreshing: boolean;
} = $props();

// Seeded once, deliberately non-reactively: the parent keys this component on
// route.id, so a different route remounts rather than reusing this state.
let config = $state<RouteConfig>(untrack(() => withDefaults(route.config)));
const openedActive = untrack(() => route.status === "active");
let active = $state(openedActive);
let saving = $state(false);

// The baseline this screen opened with, so backing out can warn before
// discarding edits. An empty box and an absent field are the same stored
// config, so typing a character and deleting it is not an edit.
const fingerprint = (config: RouteConfig, active: boolean) =>
    JSON.stringify({ config, active }, (_, v) => (v === "" ? undefined : v));

const opened = untrack(() =>
    fingerprint(withDefaults(route.config), openedActive)
);
const dirty = $derived(fingerprint($state.snapshot(config), active) !== opened);

$effect(() => ondirty(dirty));

// Stopped by a failure, not paused by the owner.
const stopped = $derived(isStopped(route.status));

// Surfaced here so the save does not fail server-side instead.
const transforms = $derived(
    config.caption.strip ||
        config.caption.removeLinks ||
        config.caption.removeMentions ||
        config.caption.replace.length > 0 ||
        !!config.caption.prepend ||
        !!config.caption.append
);
const conflict = $derived(
    config.mode === "forward" && (transforms || config.removeButtons)
);

// Checked as you type, against the same schema the server saves with. A row
// the user has not filled in yet is not an error — it is dropped on save.
const badRules = $derived(
    [...config.filters.whitelist, ...config.filters.blacklist].filter(
        (r) => !isBlankRule(r) && ruleIssue(r)
    ).length
);
const badReplacements = $derived(
    config.caption.replace.filter(
        (r) => !isBlankReplacement(r) && replacementIssue(r)
    ).length
);
const incomplete = $derived(badRules + badReplacements > 0);

// Deliberately leaves the status alone: resuming a paused destination would
// start delivering messages, which is not what "reset the settings" implies.
const isDefault = $derived(
    JSON.stringify($state.snapshot(config)) === JSON.stringify(defaultConfig())
);

async function reset() {
    const ok = await ask(
        "Reset to defaults?",
        [
            "Every filter and caption rule on this destination is cleared, and delivery goes back to a plain copy.",
            "Nothing is saved until you tap Save, so you can still back out."
        ],
        "Reset"
    );
    if (ok) config = defaultConfig();
}

async function save() {
    saving = true;
    try {
        await onsave({
            config: pruneConfig($state.snapshot(config) as RouteConfig),
            // Only when the switch moved: sending "paused" for an untouched
            // stopped route would overwrite why it stopped.
            ...(active === openedActive
                ? {}
                : { status: active ? "active" : "paused" })
        });
        onclose();
    } catch (e: any) {
        await alert("Could not save", e.message);
    } finally {
        saving = false;
    }
}

const count = (n: number) => (n === 0 ? "None" : `${n}`);

const addedText = $derived(
    config.caption.prepend && config.caption.append
        ? "Above and below"
        : config.caption.prepend
          ? "Above"
          : config.caption.append
            ? "Below"
            : "None"
);
</script>

{#snippet saveAction()}
    <button
        type="button"
        class="pill accent"
        disabled={saving || conflict || incomplete}
        onclick={save}
    >
        <Icon name={saving ? "spinner" : "check"} size={16} spin={saving} />
        Save
    </button>
{/snippet}

<Sheet title="Destination" onback={onclose} action={saveAction}>
    <Hero
        icon="forward"
        muted={!active}
        title={String(route.destName || route.destChatId)}
    >
        {#if active}
            Receiving new messages from
            <b>{route.sourceName || route.sourceChatId}</b>
        {:else if stopped}
            Stopped — {statusLabel(route.status)}
        {:else}
            Paused — nothing is being sent here
        {/if}
    </Hero>

    <div class="section-head">
        <h2 class="section-title">Route</h2>
        <!-- Two chats, so one tap costs two getChat calls at most. -->
        <button
            type="button"
            class="icon-btn"
            aria-label="Refresh chat names"
            disabled={refreshing}
            onclick={onrefresh}
        >
            <Icon
                name={refreshing ? "spinner" : "refresh"}
                size={17}
                spin={refreshing}
            />
        </button>
    </div>
    <RouteLink
        sourceChatId={route.sourceChatId}
        sourceName={route.sourceName}
        routes={[route]}
    />
    {#if route.updatedAt}
        <p class="note">Last changed {relativeTime(route.updatedAt)}.</p>
    {/if}

    <h2 class="section-title">Status</h2>
    {#if stopped}
        <p class="banner">
            I stopped this forward: {statusLabel(route.status)}. Fix it in
            Telegram, then turn it back on — I check again before resuming.
        </p>
    {/if}
    <div class="card">
        <Switch
            bind:checked={active}
            label="Forwarding active"
            sub={active
                ? "New messages are copied to this destination"
                : stopped
                  ? "Stopped after a delivery failure"
                  : "Paused — nothing is sent to this destination"}
        />
        <div class="row">
            <span class="grow">
                <span class="row-label">
                    {route.forwarded
                        ? `Last delivery ${relativeTime(route.lastForwardedAt ?? undefined)}`
                        : "No deliveries yet"}
                </span>
                {#if route.forwarded}
                    <span class="sub">
                        {route.forwarded.toLocaleString()} forwarded in total
                    </span>
                {/if}
            </span>
        </div>
    </div>

    <h2 class="section-title">Delivery</h2>
    <div class="card">
        <div class="row">
            <div class="grow">
                <div class="row-label">Mode</div>
                <div class="sub">
                    {config.mode === "copy"
                        ? "Sent as a new message, no attribution"
                        : "Shows “Forwarded from”"}
                </div>
            </div>
            <Segmented
                bind:value={config.mode}
                options={[
                    { value: "copy", label: "Copy" },
                    { value: "forward", label: "Forward" }
                ]}
            />
        </div>
        <Switch
            bind:checked={config.protectContent}
            label="Protect content"
            sub="Recipients cannot forward or save"
        />
        <Switch
            bind:checked={config.silent}
            label="Send silently"
            sub="Arrives without a notification sound"
        />
        <Switch
            bind:checked={config.removeButtons}
            label="Remove buttons"
            sub="Drop inline buttons from the original message"
        />
    </div>

    {#if conflict}
        <p class="banner">
            Forward mode relays the original message untouched, so it cannot
            change captions or remove buttons. Switch to Copy, or clear those
            options.
        </p>
    {/if}

    <h2 class="section-title">Filters</h2>
    <div class="card inset-rules">
        <button type="button" class="row" onclick={() => onpane("allow")}>
            <span class="icon"><Icon name="allow" /></span>
            <span class="grow"><span class="row-label">Allow only</span></span>
            <span
                class="row-value"
                class:invalid-value={config.filters.whitelist.some((r) =>
                    ruleIssue(r)
                )}>{count(config.filters.whitelist.length)}</span
            >
            <span class="chevron" aria-hidden="true">›</span>
        </button>
        <button type="button" class="row" onclick={() => onpane("block")}>
            <span class="icon"><Icon name="block" /></span>
            <span class="grow"><span class="row-label">Never forward</span></span>
            <span
                class="row-value"
                class:invalid-value={config.filters.blacklist.some((r) =>
                    ruleIssue(r)
                )}>{count(config.filters.blacklist.length)}</span
            >
            <span class="chevron" aria-hidden="true">›</span>
        </button>
    </div>
    <p class="note">
        With no allow rules everything gets through. Blocking always wins.
    </p>

    <h2 class="section-title">Caption</h2>
    <div class="card">
        <Switch
            bind:checked={config.caption.strip}
            label="Remove caption"
            sub="Send the media with no text at all"
        />
        {#if !config.caption.strip}
            <Switch bind:checked={config.caption.removeLinks} label="Remove links" />
            <Switch
                bind:checked={config.caption.removeMentions}
                label="Remove @mentions"
            />
        {/if}
    </div>

    {#if !config.caption.strip}
        <div class="card inset-rules">
            <button type="button" class="row" onclick={() => onpane("text")}>
                <span class="icon"><Icon name="keyword" /></span>
                <span class="grow">
                    <span class="row-label">Added text</span>
                </span>
                <span class="row-value">{addedText}</span>
                <span class="chevron" aria-hidden="true">›</span>
            </button>
        </div>
        <p class="note">
            Your own text above and below the caption, each on its own line.
        </p>

        <div class="card inset-rules">
            <button type="button" class="row" onclick={() => onpane("replace")}>
                <span class="icon"><Icon name="replace" /></span>
                <span class="grow">
                    <span class="row-label">Find and replace</span>
                </span>
                <span
                    class="row-value"
                    class:invalid-value={badReplacements > 0}
                >
                    {count(config.caption.replace.length)}
                </span>
                <span class="chevron" aria-hidden="true">›</span>
            </button>
        </div>
        <p class="note">
            Bold, links and other formatting are kept and re-aligned around your
            edits.
        </p>
    {/if}

    {#if incomplete}
        <p class="banner">
            {#if badRules}
                {badRules === 1 ? "A rule needs" : `${badRules} rules need`}
                finishing.
            {/if}
            {#if badReplacements}
                {badReplacements === 1
                    ? "A replacement needs"
                    : `${badReplacements} replacements need`} finishing.
            {/if}
        </p>
    {/if}



    <h2 class="section-title">Actions</h2>
    <div class="card inset-rules">
        <button
            type="button"
            class="row accent"
            disabled={saving || conflict || incomplete}
            onclick={save}
        >
            <span class="icon">
                <Icon name={saving ? "spinner" : "check"} spin={saving} />
            </span>
            <span class="grow">
                <span class="row-label">Save changes</span>
            </span>
        </button>
        <button
            type="button"
            class="row"
            disabled={isDefault || saving}
            onclick={reset}
        >
            <span class="icon"><Icon name="undo" /></span>
            <span class="grow">
                <span class="row-label">Reset to defaults</span>
            </span>
        </button>
        <button type="button" class="row destructive" onclick={ondelete}>
            <span class="icon"><Icon name="trash" /></span>
            <span class="grow">
                <span class="row-label">Delete this destination</span>
            </span>
        </button>
    </div>
    <p class="note">
    Deleting leaves the source forwarding to its other destinations.
    </p>
</Sheet>

{#if pane}
    <RulePane {pane} bind:config onclose={() => onpane(null)} />
{/if}
