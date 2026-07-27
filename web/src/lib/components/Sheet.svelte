<script lang="ts">
import type { Snippet } from "svelte";
import Icon from "./Icon.svelte";
import Page from "./Page.svelte";

// A screen stacked over another, with the bar Telegram users expect: back on
// the left, title centred, one optional action on the right.
let {
    title,
    onback,
    backLabel = "Back",
    action,
    children
}: {
    title: string;
    onback: () => void;
    backLabel?: string;
    action?: Snippet;
    children: Snippet;
} = $props();
</script>

<div class="sheet">
    <div class="sheet-bar">
        <button type="button" class="pill" onclick={onback}>
            <Icon name="back" size={16} />
            {backLabel}
        </button>
        <span class="sheet-title">{title}</span>
        {#if action}{@render action()}{:else}<span></span>{/if}
    </div>

    <Page>{@render children()}</Page>
</div>
