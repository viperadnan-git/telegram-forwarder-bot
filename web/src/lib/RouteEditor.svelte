<script lang="ts">
import { untrack } from "svelte";
import { replacementIssue, ruleIssue } from "$schema";
import Check from "./Check.svelte";
import Hero from "./Hero.svelte";
import Icon from "./Icon.svelte";
import RouteLink from "./RouteLink.svelte";
import RuleList from "./RuleList.svelte";
import type { Pane } from "./router";
import Switch from "./Switch.svelte";
import {
    type Route,
    type RouteConfig,
    relativeTime,
    withDefaults
} from "./types";

let {
    route,
    pane,
    onpane,
    onsave,
    onclose,
    ondelete,
    ondirty
}: {
    route: Route;
    pane: Pane | null;
    onpane: (pane: Pane | null) => void;
    onsave: (patch: { config: RouteConfig; enabled: boolean }) => Promise<void>;
    onclose: () => void;
    ondelete: () => Promise<void>;
    ondirty: (dirty: boolean) => void;
} = $props();

// Seeded once, deliberately non-reactively: the parent keys this component on
// route.id, so a different route remounts rather than reusing this state.
let config = $state<RouteConfig>(untrack(() => withDefaults(route.config)));
let enabled = $state(untrack(() => route.enabled));
let saving = $state(false);

// Compared against the values this screen opened with, so backing out can warn
// before discarding edits.
// Seeded once, like config and enabled above: this is the baseline to diff against.
const opened = untrack(() =>
    JSON.stringify({
        config: withDefaults(route.config),
        enabled: route.enabled
    })
);
const dirty = $derived(
    JSON.stringify({
        config: $state.snapshot(config),
        enabled
    }) !== opened
);

$effect(() => ondirty(dirty));
let error = $state("");

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

// Checked as you type, against the same schema the server saves with.
const issues = $derived([
    ...config.filters.whitelist.map((r) => ruleIssue(r)),
    ...config.filters.blacklist.map((r) => ruleIssue(r)),
    ...config.caption.replace.map((r) => replacementIssue(r))
]);
const incomplete = $derived(issues.some(Boolean));
const badRules = $derived(
    [...config.filters.whitelist, ...config.filters.blacklist].filter((r) =>
        ruleIssue(r)
    ).length
);
const badReplacements = $derived(
    config.caption.replace.filter((r) => replacementIssue(r)).length
);

async function save() {
    saving = true;
    error = "";
    try {
        await onsave({
            config: $state.snapshot(config) as RouteConfig,
            enabled
        });
        onclose();
    } catch (e: any) {
        error = e.message;
    } finally {
        saving = false;
    }
}

const addReplacement = () =>
    (config.caption.replace = [
        ...config.caption.replace,
        { pattern: "", replacement: "", isRegex: false, caseSensitive: true }
    ]);

const removeReplacement = (i: number) =>
    (config.caption.replace = config.caption.replace.filter((_, n) => n !== i));

const count = (n: number) => (n === 0 ? "None" : `${n}`);
</script>

<div class="sheet">
    <div class="sheet-bar">
        <button type="button" class="pill" onclick={onclose}>
            <Icon name="back" size={16} /> Back
        </button>
        <span class="sheet-title">Destination</span>
        <button
            type="button"
            class="pill accent"
            disabled={saving || conflict || incomplete}
            onclick={save}
        >
            <Icon name="check" size={16} />
            {saving ? "Saving…" : "Save"}
        </button>
    </div>

    <div class="page">
        <Hero
            icon="forward"
            muted={!enabled}
            title={String(route.destName || route.destChatId)}
        >
            {#if enabled}
                Receiving new messages from
                <b>{route.sourceName || route.sourceChatId}</b>
            {:else}
                Paused — nothing is being sent here
            {/if}
        </Hero>

        <h2 class="section-title">Route</h2>
        <RouteLink
            sourceChatId={route.sourceChatId}
            sourceName={route.sourceName}
            routes={[route]}
        />
        <p class="note">
            Tap either id to copy it.{#if route.updatedAt}
                Last changed {relativeTime(route.updatedAt)}.{/if}
        </p>

        <h2 class="section-title">Status</h2>
        <div class="card">
            <Switch
                bind:checked={enabled}
                label="Forwarding active"
                sub={enabled
                    ? "New messages are copied to this destination"
                    : "Paused — nothing is sent to this destination"}
            />
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
                <div class="segmented">
                    <button
                        type="button"
                        aria-pressed={config.mode === "copy"}
                        onclick={() => (config.mode = "copy")}>Copy</button
                    >
                    <button
                        type="button"
                        aria-pressed={config.mode === "forward"}
                        onclick={() => (config.mode = "forward")}>Forward</button
                    >
                </div>
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
                <div class="field">
                    <label for="prepend">Add before</label>
                    <input
                        id="prepend"
                        class="input"
                        type="text"
                        bind:value={config.caption.prepend}
                        placeholder="Text above the caption"
                    />
                </div>
                <div class="field">
                    <label for="append">Add after</label>
                    <input
                        id="append"
                        class="input"
                        type="text"
                        bind:value={config.caption.append}
                        placeholder="Text below the caption"
                    />
                </div>
            {/if}
        </div>

        {#if !config.caption.strip}
            <div class="card inset-rules" style="margin-top:10px">
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

        {#if error}<p class="banner">{error}</p>{/if}

        <h2 class="section-title">Actions</h2>
        <div class="card inset-rules">
            <button
                type="button"
                class="row accent"
                disabled={saving || conflict || incomplete}
                onclick={save}
            >
                <span class="icon"><Icon name="check" /></span>
                <span class="grow">
                    <span class="row-label">
                        {saving ? "Saving…" : "Save changes"}
                    </span>
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
    </div>
</div>

{#if pane}
    {@const meta = {
        allow: {
            title: "Allow only",
            icon: "allow",
            lede: "Only messages matching one of these rules are forwarded. With no rules, everything is."
        },
        block: {
            title: "Never forward",
            icon: "block",
            lede: "Messages matching any rule here are dropped, even when an allow rule matched them."
        },
        replace: {
            title: "Find and replace",
            icon: "replace",
            lede: "Rewrites the caption before it is sent. Formatting is kept and re-aligned around your edits."
        }
    }[pane as Pane]}
    <div class="sheet">
        <div class="sheet-bar">
            <button type="button" class="pill" onclick={() => onpane(null)}>
                <Icon name="back" size={16} /> Back
            </button>
            <span class="sheet-title">{meta.title}</span>
            <span></span>
        </div>

        <div class="page">
            <Hero icon={meta.icon} title={meta.title}>{meta.lede}</Hero>

            {#if pane === "replace"}
                <h2 class="section-title">Replacements</h2>
                <div class="card">
                    {#each config.caption.replace as rule, i (i)}
                        <div class="field">
                            <div class="field-head">
                                <span class="field-label">
                                    {rule.isRegex ? "Pattern" : "Text"}
                                </span>
                                <button
                                    type="button"
                                    class="link destructive"
                                    onclick={() => removeReplacement(i)}>Remove</button
                                >
                            </div>
                            <input
                                class="input {rule.isRegex ? 'mono' : ''}"
                                type="text"
                                bind:value={rule.pattern}
                                placeholder="Find"
                                autocapitalize="off"
                                autocorrect="off"
                                spellcheck="false"
                            />
                            <input
                                class="input"
                                type="text"
                                bind:value={rule.replacement}
                                placeholder="Replace with"
                            />
                            <div class="checks">
                                <Check bind:checked={rule.isRegex} label="Regex" />
                                <!-- Stored as caseSensitive, shown as its inverse. -->
                                <Check
                                    bind:checked={
                                        () => !rule.caseSensitive,
                                        (v) => (rule.caseSensitive = !v)
                                    }
                                    label="Case-insensitive"
                                />
                            </div>
                        </div>
                    {/each}
                    <button type="button" class="row accent" onclick={addReplacement}>
                        <span class="icon"><Icon name="plus" /></span>
                        <span class="grow">
                            <span class="row-label">Add a replacement</span>
                        </span>
                    </button>
                </div>
            {:else if pane === "allow"}
                <RuleList bind:rules={config.filters.whitelist} />
            {:else}
                <RuleList bind:rules={config.filters.blacklist} />
            {/if}

            <div class="actions-stack">
                <button type="button" class="btn" onclick={() => onpane(null)}>
                    Done
                </button>
            </div>
        </div>
    </div>
{/if}
