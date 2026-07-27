<script lang="ts">
import { selection } from "./haptics";

// Owns the selection haptic, so no call site has to remember it.
let {
    value = $bindable(),
    options
}: { value: string; options: { value: string; label: string }[] } = $props();

function pick(next: string) {
    if (next === value) return;
    value = next;
    selection();
}
</script>

<div class="segmented">
    {#each options as option (option.value)}
        <button
            type="button"
            aria-pressed={value === option.value}
            onclick={() => pick(option.value)}
        >
            {option.label}
        </button>
    {/each}
</div>
