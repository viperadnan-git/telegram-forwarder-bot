<script lang="ts">
import Check from "./Check.svelte";
import { type MatchTarget, MEDIA_KINDS, type Rule } from "./types";

let {
    rules = $bindable([]),
    title,
    note
}: { rules: Rule[]; title: string; note: string } = $props();

const TYPES: Rule["type"][] = ["keyword", "regex", "media", "sender"];

const LABELS: Record<Rule["type"], string> = {
    keyword: "Keyword",
    regex: "Regex",
    media: "Media type",
    sender: "Sender"
};

function add(type: Rule["type"]) {
    const blank: Record<Rule["type"], Rule> = {
        keyword: {
            type: "keyword",
            value: "",
            caseSensitive: false,
            target: "text"
        },
        regex: { type: "regex", pattern: "", target: "text" },
        media: { type: "media", kinds: ["photo"] },
        sender: { type: "sender", ids: [], usernames: [] }
    };
    rules = [...rules, blank[type]];
}

const remove = (i: number) => (rules = rules.filter((_, n) => n !== i));

const senderText = (rule: Extract<Rule, { type: "sender" }>) =>
    [...rule.ids.map(String), ...rule.usernames].join(", ");

function setSender(rule: Extract<Rule, { type: "sender" }>, raw: string) {
    const parts = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    rule.ids = parts.filter((p) => /^-?\d+$/.test(p)).map(Number);
    rule.usernames = parts.filter((p) => !/^-?\d+$/.test(p));
}

function toggleKind(rule: Extract<Rule, { type: "media" }>, kind: string) {
    rule.kinds = rule.kinds.includes(kind as any)
        ? rule.kinds.filter((k) => k !== kind)
        : [...rule.kinds, kind as any];
}
</script>

{#snippet targetPicker(rule: Extract<Rule, { target: MatchTarget }>)}
    <div style="display:flex; align-items:center; gap:10px; margin-top:10px">
        <span class="field-label" style="margin:0">Match against</span>
        <div class="segmented">
            <button
                type="button"
                aria-pressed={rule.target === "text"}
                onclick={() => (rule.target = "text")}>Text</button
            >
            <button
                type="button"
                aria-pressed={rule.target === "filename"}
                onclick={() => (rule.target = "filename")}>File name</button
            >
        </div>
    </div>
{/snippet}

<h2 class="section-title">{title}</h2>
<div class="card">
    {#each rules as rule, i (i)}
        <div class="field">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:7px">
                <span class="field-label" style="margin:0; flex:1">
                    {LABELS[rule.type]}
                </span>
                <button
                    type="button"
                    class="link destructive"
                    style="font-size:14px"
                    onclick={() => remove(i)}>Remove</button
                >
            </div>

            {#if rule.type === "keyword"}
                <input
                    class="input"
                    type="text"
                    bind:value={rule.value}
                    placeholder={rule.target === "filename"
                        ? "Part of a file name"
                        : "Word or phrase"}
                />
                {@render targetPicker(rule)}
                <div style="margin-top:10px">
                    <Check bind:checked={rule.caseSensitive} label="Match case" />
                </div>
            {:else if rule.type === "regex"}
                <input
                    class="input mono"
                    type="text"
                    bind:value={rule.pattern}
                    placeholder={rule.target === "filename"
                        ? "\\.(mkv|avi)$"
                        : "t\\.me/\\w+"}
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                />
                {@render targetPicker(rule)}
                <p class="note" style="margin-left:0">
                    Lookbehind and backreferences are not supported.
                </p>
            {:else if rule.type === "media"}
                <div class="chips">
                    {#each MEDIA_KINDS as kind}
                        <button
                            type="button"
                            class="chip"
                            class:off={!rule.kinds.includes(kind)}
                            aria-pressed={rule.kinds.includes(kind)}
                            onclick={() => toggleKind(rule, kind)}>{kind}</button
                        >
                    {/each}
                </div>
            {:else}
                <input
                    class="input"
                    type="text"
                    value={senderText(rule)}
                    oninput={(e) => setSender(rule, e.currentTarget.value)}
                    placeholder="User ids or @usernames, comma separated"
                    autocapitalize="off"
                    spellcheck="false"
                />
            {/if}
        </div>
    {/each}

    <div class="field">
        <span class="field-label">Add a rule</span>
        <div class="chips">
            {#each TYPES as type}
                <button type="button" class="chip" onclick={() => add(type)}>
                    {LABELS[type]}
                </button>
            {/each}
        </div>
    </div>
</div>
<p class="note">{note}</p>
