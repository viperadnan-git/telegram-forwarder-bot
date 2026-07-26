<script lang="ts">
import * as api from "./api";
import { close, confirm, copyText, haptic, myId } from "./telegram";

let { onback }: { onback: () => void } = $props();

let input = $state("");
let busy = $state(false);
let error = $state("");
let handedTo = $state<number | null>(null);
let copied = $state(false);

const mine = myId();

async function copyMine() {
    if (mine === undefined || !(await copyText(String(mine)))) return;
    copied = true;
    haptic();
    setTimeout(() => (copied = false), 1600);
}

async function handOver() {
    const target = input.trim();
    if (!target) return;
    if (
        !(await confirm(
            `Hand this bot to ${target}?\n\nYou lose access immediately. Only they can hand it back.`
        ))
    ) {
        return;
    }

    busy = true;
    error = "";
    try {
        handedTo = await api.handOver(target);
    } catch (e: any) {
        error = e.message;
    } finally {
        busy = false;
    }
}
</script>

<div class="page">
    <header class="masthead">
        {#if !handedTo}
            <button type="button" class="icon-btn" aria-label="Back" onclick={onback}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
        {/if}
        <div class="grow">
            <h1>Owner</h1>
            <p>{handedTo ? "Handed over" : "You own this bot"}</p>
        </div>
    </header>

    {#if handedTo}
        <div class="card">
            <div class="field">
                <p class="prose">
                    This bot now belongs to <b>{handedTo}</b>. Your forwarding rules
                    stayed as they are — they are the bot's, not yours. Ask the new
                    owner if you need it back.
                </p>
            </div>
        </div>

        <div class="actions-stack">
            <button type="button" class="btn" onclick={close}>Back to the chat</button>
        </div>
    {:else}
        <div class="card">
            <div class="field">
                <p class="prose">
                    Only the owner can open these settings or change what the bot
                    forwards. Everyone else gets turned away.
                </p>
            </div>
            {#if mine !== undefined}
                <button type="button" class="row" onclick={copyMine}>
                    <span class="grow">
                        <span class="row-label">Your id</span>
                        <span class="sub">{copied ? "Copied" : "Tap to copy"}</span>
                    </span>
                    <span class="cid"><span class="pre">{mine}</span></span>
                </button>
            {/if}
        </div>

        <h2 class="section-title">Hand it over</h2>
        <div class="card">
            <div class="field">
                <label for="new-owner">New owner</label>
                <input
                    id="new-owner"
                    class="input {/^-?\d+$/.test(input.trim()) ? 'mono' : ''} {error
                        ? 'invalid'
                        : ''}"
                    type="text"
                    bind:value={input}
                    placeholder="User id"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                />
                {#if error}
                    <div class="sub" style="color:var(--destructive)">{error}</div>
                {/if}
            </div>
        </div>
        <p class="note">
            Telegram only lets bots find people by numeric id — a @username will
            not work. Ask them to open this bot and tap Settings; the page shows
            them their id.
        </p>

        <div class="actions-stack">
            <button
                type="button"
                class="btn danger"
                disabled={!input.trim() || busy}
                onclick={handOver}
            >
                {busy ? "Handing over…" : "Hand over"}
            </button>
        </div>
        <p class="note">
            You lose access the moment this goes through, and only the new owner can
            hand it back.
        </p>
    {/if}
</div>
