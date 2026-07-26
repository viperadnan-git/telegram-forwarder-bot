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
