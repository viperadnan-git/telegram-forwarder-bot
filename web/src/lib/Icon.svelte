<script lang="ts">
// Outline glyphs on a 24 box, matching the weight BotFather uses on its rows.
const PATHS: Record<string, string | string[]> = {
    plus: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8v8M8 12h8",
    info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v5M12 7.6v.4",
    owner: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21c0-3.9 3.1-7 7-7h.7M16 17l3-3-3-3M13 14h6",
    refresh: "M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6",
    forward: "M4 7h8a5 5 0 0 1 5 5v5M13 13l4 4 4-4",
    back: "M15 18l-6-6 6-6",
    help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.2M12 17v.4",
    source: "M5 12h14M13 6l6 6-6 6",
    check: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M8.2 12.3l2.7 2.7 5-5.4"],
    keyword: "M4 7h16M4 12h11M4 17h7",
    media: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
    allow: "M12 3l7.5 3.2v5c0 4.4-3 8.3-7.5 9.6C7.5 19.5 4.5 15.6 4.5 11.2v-5z",
    block: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M5.6 5.6l12.8 12.8",
    replace: "M4 7h10M4 7l3-3M4 7l3 3M20 17H10M20 17l-3-3M20 17l-3 3",
    arrow: "M12 5v14M6 13l6 6 6-6",
    trash: "M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5",
    key: "M15.5 3a5.5 5.5 0 0 0-5.2 7.3L3 17.6V21h3.4l1-1v-1.6h1.6l1-1v-1.6h1.6l1.1-1.1A5.5 5.5 0 1 0 15.5 3M17 7.5v.01"
};

let {
    name,
    size = 24,
    stroke = 1.9
}: {
    name: keyof typeof PATHS | string;
    size?: number;
    stroke?: number;
} = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>
    {#each [PATHS[name] ?? ""].flat() as d}
        <path {d} />
    {/each}
</svg>
