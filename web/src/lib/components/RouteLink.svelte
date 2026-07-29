<script lang="ts">
import { isStopped, type Route } from "../types";
import Avatar from "./Avatar.svelte";
import CopyId from "./CopyId.svelte";

// One source feeding many destinations: stated once, with a rail running down
// through each, so the linkage is drawn rather than inferred.
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
        <Avatar chatId={sourceChatId} name={sourceName} />
        <span class="grow">
            <span class="chat-name">{sourceName || "Unnamed chat"}</span>
            <CopyId id={sourceChatId} />
        </span>
    </div>

    {#each routes as route, i (route.id)}
        {@const tags = chips?.(route) ?? []}
        <div class="link-dest" class:paused={route.status !== "active"}>
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
            {#if i < routes.length - 1}
                <!-- Carries the line on to the next destination. -->
                <span class="link-rail down" aria-hidden="true"></span>
            {/if}
            <Avatar chatId={route.destChatId} name={route.destName} />
            <span class="grow">
                <span class="chat-name">
                    {route.destName || "Unnamed chat"}
                </span>
                <CopyId id={route.destChatId} />
                {#if route.status !== "active" || tags.length}
                    <span class="chips">
                        {#if isStopped(route.status)}
                            <span class="chip stopped">stopped</span>
                        {:else if route.status === "paused"}
                            <span class="chip off">paused</span>
                        {/if}
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
