<script lang="ts">
import { copyText, haptic } from "./telegram";

// Stacked, not side by side: two chats on one row truncate on a phone.
let {
    sourceChatId,
    sourceName,
    destChatId,
    destName
}: {
    sourceChatId: number;
    sourceName?: string;
    destChatId: number;
    destName?: string;
} = $props();

const endpoints = $derived([
    { role: "From", id: sourceChatId, name: sourceName, filled: false },
    { role: "To", id: destChatId, name: destName, filled: true }
]);

let copied = $state<number | null>(null);
let timer: ReturnType<typeof setTimeout>;

async function copy(id: number) {
    if (await copyText(String(id))) {
        haptic("success");
        copied = id;
        clearTimeout(timer);
        timer = setTimeout(() => (copied = null), 1600);
    }
}

const split = (id: number) => {
    const t = String(id);
    return t.startsWith("-100")
        ? { pre: "-100", body: t.slice(4) }
        : { pre: "", body: t };
};
</script>

<div class="card endpoints">
    {#each endpoints as e}
        <div class="endpoint">
            <span class="dot" class:hollow={!e.filled}></span>
            <div class="grow">
                <div class="endpoint-role">{e.role}</div>
                {#if e.name}
                    <div class="endpoint-name">{e.name}</div>
                {/if}
                <button
                    type="button"
                    class="id-copy"
                    onclick={() => copy(e.id)}
                    aria-label="Copy chat id {e.id}"
                >
                    {#if copied === e.id}
                        <span class="copied">Copied</span>
                    {:else}
                        {@const s = split(e.id)}
                        <span class="cid"
                            >{#if s.pre}<span class="pre">{s.pre}</span>{/if}{s.body}</span
                        >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <rect x="9" y="9" width="12" height="12" rx="2.5" />
                            <path d="M6 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                    {/if}
                </button>
            </div>
        </div>
    {/each}
</div>
