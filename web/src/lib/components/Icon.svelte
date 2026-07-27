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
    undo: ["M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 8.6", "M3 3.5V9h5.5"],
    trash: "M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5",
    key: "M15.5 3a5.5 5.5 0 0 0-5.2 7.3L3 17.6V21h3.4l1-1v-1.6h1.6l1-1v-1.6h1.6l1.1-1.1A5.5 5.5 0 1 0 15.5 3M17 7.5v.01",
    // Three quarters of a circle, so the gap shows the rotation.
    spinner: "M12 3a9 9 0 1 0 9 9",
    // The bot's own mark: filled, unlike the glyphs.
    mark: "M16.51 23.94 C16.1 23.85 15.74 23.5 15.63 23.1 C15.59 22.98 15.56 22.32 15.56 21.64 L15.56 20.42 L10.98 20.39 C6.19 20.36 6.02 20.35 5.12 20.07 C2.64 19.31 0.75 17.23 0.17 14.59 C0.09 14.24 0.07 13.51 0.05 10.54 C0.02 6.65 0.04 6.18 0.31 5.26 C1.02 2.8 2.99 0.87 5.45 0.24 C6.25 0.04 7.32 0 12 0 C16.69 -0 17.75 0.04 18.56 0.25 C20.23 0.67 21.75 1.76 22.75 3.25 C23.25 3.99 23.61 4.87 23.83 5.85 C23.92 6.25 23.93 6.97 23.95 11.6 C23.97 15.12 23.96 17.11 23.91 17.5 C23.59 20.48 21.56 22.88 18.66 23.72 C18.37 23.8 17.89 23.89 17.59 23.91 C17.3 23.93 16.97 23.95 16.87 23.97 C16.77 23.98 16.61 23.97 16.51 23.94Z M14.66 13.65 C14.99 13.49 18.06 10.41 18.19 10.1 C18.3 9.83 18.31 9.36 18.21 9.12 C18.11 8.91 15.16 5.87 14.82 5.64 C14.15 5.18 13.2 5.5 12.99 6.26 C12.83 6.83 12.94 7.1 13.64 7.81 L14.23 8.41 L10.48 8.41 L6.74 8.41 L6.42 8.56 C5.93 8.81 5.66 9.36 5.79 9.85 C5.89 10.2 6.1 10.48 6.38 10.64 L6.62 10.78 L10.38 10.78 C12.45 10.78 14.14 10.8 14.14 10.83 C14.14 10.85 13.93 11.08 13.68 11.33 C13.21 11.79 12.93 12.25 12.93 12.55 C12.92 12.99 13.25 13.52 13.62 13.68 C13.89 13.8 14.38 13.78 14.66 13.65Z"
};

const FILLED = new Set(["mark"]);

let {
    name,
    size = 24,
    stroke = 1.9,
    spin = false
}: {
    name: keyof typeof PATHS | string;
    size?: number;
    stroke?: number;
    spin?: boolean;
} = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={FILLED.has(name) ? "currentColor" : "none"}
    fill-rule="evenodd"
    stroke={FILLED.has(name) ? "none" : "currentColor"}
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-linejoin="round"
    class:spin
    aria-hidden="true"
>
    {#each [PATHS[name] ?? ""].flat() as d}
        <path {d} />
    {/each}
</svg>

<style>
.spin {
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(1turn);
    }
}

@media (prefers-reduced-motion: reduce) {
    .spin {
        animation: none;
    }
}
</style>
