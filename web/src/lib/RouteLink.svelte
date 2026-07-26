<script lang="ts">
import CopyId from "./CopyId.svelte";
import Icon from "./Icon.svelte";
import type { Route } from "./types";

// One source feeding many destinations. The source is stated once and the rail
// runs down through every destination, so the linkage is the component rather
// than something the reader infers from adjacent rows.
let {
    sourceChatId,
    sourceName,
    routes,
    chips,
    onopen
}: {
    sourceChatId: number;
    sourceName?: string;
    routes: Route[];
    chips?: (route: Route) => string[];
    onopen?: (route: Route) => void;
} = $props();
</script>

<div class="card linkage">
    <div class="link-source">
        <span class="link-rail down" aria-hidden="true"></span>
        <span class="link-node">
            <Icon name="source" size={13} stroke={2.4} />
        </span>
        <span class="grow">
            <span class="chat-name">{sourceName || "Unnamed chat"}</span>
            <CopyId id={sourceChatId} />
        </span>
    </div>

    {#each routes as route (route.id)}
        {@const tags = chips?.(route) ?? []}
        <div class="link-dest" class:paused={!route.enabled}>
            {#if onopen}
                <!-- Covers the row so any part of it opens, except the id. -->
                <button
                    type="button"
                    class="link-hit"
                    onclick={() => onopen(route)}
                    aria-label="Edit {route.destName || route.destChatId}"
                ></button>
            {/if}
            <span class="link-rail" aria-hidden="true"></span>
            <span class="link-node">
                <Icon name="arrow" size={13} stroke={2.4} />
            </span>
            <span class="grow">
                <span class="chat-name">
                    {route.destName || "Unnamed chat"}
                </span>
                <CopyId id={route.destChatId} />
                {#if !route.enabled || tags.length}
                    <span class="chips">
                        {#if !route.enabled}<span class="chip off">paused</span>{/if}
                        {#each tags as tag}<span class="chip">{tag}</span>{/each}
                    </span>
                {/if}
            </span>
            {#if onopen}
                <span class="chevron" aria-hidden="true">›</span>
            {/if}
        </div>
    {/each}
</div>
