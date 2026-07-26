<script lang="ts">
    import { MEDIA_KINDS, type Rule } from "./types";

    import Check from "./Check.svelte";

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
            keyword: { type: "keyword", value: "", caseSensitive: false },
            regex: { type: "regex", pattern: "" },
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
                    placeholder="Word or phrase"
                />
                <div style="margin-top:10px">
                    <Check bind:checked={rule.caseSensitive} label="Match case" />
                </div>
            {:else if rule.type === "regex"}
                <input
                    class="input mono"
                    type="text"
                    bind:value={rule.pattern}
                    placeholder="t\.me/\w+"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                />
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
