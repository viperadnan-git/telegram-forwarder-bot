<script lang="ts">
import { selection } from "./haptics";

let { checked = $bindable(), label }: { checked?: boolean; label: string } =
    $props();
</script>

<label class="check">
    <input type="checkbox" bind:checked onchange={selection} />
    <span class="box"></span>
    <span>{label}</span>
</label>

<style>
/* The native checkbox never matches Telegram's chrome. */
.check {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    font-size: 14px;
    color: var(--subtitle);
}

.check input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.check .box {
    flex: none;
    width: 21px;
    height: 21px;
    border-radius: 6px;
    border: 1.5px solid color-mix(in srgb, var(--hint) 55%, transparent);
    background: var(--section);
    display: grid;
    place-items: center;
    transition:
        background 0.14s ease,
        border-color 0.14s ease;
}

.check .box::after {
    content: "";
    width: 10px;
    height: 5.5px;
    border-left: 2px solid var(--button-text);
    border-bottom: 2px solid var(--button-text);
    transform: rotate(-45deg) scale(0.5);
    opacity: 0;
    transition:
        opacity 0.14s ease,
        transform 0.14s ease;
    margin-top: -2px;
}

.check input:checked + .box {
    background: var(--button);
    border-color: var(--button);
}

.check input:checked + .box::after {
    opacity: 1;
    transform: rotate(-45deg) scale(1);
}

.check input:focus-visible + .box {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
</style>
