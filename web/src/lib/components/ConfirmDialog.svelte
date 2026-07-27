<script lang="ts">
import type { Snippet } from "svelte";

let {
    title,
    confirmLabel = "Confirm",
    oncancel,
    onconfirm,
    children
}: {
    title: string;
    confirmLabel?: string;
    oncancel: () => void;
    onconfirm: () => void;
    children: Snippet;
} = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && oncancel()} />

<div class="scrim" role="presentation" onclick={oncancel}>
    <!-- Stops a tap inside the dialog reaching the dismiss handler above. -->
    <div
        class="dialog"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label={title}
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
    >
        <h2>{title}</h2>
        {@render children()}
        <div class="actions">
            <button type="button" class="btn secondary" onclick={oncancel}>
                Cancel
            </button>
            <button type="button" class="btn" onclick={onconfirm}>
                {confirmLabel}
            </button>
        </div>
    </div>
</div>

<style>
/* --- dialog -------------------------------------------------------------- */

.scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: var(--gutter);
    background: rgba(0, 0, 0, 0.45);
    animation: fade 0.16s ease;
}

.dialog {
    width: 100%;
    max-width: 320px;
    padding: 20px;
    border-radius: 15px;
    background: var(--section);
    animation: pop 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.dialog h2 {
    margin: 0 0 8px;
    font-size: 17px;
    font-weight: 600;
}

/* The body comes from the caller's snippet, so scoping cannot see it. */
.dialog :global(p) {
    margin: 0 0 10px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--subtitle);
}
</style>
