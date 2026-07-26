<script lang="ts">
    import { close, openTelegramLink } from "./telegram";

    let { reason }: { reason: "unclaimed" | "not_owner" } = $props();

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
                <p style="margin:0; font-size:15px; line-height:1.5">
                    This bot has no owner, so there is nothing to configure yet.
                    Close this window and send <b>/set_owner</b> in the chat to claim
                    it.
                </p>
            </div>
        </div>

        <div style="margin-top:16px">
            <button type="button" class="btn" onclick={close}>Back to the chat</button>
        </div>
    {:else}
        <div class="card">
            <div class="field">
                <p style="margin:0; font-size:15px; line-height:1.5">
                    Only the owner can change this bot's forwarding. You can run your
                    own copy in about a minute — it is free, and it forwards your own
                    chats with your own rules.
                </p>
            </div>
        </div>

        <h2 class="section-title">Make your own copy</h2>
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

        <div style="margin-top:16px">
            <button
                type="button"
                class="btn"
                onclick={() => openTelegramLink("https://t.me/BotFather")}
            >
                Open BotFather
            </button>
        </div>
        <div style="margin-top:10px">
            <button type="button" class="btn secondary" onclick={close}>
                Back to the chat
            </button>
        </div>
    {/if}
</div>
