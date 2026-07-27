<script lang="ts">
import Icon from "./Icon.svelte";

let {
    icon,
    label,
    tone = "",
    onclick
}: {
    icon: string;
    label: string;
    tone?: "" | "accent" | "destructive";
    onclick: () => void;
} = $props();
</script>

<button type="button" class="row {tone}" {onclick}>
    <span class="icon"><Icon name={icon} /></span>
    <span class="grow"><span class="row-label">{label}</span></span>
    <span class="chevron" aria-hidden="true">›</span>
</button>
