<script lang="ts">
import * as api from "../api";
import BackBar from "../components/BackBar.svelte";
import Hero from "../components/Hero.svelte";
import Page from "../components/Page.svelte";
import { impact, run } from "../haptics";
import { close, confirm, copyText, myId } from "../telegram";

let { onback, backLabel = "Back" }: { onback: () => void; backLabel?: string } =
    $props();

let input = $state("");
let busy = $state(false);
let error = $state("");
let handedTo = $state<number | null>(null);
let copied = $state(false);

const mine = myId();

async function copyMine() {
    if (mine === undefined || !(await copyText(String(mine)))) return;
    copied = true;
    impact();
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
        handedTo = await run(() => api.handOver(target));
    } catch (e: any) {
        error = e.message;
    } finally {
        busy = false;
    }
}
</script>

<Page>
    {#if !handedTo}
        <BackBar {onback} label={backLabel} />
    {/if}

    <Hero icon="owner" title="Owner">
        {handedTo
            ? "This bot has a new owner."
            : "Only the owner can open these settings or change what the bot forwards."}
    </Hero>

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
            <input
                class="input {/^-?\d+$/.test(input.trim()) ? 'mono' : ''} {error
                    ? 'invalid'
                    : ''}"
                type="text"
                bind:value={input}
                placeholder="New owner's user id"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
            />
        </div>
        {#if error}<p class="note invalid-note">{error}</p>{/if}
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
</Page>
