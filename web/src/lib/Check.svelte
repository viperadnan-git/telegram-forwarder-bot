<script lang="ts">
    let {
        checked = $bindable(false),
        label
    }: { checked?: boolean; label: string } = $props();
</script>

<label class="check">
    <input type="checkbox" bind:checked />
    <span class="box"></span>
    <span>{label}</span>
</label>
