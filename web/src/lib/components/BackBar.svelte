<script lang="ts">
import Icon from "./Icon.svelte";

let { onback, label = "Back" }: { onback: () => void; label?: string } =
    $props();
</script>

<div class="topbar">
    <button type="button" class="pill" onclick={onback}>
        <Icon name="back" size={16} />
        {label}
    </button>
</div>

<style>
/* Sits inside .page, so cancel its gutter to land where the sheet bar does. */
.topbar {
    margin: 0 calc(var(--gutter) * -1);
    padding: calc(var(--safe-top) + 9px) 10px 0;
}
</style>
