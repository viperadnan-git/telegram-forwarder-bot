<script lang="ts">
// Stands in for a peer with no picture. Sizes off --node unless given one.
let { chatId, name, size }: { chatId: number; name?: string; size?: number } =
    $props();

// Telegram picks the colour from the MTProto bare id. The Bot API prefixes
// channels and supergroups with -100, which lands on a different colour.
const bare = (id: number) => Math.abs(Number(String(id).replace(/^-100/, "")));

const COLORS = [
    "#CC5049",
    "#D67722",
    "#955CDB",
    "#40A920",
    "#309EBA",
    "#368AD1",
    "#C7508B"
];

const segmenter =
    typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : null;

/** First grapheme: a leading emoji must not be cut in half. */
function lead(word: string): string {
    if (!segmenter) return [...word][0] ?? "";
    return [...segmenter.segment(word)][0]?.segment ?? "";
}

const initials = $derived.by(() => {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const first = lead(words[0]);
    if (words.length === 1) return first.toUpperCase();
    return (first + lead(words[words.length - 1])).toUpperCase();
});

const color = $derived(COLORS[bare(chatId) % COLORS.length]);

// The flat colour is declared first as a fallback: a client without color-mix
// drops the gradient declaration, and white initials on nothing are invisible.
</script>

<span
    class="chat-avatar"
    style="background: {color}; background: linear-gradient(color-mix(in srgb, {color} 84%, #fff), {color});{size
        ? ` --node: ${size}px`
        : ''}"
    aria-hidden="true">{initials}</span>
