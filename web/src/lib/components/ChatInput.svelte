<script lang="ts">
// No lookup while typing: resolving a chat is a Telegram API call, and one per
// keystroke-pause burns the bot's rate limit.
let { label, value = $bindable("") }: { label: string; value?: string } =
    $props();

export function reset() {
    value = "";
}
</script>

<input
    class="input {/^-?\d+$/.test(value.trim()) ? 'mono' : ''}"
    type="text"
    bind:value
    placeholder={label}
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
/>
