<script lang="ts">
import ActionRow from "../components/ActionRow.svelte";
import Hero from "../components/Hero.svelte";
import Icon from "../components/Icon.svelte";
import Page from "../components/Page.svelte";
import { impact } from "../haptics";
import { close, copyText, myId } from "../telegram";

let {
    reason,
    onhelp,
    onclone
}: {
    reason: "unclaimed" | "not-owner";
    onhelp: () => void;
    onclone: () => void;
} = $props();

let copied = $state(false);

const mine = myId();

async function copyMine() {
    if (mine === undefined || !(await copyText(String(mine)))) return;
    copied = true;
    impact();
    setTimeout(() => (copied = false), 1600);
}
</script>

<Page footer>
    <Hero
        icon="mark"
        title={reason === "unclaimed" ? "No owner yet" : "Not your bot"}
    >
        {#if reason === "unclaimed"}
            Nobody has claimed this bot, so there is nothing to configure yet.
        {:else}
            Only its owner can change what this bot forwards. Point your own bot
            here instead — it takes about a minute.
        {/if}
    </Hero>

    {#if reason === "unclaimed"}
        <div class="card">
            <div class="field">
                <p class="prose">
                    Close this window and send <b>/set_owner</b> in the chat to
                    claim it.
                </p>
            </div>
        </div>

        <div class="actions-stack">
            <button type="button" class="btn" onclick={close}>
                Back to the chat
            </button>
        </div>
    {:else}
        <h2 class="section-title">Clone bot</h2>
        <div class="card inset-rules">
            <ActionRow icon="key" label="Use your own bot" onclick={onclone} />
        </div>
        <p class="note">
            Paste your own bot's token and it runs the same forwarding, with its
            own chats and rules.
        </p>

        <h2 class="section-title">More</h2>
        <div class="card inset-rules">
            <button type="button" class="row" onclick={onhelp}>
                <span class="icon"><Icon name="help" /></span>
                <span class="grow">
                    <span class="row-label">How it works</span>
                </span>
                <span class="chevron" aria-hidden="true">›</span>
            </button>
            {#if mine !== undefined}
                <button type="button" class="row" onclick={copyMine}>
                    <span class="icon"><Icon name="owner" /></span>
                    <span class="grow">
                        <span class="row-label">Your id</span>
                        <span class="sub">
                            {copied
                                ? "Copied"
                                : "Send it to the owner to be handed this bot"}
                        </span>
                    </span>
                    <span class="row-value">{mine}</span>
                </button>
            {/if}
        </div>

        <div class="actions-stack">
            <button type="button" class="btn secondary" onclick={close}>
                Back to the chat
            </button>
        </div>
    {/if}
</Page>
