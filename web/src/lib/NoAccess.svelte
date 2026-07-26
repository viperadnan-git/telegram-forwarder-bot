<script lang="ts">
import { tokenIssue } from "$schema";
import * as api from "./api";
import Hero from "./Hero.svelte";
import Icon from "./Icon.svelte";
import {
    botId,
    close,
    copyText,
    haptic,
    myId,
    openTelegramLink
} from "./telegram";

let {
    reason,
    onhelp,
    onclaimed
}: {
    reason: "unclaimed" | "not-owner";
    onhelp: () => void;
    onclaimed: () => void;
} = $props();

let copied = $state(false);

const mine = myId();

async function copyMine() {
    if (mine === undefined || !(await copyText(String(mine)))) return;
    copied = true;
    haptic();
    setTimeout(() => (copied = false), 1600);
}

// One field covers both paths: a token that is already running here hands that
// bot back to whoever holds the token, so reclaiming needs no separate flow.
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
        const result = await api.clone(token.trim());
        token = "";
        found = null;
        haptic();
        // Reclaiming the bot whose app this is: the signed initData is for that
        // bot, so its settings open right here. Any other bot has to be opened
        // from its own chat, where Telegram will sign for it.
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
        body: "Your copy starts straight away, with its own chats and rules."
    }
];
</script>

<div class="page">
    <Hero
        icon="key"
        photo={claimed?.bot.photo}
        title={reason === "unclaimed"
            ? "No owner yet"
            : claimed
              ? "All yours"
              : "Not your bot"}
    >
        {#if reason === "unclaimed"}
            Nobody has claimed this bot, so there is nothing to configure yet.
        {:else if claimed}
            Your own copy is running.
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
    {:else if claimed}
        <div class="card">
            <div class="row">
                {#if claimed.bot.photo}
                    <img class="avatar-sm" src={claimed.bot.photo} alt="" />
                {:else}
                    <span class="icon"><Icon name="check" /></span>
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
    {:else}
        <h2 class="section-title">Use your own bot</h2>

        {#if found}
            <div class="card">
                <div class="row">
                    {#if found.photo}
                        <img class="avatar-sm" src={found.photo} alt="" />
                    {:else}
                        <span class="icon"><Icon name="check" /></span>
                    {/if}
                    <span class="grow">
                        <span class="row-label">{found.firstName}</span>
                        <span class="sub">@{found.username} · {found.id}</span>
                    </span>
                </div>
            </div>
            <p class="note">
                Confirm and this bot becomes yours, owned by your Telegram
                account.
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
        {:else}
            <div class="card">
                <div class="field">
                    <label for="token">Bot token</label>
                    <input
                        id="token"
                        class="input mono {issue ? 'invalid' : ''}"
                        type="text"
                        bind:value={token}
                        placeholder="123456789:AA-Hh…"
                        autocapitalize="off"
                        autocorrect="off"
                        spellcheck="false"
                    />
                    {#if issue}
                        <div class="sub" style="color:var(--destructive)">
                            {issue}
                        </div>
                    {/if}
                </div>
            </div>
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
        {/if}

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
</div>
