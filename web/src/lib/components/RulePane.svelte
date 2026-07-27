<script lang="ts">
import type { Pane } from "../router";
import type { RouteConfig } from "../types";
import Hero from "./Hero.svelte";
import ReplaceList from "./ReplaceList.svelte";
import RuleList from "./RuleList.svelte";
import Sheet from "./Sheet.svelte";
import TextArea from "./TextArea.svelte";

let {
    pane,
    config = $bindable(),
    onclose
}: { pane: Pane; config: RouteConfig; onclose: () => void } = $props();

const META: Record<Pane, { title: string; icon: string; lede: string }> = {
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
    },
    text: {
        title: "Added text",
        icon: "keyword",
        lede: "Text of your own around the caption. Each part goes on its own line."
    }
};

const meta = $derived(META[pane]);
</script>

<Sheet title={meta.title} onback={onclose}>
    <Hero icon={meta.icon} title={meta.title}>{meta.lede}</Hero>

    {#if pane === "text"}
        <h2 class="section-title">Around the caption</h2>
        <div class="card">
            <TextArea
                bind:value={config.caption.prepend}
                placeholder="Line above the caption"
            />
            <TextArea
                bind:value={config.caption.append}
                placeholder="Line below the caption"
            />
        </div>
        <p class="note">
            Spacing is kept exactly as you type it, so blank lines and indents
            survive. Leave a box empty to add nothing there.
        </p>
    {:else if pane === "replace"}
        <ReplaceList bind:rules={config.caption.replace} />
    {:else if pane === "allow"}
        <RuleList bind:rules={config.filters.whitelist} />
    {:else}
        <RuleList bind:rules={config.filters.blacklist} />
    {/if}

    <div class="actions-stack">
        <button type="button" class="btn" onclick={onclose}>Done</button>
    </div>
</Sheet>
