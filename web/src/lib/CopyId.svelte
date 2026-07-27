<script lang="ts">
import { impact } from "./haptics";
import { copyText } from "./telegram";

let { id }: { id: number } = $props();

let copied = $state(false);
let timer: ReturnType<typeof setTimeout>;

// The -100 prefix is on every channel id, so it is muted.
const parts = $derived(
    String(id).startsWith("-100")
        ? { pre: "-100", body: String(id).slice(4) }
        : { pre: "", body: String(id) }
);

async function copy(event: MouseEvent) {
    // Sits inside a row that opens on tap; copying must not also navigate.
    event.stopPropagation();
    if (!(await copyText(String(id)))) return;
    copied = true;
    impact();
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1600);
}
</script>

<button
    type="button"
    class="cid-copy"
    onclick={copy}
    aria-label="Copy chat id {id}"
>
    {#if copied}
        <span class="copied">Copied</span>
    {:else}
        <span class="cid"
            >{#if parts.pre}<span class="pre">{parts.pre}</span>{/if}{parts.body}</span
        >
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <rect x="9" y="9" width="12" height="12" rx="2.5" />
            <path d="M6 15V5a2 2 0 0 1 2-2h10" />
        </svg>
    {/if}
</button>

<style>
.cid-copy {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 3px;
    padding: 2px 0;
    color: var(--text);
    /* The row behind it is the control; the id must still be tappable. */
    pointer-events: auto;
}

.cid-copy:active {
    opacity: 0.55;
}

.cid-copy .copied {
    font-size: 13px;
    color: var(--accent);
}
</style>
