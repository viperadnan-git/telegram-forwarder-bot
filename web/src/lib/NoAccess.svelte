<script lang="ts">
import { close, copyText, haptic, myId, openTelegramLink } from "./telegram";

let {
    reason,
    onhelp
}: { reason: "unclaimed" | "not-owner"; onhelp: () => void } = $props();

let copied = $state(false);

const mine = myId();

async function copyMine() {
    if (mine === undefined || !(await copyText(String(mine)))) return;
    copied = true;
    haptic();
    setTimeout(() => (copied = false), 1600);
}

// Forwarding the token proves you hold it, so it reassigns the owner.
const reclaimSteps = [
    {
        title: "Open BotFather",
        body: "Send /mybots, then pick this bot from the list."
    },
    {
        title: "Tap API Token",
        body: "BotFather sends a message with the token in it."
    },
    {
        title: "Forward that message here",
        body: "Ownership comes straight back to you. Nothing that was set up is lost."
    }
];

const steps = [
    {
        title: "Create a bot",
        body: "Open @BotFather and send /newbot. Pick a name and a username for it."
    },
    {
        title: "Send the token here",
        body: "BotFather replies with a message containing your token. Forward that whole message to this bot."
    },
    {
        title: "It becomes yours",
        body: "Your copy is set up and you are its owner, with your own forwarding rules."
    }
];
</script>

{#snippet stepCard(items: { title: string; body: string }[])}
    <div class="card">
        {#each items as step, i}
            <div class="row">
                <span class="step">{i + 1}</span>
                <div class="grow">
                    <span class="row-label">{step.title}</span>
                    <span class="sub">{step.body}</span>
                </div>
            </div>
        {/each}
    </div>
{/snippet}

{#snippet helpRow()}
    <button type="button" class="row" onclick={onhelp}>
        <span class="grow">
            <span class="row-label">How it works</span>
            <span class="sub">What this bot does, and the commands</span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
    </button>
{/snippet}

<div class="page">
    <header class="masthead">
        <div class="grow">
            <h1>{reason === "unclaimed" ? "No owner yet" : "Not your bot"}</h1>
            <p>
                {reason === "unclaimed"
                    ? "Nobody has claimed this bot"
                    : "Someone else set this one up"}
            </p>
        </div>
    </header>

    {#if reason === "unclaimed"}
        <div class="card">
            <div class="field">
                <p class="prose">
                    This bot has no owner, so there is nothing to configure yet.
                    Close this window and send <b>/set_owner</b> in the chat to claim
                    it.
                </p>
            </div>
        </div>

        <h2 class="section-title">More</h2>
        <div class="card">
            {@render helpRow()}
        </div>

        <div class="actions-stack">
            <button type="button" class="btn" onclick={close}>Back to the chat</button>
        </div>
    {:else}
        <div class="card">
            <div class="field">
                <p class="prose">
                    Only the owner can change this bot's forwarding. You can run your
                    own copy in about a minute — it is free, and it forwards your own
                    chats with your own rules.
                </p>
            </div>
            <!-- The owner needs this id to hand the bot over. -->
            {#if mine !== undefined}
                <button type="button" class="row" onclick={copyMine}>
                    <span class="grow">
                        <span class="row-label">Your id</span>
                        <span class="sub">
                            {copied ? "Copied" : "Send this to the owner if they meant to hand it to you"}
                        </span>
                    </span>
                    <span class="cid"><span class="pre">{mine}</span></span>
                </button>
            {/if}
        </div>

        <h2 class="section-title">Already made this bot?</h2>
        {@render stepCard(reclaimSteps)}
        <p class="note">
            The message has to be forwarded from BotFather — typing the token out
            will not do it.
        </p>

        <h2 class="section-title">Or make your own copy</h2>
        {@render stepCard(steps)}

        <h2 class="section-title">More</h2>
        <div class="card">
            {@render helpRow()}
        </div>

        <div class="actions-stack">
            <button
                type="button"
                class="btn"
                onclick={() => openTelegramLink("https://t.me/BotFather")}
            >
                Open BotFather
            </button>
            <button type="button" class="btn secondary" onclick={close}>
                Back to the chat
            </button>
        </div>
    {/if}
</div>
