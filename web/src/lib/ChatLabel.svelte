<script lang="ts">
// The -100 prefix is on every channel id, so it is muted.
let { id, name }: { id: number; name?: string } = $props();

const text = $derived(String(id));
const prefix = $derived(text.startsWith("-100") ? "-100" : "");
const body = $derived(prefix ? text.slice(4) : text);
</script>

{#if name}
    <div class="chat-name">{name}</div>
    <div class="cid small">
        {#if prefix}<span class="pre">{prefix}</span>{/if}{body}
    </div>
{:else}
    <div class="cid">
        {#if prefix}<span class="pre">{prefix}</span>{/if}{body}
    </div>
{/if}
