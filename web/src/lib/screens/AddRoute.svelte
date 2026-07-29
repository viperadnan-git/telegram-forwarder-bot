<script lang="ts">
import * as api from "../api";
import ChatInput from "../components/ChatInput.svelte";
import Hero from "../components/Hero.svelte";
import Sheet from "../components/Sheet.svelte";
import { run } from "../haptics";
import type { Route } from "../types";

let {
    onclose,
    oncreated
}: { onclose: () => void; oncreated: (route: Route) => void } = $props();

let source = $state("");
let dest = $state("");
let adding = $state(false);
let error = $state("");

const ready = $derived(
    source.trim() !== "" && dest.trim() !== "" && source.trim() !== dest.trim()
);

/** Both chats are looked up here, once, rather than on every keystroke. */
async function add() {
    if (!ready) return;
    adding = true;
    error = "";
    try {
        // One outcome for the whole flow: two lookups then the create.
        const route = await run(async () => {
            const [from, to] = await Promise.all([
                api.resolveChat(source.trim(), "source"),
                api.resolveChat(dest.trim(), "destination")
            ]);
            return api.createRoute(from.chatId, to.chatId);
        });
        oncreated(route);
    } catch (e: any) {
        error = e.message;
    } finally {
        adding = false;
    }
}
</script>

<Sheet title="Add forwarding" onback={onclose}>
    <Hero icon="plus" title="Enter chats yourself">
        For chats the picker will not list. I must already be in both of them.
    </Hero>

    {#if error}<p class="banner">{error}</p>{/if}

    <div class="card">
        <ChatInput bind:value={source} label="Source" />
        <ChatInput bind:value={dest} label="Destination" />
    </div>
    <p class="note">
        A chat id, an @username or a t.me link. Both are looked up when you tap
        Add, so nothing is checked while you type. In a channel I have to be an
        administrator.
    </p>

    <div class="actions-stack">
        <button
            type="button"
            class="btn"
            disabled={!ready || adding}
            onclick={add}
        >
            {adding ? "Adding…" : "Add forwarding"}
        </button>
    </div>
</Sheet>
