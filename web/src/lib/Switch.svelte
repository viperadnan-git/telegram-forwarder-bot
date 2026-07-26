<script lang="ts">
    let {
        checked = $bindable(false),
        label,
        sub
    }: { checked?: boolean; label: string; sub?: string } = $props();
</script>

<!-- Whole row is the control: a full-height tap target, one focusable element. -->
<button
    type="button"
    class="row"
    role="switch"
    aria-checked={checked}
    onclick={() => (checked = !checked)}
>
    <span class="grow">
        <span class="row-label">{label}</span>
        {#if sub}<span class="sub">{sub}</span>{/if}
    </span>
    <span class="switch" aria-hidden="true"><span></span></span>
</button>
