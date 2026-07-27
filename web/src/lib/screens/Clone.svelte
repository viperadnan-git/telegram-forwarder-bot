<script lang="ts">
import { tokenIssue } from "$schema";
import * as api from "../api";
import Avatar from "../components/Avatar.svelte";
import BackBar from "../components/BackBar.svelte";
import Hero from "../components/Hero.svelte";
import Page from "../components/Page.svelte";
import { run } from "../haptics";
import { botId, close, openTelegramLink } from "../telegram";

// One field covers both paths: a token that is already running here hands that
// bot back to whoever holds the token, so reclaiming needs no separate flow.
let {
    onback,
    onclaimed,
    backLabel = "Back"
}: {
    onback: () => void;
    onclaimed: () => void;
    backLabel?: string;
} = $props();

let token = $state("");
let checking = $state(false);
let claiming = $state(false);
let error = $state("");
let found = $state<api.BotInfo | null>(null);
let claimed = $state<{ bot: api.BotInfo; alreadyRunning: boolean } | null>(
    null
);

const issue = $derived(tokenIssue(token));
const ready = $derived(token.trim() !== "" && issue === null);

async function check() {
    if (!ready) return;
    checking = true;
    error = "";
    try {
        found = await api.checkClone(token.trim());
    } catch (e: any) {
        error = e.message;
    } finally {
        checking = false;
    }
}

async function confirm() {
    claiming = true;
    error = "";
    try {
        const result = await run(() => api.clone(token.trim()));
        token = "";
        found = null;
        // The initData is signed for this bot only, so only this bot's settings
        // can open here; any other has to be opened from its own chat.
        if (result.bot.id === botId()) {
            onclaimed();
            return;
        }
        claimed = result;
    } catch (e: any) {
        error = e.message;
    } finally {
        claiming = false;
    }
}

const steps = [
    {
        title: "Open BotFather",
        body: "Send /newbot, then pick a name and a username."
    },
    {
        title: "Copy the token",
        body: "It replies with a line like 123456789:AA-Hh… That is the token."
    },
    {
        title: "Paste it above",
        body: "Your clone starts straight away, with its own chats and rules."
    }
];
</script>

<Page footer>
    {#if !claimed}
        <BackBar {onback} label={backLabel} />
    {/if}

    <Hero
        icon="key"
        photo={claimed?.bot.photo}
        title={claimed ? "All yours" : "Clone bot"}
    >
        {#if claimed}
            Your own clone is running.
        {:else}
            Point your own bot at this server and it runs the same forwarding,
            with its own chats and rules. It takes about a minute.
        {/if}
    </Hero>

    {#if claimed}
        <div class="card">
            <div class="row">
                {#if claimed.bot.photo}
                    <img class="avatar-sm" src={claimed.bot.photo} alt="" />
                {:else}
                    <Avatar
                        chatId={claimed.bot.id}
                        name={claimed.bot.firstName}
                        size={38}
                    />
                {/if}
                <span class="grow">
                    <span class="row-label">{claimed.bot.firstName}</span>
                    <span class="sub">@{claimed.bot.username}</span>
                </span>
            </div>
        </div>
        <p class="note">
            {claimed.alreadyRunning
                ? "It was already running here, so its forwarding is untouched."
                : "Open it and send /set to choose the two chats."}
        </p>

        <div class="actions-stack">
            <button
                type="button"
                class="btn"
                onclick={() =>
                    openTelegramLink(`https://t.me/${claimed?.bot.username}`)}
            >
                Open @{claimed.bot.username}
            </button>
            <button type="button" class="btn secondary" onclick={close}>
                Back to the chat
            </button>
        </div>
    {:else if found}
        <h2 class="section-title">Confirm</h2>
        <div class="card">
            <div class="row">
                {#if found.photo}
                    <img class="avatar-sm" src={found.photo} alt="" />
                {:else}
                    <Avatar
                        chatId={found.id}
                        name={found.firstName}
                        size={38}
                    />
                {/if}
                <span class="grow">
                    <span class="row-label">{found.firstName}</span>
                    <span class="sub">@{found.username} · {found.id}</span>
                </span>
            </div>
        </div>
        <p class="note">
            Confirm and this bot becomes yours, owned by your Telegram account.
        </p>

        <div class="actions-stack">
            <button
                type="button"
                class="btn"
                disabled={claiming}
                onclick={confirm}
            >
                {claiming ? "Setting it up…" : "Make it mine"}
            </button>
            <button
                type="button"
                class="btn secondary"
                onclick={() => {
                    found = null;
                    error = "";
                }}
            >
                Use a different token
            </button>
        </div>

        {#if error}<p class="banner">{error}</p>{/if}
    {:else}
        <h2 class="section-title">Bot token</h2>
        <div class="card">
            <input
                class="input mono {issue ? 'invalid' : ''}"
                type="text"
                bind:value={token}
                placeholder="Enter bot token"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
            />
        </div>
        {#if issue}<p class="note invalid-note">{issue}</p>{/if}
        <p class="note">
            Checked with Telegram and never stored. If you created this bot,
            pasting its token takes it back.
        </p>

        <div class="actions-stack">
            <button
                type="button"
                class="btn"
                disabled={!ready || checking}
                onclick={check}
            >
                {checking ? "Checking…" : "Continue"}
            </button>
        </div>

        {#if error}<p class="banner">{error}</p>{/if}

        <h2 class="section-title">No bot yet?</h2>
        <div class="card">
            {#each steps as step, i}
                <div class="row">
                    <span class="step">{i + 1}</span>
                    <div class="grow">
                        <span class="row-label">{step.title}</span>
                        <span class="sub">{step.body}</span>
                    </div>
                </div>
            {/each}
        </div>

        <div class="actions-stack">
            <button
                type="button"
                class="btn secondary"
                onclick={() => openTelegramLink("https://t.me/BotFather")}
            >
                Open BotFather
            </button>
        </div>
    {/if}
</Page>
