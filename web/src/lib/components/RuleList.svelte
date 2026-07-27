<script lang="ts">
import { isBlankRule, ruleIssue } from "$schema";
import { selection } from "../haptics";
import { type MatchTarget, MEDIA_KINDS, type Rule } from "../types";
import Icon from "./Icon.svelte";
import Segmented from "./Segmented.svelte";
import Switch from "./Switch.svelte";

let { rules = $bindable([]) }: { rules: Rule[] } = $props();

// Described, not just named: "regex" or "sender" alone does not say which to pick.
const TYPES: {
    type: Rule["type"];
    label: string;
    what: string;
    icon: string;
}[] = [
    {
        type: "keyword",
        label: "Keyword",
        what: "A word or phrase in the message",
        icon: "keyword"
    },
    {
        type: "regex",
        label: "Pattern",
        what: "A regular expression, for what a keyword cannot express",
        icon: "replace"
    },
    {
        type: "media",
        label: "Media type",
        what: "Photos, videos, documents and the rest",
        icon: "media"
    },
    {
        type: "sender",
        label: "Sender",
        what: "Who posted it, or who it came from",
        icon: "owner"
    }
];

const LABELS = Object.fromEntries(
    TYPES.map((t) => [t.type, t.label])
) as Record<Rule["type"], string>;

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
    selection();
}
</script>

{#snippet targetPicker(rule: Extract<Rule, { target: MatchTarget }>)}
    <div class="row">
        <span class="grow"><span class="row-label">Match against</span></span>
        <Segmented
            bind:value={rule.target}
            options={[
                { value: "text", label: "Text" },
                { value: "filename", label: "File name" }
            ]}
        />
    </div>
{/snippet}

<!-- One card per rule, each with its own note, as BotFather does per setting. -->
{#each rules as rule, i (i)}
    {@const blank = isBlankRule(rule)}
    {@const issue = blank ? null : ruleIssue(rule)}
    <div class="section-head">
        <h2 class="section-title">
            <span class="ordinal">#{i + 1}</span>
            {LABELS[rule.type]}
        </h2>
        <button
            type="button"
            class="icon-btn destructive"
            aria-label="Remove rule {i + 1}"
            onclick={() => remove(i)}
        >
            <Icon name="trash" size={19} />
        </button>
    </div>

    <div class="card">
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
            <Switch bind:checked={rule.caseSensitive} label="Match case" />
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
        {:else if rule.type === "media"}
            <div class="field">
                <span class="field-label">Matches these</span>
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
            </div>
        {:else}
            <input
                class="input"
                type="text"
                value={senderText(rule)}
                oninput={(e) => setSender(rule, e.currentTarget.value)}
                placeholder="Ids or @usernames, comma separated"
                autocapitalize="off"
                spellcheck="false"
            />
        {/if}
    </div>

    {#if issue}
        <p class="note invalid-note">{issue}</p>
    {:else if blank}
        <p class="note">Not filled in yet, so it is dropped when you save.</p>
    {:else if rule.type === "regex"}
        <p class="note">
            Runs on RE2, which cannot backtrack. Lookbehind and backreferences
            are not supported; for a named group use (?P&lt;name&gt;…).
        </p>
    {:else if rule.type === "media"}
        <p class="note">Tap a kind to include or exclude it.</p>
    {:else if rule.type === "sender"}
        <p class="note">
            Matches the author, the channel a post was sent as, and — for a
            forwarded message — who it originally came from.
        </p>
    {/if}
{/each}

<h2 class="section-title">
    {rules.length ? "Add another rule" : "Add a rule"}
</h2>
<div class="card inset-rules">
    {#each TYPES as t}
        <button type="button" class="row accent" onclick={() => add(t.type)}>
            <span class="icon"><Icon name={t.icon} /></span>
            <span class="grow">
                <span class="row-label">{t.label}</span>
                <span class="sub">{t.what}</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
        </button>
    {/each}
</div>
