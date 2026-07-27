<script lang="ts">
import { selection } from "../haptics";

let {
    checked = $bindable(),
    label,
    sub
}: { checked?: boolean; label: string; sub?: string } = $props();
</script>

<!-- Whole row is the control: a full-height tap target, one focusable element. -->
<button
    type="button"
    class="row"
    role="switch"
    aria-checked={!!checked}
    onclick={() => {
        checked = !checked;
        selection();
    }}
>
    <span class="grow">
        <span class="row-label">{label}</span>
        {#if sub}<span class="sub">{sub}</span>{/if}
    </span>
    <span class="switch" aria-hidden="true"><span></span></span>
</button>

<style>
/* 2 + 27 + 20 + 2 = 51, so the knob lands flush at both ends. */
.switch {
    flex: none;
    display: block;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: var(--destructive);
    box-shadow: none;
    padding: 2px;
    transition:
        background 0.22s ease,
        box-shadow 0.22s ease;
}

[aria-checked="true"] > .switch {
    background: var(--button);
    box-shadow: none;
}

.switch > span {
    display: block;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    box-shadow:
        0 3px 8px rgba(0, 0, 0, 0.15),
        0 1px 1px rgba(0, 0, 0, 0.16);
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

[aria-checked="true"] > .switch > span {
    transform: translateX(18px);
}
</style>
