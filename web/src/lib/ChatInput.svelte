<script lang="ts">
import { type ResolvedChat, resolveChat } from "./api";

import ChatLabel from "./ChatLabel.svelte";

let {
    label,
    chatId = $bindable(null)
}: { label: string; chatId?: number | null } = $props();

let raw = $state("");
let resolved = $state<ResolvedChat | null>(null);
let error = $state("");
let busy = $state(false);

let timer: ReturnType<typeof setTimeout>;
let latest = 0;

function onInput(value: string) {
    raw = value;
    resolved = null;
    error = "";
    chatId = null;
    clearTimeout(timer);

    const trimmed = value.trim();
    if (!trimmed) return;

    // A plain id needs no round trip.
    if (/^-?\d+$/.test(trimmed)) {
        chatId = Number(trimmed);
        return;
    }

    timer = setTimeout(() => void resolve(trimmed), 450);
}

async function resolve(input: string) {
    const seq = ++latest;
    busy = true;
    try {
        const chat = await resolveChat(input);
        if (seq !== latest) return; // a newer keystroke won
        resolved = chat;
        chatId = chat.chatId;
    } catch (e: any) {
        if (seq !== latest) return;
        error = e.message;
    } finally {
        if (seq === latest) busy = false;
    }
}

export function reset() {
    raw = "";
    resolved = null;
    error = "";
    chatId = null;
    latest++;
}
</script>

<div class="field">
    <label for="chat-{label}">{label}</label>
    <input
        id="chat-{label}"
        class="input {/^-?\d+$/.test(raw.trim()) ? 'mono' : ''} {error ? 'invalid' : ''}"
        type="text"
        value={raw}
        oninput={(e) => onInput(e.currentTarget.value)}
        placeholder="Chat id, @username or t.me link"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
    />

    {#if busy}
        <div class="sub">Looking up…</div>
    {:else if error}
        <div class="sub" style="color:var(--destructive)">{error}</div>
    {:else if resolved}
        <div style="display:flex; align-items:center; gap:10px; margin-top:8px">
            <span class="dot"></span>
            <div class="grow">
                <ChatLabel id={resolved.chatId} name={resolved.title} />
            </div>
        </div>
    {/if}
</div>
