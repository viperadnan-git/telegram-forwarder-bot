<script lang="ts">
import type { Snippet } from "svelte";
import Icon from "./Icon.svelte";

// Opens every screen; one place so the spacing and type stay identical.
let {
    icon,
    title,
    muted = false,
    photo,
    children
}: {
    icon: string;
    title: string;
    muted?: boolean;
    photo?: string;
    children?: Snippet;
} = $props();
</script>

<div class="hero">
    {#if photo}
        <img class="avatar" src={photo} alt="" />
    {:else}
        <span class="glyph" class:muted>
            <Icon name={icon} size={38} stroke={1.8} />
        </span>
    {/if}
    <h1>{title}</h1>
    {#if children}<p class="lede">{@render children()}</p>{/if}
</div>
