<script lang="ts">
// Deliberately does no lookup while typing: resolving a chat costs a Telegram
// API call, and one per keystroke-pause burns the bot's rate limit — which
// also delays forwarding. The parent resolves both chats once, on submit.
let { label, value = $bindable("") }: { label: string; value?: string } =
    $props();

export function reset() {
    value = "";
}
</script>

<div class="field">
    <label for="chat-{label}">{label}</label>
    <input
        id="chat-{label}"
        class="input {/^-?\d+$/.test(value.trim()) ? 'mono' : ''}"
        type="text"
        bind:value
        placeholder="Chat id, @username or t.me link"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
    />
</div>
