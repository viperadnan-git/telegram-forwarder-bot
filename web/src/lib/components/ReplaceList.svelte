<script lang="ts">
import { isBlankReplacement } from "$schema";
import type { RouteConfig } from "../types";
import Check from "./Check.svelte";
import Icon from "./Icon.svelte";

let { rules = $bindable() }: { rules: RouteConfig["caption"]["replace"] } =
    $props();

const add = () =>
    (rules = [
        ...rules,
        { pattern: "", replacement: "", isRegex: false, caseSensitive: true }
    ]);

const remove = (i: number) => (rules = rules.filter((_, n) => n !== i));
</script>

<!-- One card per replacement, headed and removable, exactly like a filter rule. -->
{#each rules as rule, i (i)}
    <div class="section-head">
        <h2 class="section-title">
            <span class="ordinal">#{i + 1}</span>
            {rule.isRegex ? "Pattern" : "Text"}
        </h2>
        <button
            type="button"
            class="icon-btn destructive"
            aria-label="Remove replacement {i + 1}"
            onclick={() => remove(i)}
        >
            <Icon name="trash" size={19} />
        </button>
    </div>

    <div class="card">
        <input
            class="input {rule.isRegex ? 'mono' : ''}"
            type="text"
            bind:value={rule.pattern}
            placeholder="Find"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
        />
        <input
            class="input"
            type="text"
            bind:value={rule.replacement}
            placeholder="Replace with"
        />
        <div class="field checks">
            <Check bind:checked={rule.isRegex} label="Regex" />
            <!-- Stored as caseSensitive, shown as its inverse. -->
            <Check
                bind:checked={
                    () => !rule.caseSensitive,
                    (v) => (rule.caseSensitive = !v)
                }
                label="Case-insensitive"
            />
        </div>
    </div>
    {#if isBlankReplacement(rule)}
        <p class="note">Not filled in yet, so it is dropped when you save.</p>
    {/if}
{/each}

<h2 class="section-title">
    {rules.length ? "Add another replacement" : "Add a replacement"}
</h2>
<div class="card inset-rules">
    <button type="button" class="row accent" onclick={add}>
        <span class="icon"><Icon name="plus" /></span>
        <span class="grow"><span class="row-label">Add a replacement</span></span>
    </button>
</div>
