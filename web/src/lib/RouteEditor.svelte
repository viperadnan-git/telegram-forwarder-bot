<script lang="ts">
import { untrack } from "svelte";
import Check from "./Check.svelte";

import RouteHeader from "./RouteHeader.svelte";
import RuleList from "./RuleList.svelte";
import Switch from "./Switch.svelte";
import {
    type Route,
    type RouteConfig,
    relativeTime,
    withDefaults
} from "./types";

let {
    route,
    onsave,
    onclose,
    ondelete
}: {
    route: Route;
    onsave: (patch: { config: RouteConfig; enabled: boolean }) => Promise<void>;
    onclose: () => void;
    ondelete: () => Promise<void>;
} = $props();

// Seeded once, deliberately non-reactively: the parent keys this component on
// route.id, so a different route remounts rather than reusing this state.
let config = $state<RouteConfig>(untrack(() => withDefaults(route.config)));
let enabled = $state(untrack(() => route.enabled));
let saving = $state(false);
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
        { pattern: "", replacement: "", isRegex: false }
    ]);

const removeReplacement = (i: number) =>
    (config.caption.replace = config.caption.replace.filter((_, n) => n !== i));
</script>

<div class="sheet">
    <div class="sheet-bar">
        <button type="button" class="link" onclick={onclose}>Back</button>
        <span class="sheet-title">Destination</span>
        <button
            type="button"
            class="link"
            style="font-weight:600"
            disabled={saving || conflict}
            onclick={save}
        >
            {saving ? "Saving…" : "Save"}
        </button>
    </div>

    <div class="page">
        <RouteHeader
            sourceChatId={route.sourceChatId}
            sourceName={route.sourceName}
            destChatId={route.destChatId}
            destName={route.destName}
        />

        {#if route.updatedAt}
            <p class="note">Last updated {relativeTime(route.updatedAt)}</p>
        {/if}

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

        <RuleList
            bind:rules={config.filters.whitelist}
            title="Allow only"
            note="Leave empty to allow everything. A message needs to match just one rule."
        />
        <RuleList
            bind:rules={config.filters.blacklist}
            title="Never forward"
            note="Blocking wins: a message matching any rule here is dropped, even if it is allowed above."
        />

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
            <h2 class="section-title">Find and replace</h2>
            <div class="card">
                {#each config.caption.replace as rule, i (i)}
                    <div class="field">
                        <div
                            style="display:flex; align-items:center; gap:8px; margin-bottom:7px"
                        >
                            <span class="field-label" style="margin:0; flex:1">
                                {rule.isRegex ? "Pattern" : "Text"}
                            </span>
                            <button
                                type="button"
                                class="link destructive"
                                style="font-size:14px"
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
                        <div style="margin-top:10px">
                            <Check
                                bind:checked={rule.isRegex}
                                label="Treat as a regular expression"
                            />
                        </div>
                    </div>
                {/each}
                <button type="button" class="row link" onclick={addReplacement}>
                    Add a replacement
                </button>
            </div>
            <p class="note">
                Bold, links and other formatting are kept and re-aligned around your
                edits.
            </p>
        {/if}

        {#if error}<p class="banner">{error}</p>{/if}

        <div style="margin-top:22px">
            <button
                type="button"
                class="btn"
                disabled={saving || conflict}
                onclick={save}
            >
                {saving ? "Saving…" : "Save changes"}
            </button>
        </div>

        <div style="margin-top:10px">
            <button type="button" class="btn danger" onclick={ondelete}>
                Delete this destination
            </button>
        </div>
    </div>
</div>
