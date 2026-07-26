<script lang="ts">
import { botId, copyText, haptic } from "./telegram";

let { onback }: { onback: () => void } = $props();

let copied = $state(false);

// Main Mini Apps are configured per bot in BotFather, and the id has to be in
// the URL: launching from the profile carries no start parameter.
const appUrl = botId() ? `${location.origin}/app/settings?bot=${botId()}` : "";

async function copyUrl() {
    if (!(await copyText(appUrl))) return;
    copied = true;
    haptic();
    setTimeout(() => (copied = false), 1600);
}

const openButtonSteps = [
    {
        title: "Open BotFather",
        body: "Send /mybots, then pick your bot."
    },
    {
        title: "Bot Settings → Configure Mini App",
        body: "Tap Enable Mini App."
    },
    {
        title: "Send it the URL below",
        body: "BotFather confirms, and the button appears on your bot's profile and next to it in your chat list."
    }
];

const steps = [
    {
        title: "Add me to both chats",
        body: "In a channel, as an administrator. In a group, either make me an administrator or turn off Group Privacy in BotFather — otherwise I cannot read the messages."
    },
    {
        title: "Send /set",
        body: "Pick the source, then the destination, from Telegram's own chat list. Channels only appear if we are both administrators."
    },
    {
        title: "Open Settings",
        body: "Give each destination its own filters, mode and caption rules."
    }
];

// Mirrors what src/chatref.ts accepts.
const chatFormats = [
    ["-1001234567890", "Chat id"],
    ["@mychannel", "Username"],
    ["t.me/mychannel", "Link to a public chat"],
    ["t.me/mychannel/42", "Link to a message — the chat is taken from it"],
    ["t.me/c/1234567890/42", "Message link in a private chat"]
];

const commands = [
    ["/set", "Pick source and destination from a list"],
    ["/set (source) (destination)", "Add a route without the picker"],
    ["/rem (source) (destination)", "Remove one destination"],
    ["/rem (source)", "Remove every destination for a source"],
    ["/get", "List everything"],
    ["/get (source)", "List one source's destinations"],
    ["/set_owner (user_id)", "Hand the bot to someone else"],
    ["/settings", "Add, change or remove a forward"],
    ["/cancel", "Stop a half-finished /set"]
];

const cloneSteps = [
    {
        title: "Create a bot",
        body: "Open @BotFather and send /newbot. Pick a name and a username."
    },
    {
        title: "Forward me the token",
        body: "BotFather replies with a message containing the token. Forward that whole message here."
    },
    {
        title: "It is yours",
        body: "You are its owner, with your own routes and settings. Nothing is shared with this bot."
    }
];

const faq = [
    {
        q: "Nothing is being forwarded",
        a: "I only see messages in chats I belong to. In a channel I must be an administrator; in a group, turn off Group Privacy in BotFather or make me an admin, or I cannot read ordinary messages. Check the destination is not paused in Settings."
    },
    {
        q: "My channel is not in the picker",
        a: "The picker only lists channels where you and I are both administrators, and groups I am in. Add me first, then send /set again. You can also add it by hand with a chat id, an @username or a t.me link."
    },
    {
        q: "My pattern was rejected",
        a: "Patterns run on RE2, which cannot backtrack — that is what stops a bad pattern hanging the bot. Lookbehind ((?<=…)) and backreferences (\\1) are not supported. For a named group use (?P<name>…)."
    },
    {
        q: "Forward mode will not let me change the caption",
        a: "Forward relays the original message untouched, so it cannot rewrite captions or drop buttons. Switch that destination to Copy."
    },
    {
        q: "How do I block a file type?",
        a: "Add a rule under Never forward, choose Regex, set Match against to File name, and use a pattern like \\.(exe|apk)$."
    }
];
</script>

<div class="page">
    <header class="masthead">
        <button type="button" class="icon-btn" aria-label="Back" onclick={onback}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                stroke-linejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
            </svg>
        </button>
        <div class="grow">
            <h1>Help</h1>
            <p>Forwarding messages between your chats</p>
        </div>
    </header>

    <!-- Same rail as the routes list. -->
    <div class="bay">
        <div class="node">
            <span class="dot"></span>
            <div class="grow">
                <div class="row-label">One source chat</div>
                <div class="sub">Every new message is picked up</div>
            </div>
        </div>
        <div class="drop">
            <span class="dot"></span>
            <div class="grow">
                <div class="row-label">Destination</div>
                <div class="sub">Its own filters and caption rules</div>
            </div>
        </div>
        <div class="drop">
            <span class="dot hollow"></span>
            <div class="grow">
                <div class="row-label">Another destination</div>
                <div class="sub">Configured separately, or paused</div>
            </div>
        </div>
    </div>

    <h2 class="section-title">Getting started</h2>
    <div class="card">
        {#each steps as step, i}
            <div class="row">
                <span class="step">{i + 1}</span>
                <span class="grow">
                    <span class="row-label">{step.title}</span>
                    <span class="sub">{step.body}</span>
                </span>
            </div>
        {/each}
    </div>

    <h2 class="section-title">Adding a route by hand</h2>
    <div class="card">
        <div class="row">
            <span class="step">1</span>
            <span class="grow">
                <span class="row-label">In Settings</span>
                <span class="sub">
                    Tap <b>Add forwarding (manual)</b> and type each chat. The name
                    appears once I find it.
                </span>
            </span>
        </div>
        <div class="row">
            <span class="step">2</span>
            <span class="grow">
                <span class="row-label">Or by command</span>
                <span class="sub">
                    <span class="cmd">/set (source) (destination)</span>
                </span>
            </span>
        </div>
    </div>
    <p class="note">Use this when the picker will not list a chat.</p>

    <h2 class="section-title">Ways to name a chat</h2>
    <div class="card">
        {#each chatFormats as [example, what]}
            <div class="row">
                <div class="grow">
                    <div class="cmd">{example}</div>
                    <div class="sub">{what}</div>
                </div>
            </div>
        {/each}
    </div>
    <p class="note">
        Invite links (t.me/+…) carry no chat id, so they cannot be used. Either
        way I still have to be in both chats.
    </p>

    <h2 class="section-title">What each destination can do</h2>
    <div class="card">
        <div class="row">
            <div class="grow">
                <div class="row-label">Delivery</div>
                <div class="sub">
                    Copy or forward, protected content, silent, remove buttons
                </div>
            </div>
        </div>
        <div class="row">
            <div class="grow">
                <div class="row-label">Filters</div>
                <div class="sub">
                    Allow or block on keywords, patterns, media type, sender or
                    file name. Blocking always wins
                </div>
            </div>
        </div>
        <div class="row">
            <div class="grow">
                <div class="row-label">Caption</div>
                <div class="sub">
                    Add text before or after, find and replace, strip links or
                    mentions. Bold and links survive the edit
                </div>
            </div>
        </div>
    </div>

    <h2 class="section-title">Commands</h2>
    <div class="card">
        {#each commands as [name, what]}
            <div class="row">
                <div class="grow">
                    <div class="cmd">{name}</div>
                    <div class="sub">{what}</div>
                </div>
            </div>
        {/each}
    </div>
    <p class="note">
        Only the owner can use /set, /get, /rem and /settings. Everyone else can
        still run their own copy.
    </p>

    <h2 class="section-title">Make your own copy</h2>
    <div class="card">
        {#each cloneSteps as step, i}
            <div class="row">
                <span class="step">{i + 1}</span>
                <span class="grow">
                    <span class="row-label">{step.title}</span>
                    <span class="sub">{step.body}</span>
                </span>
            </div>
        {/each}
    </div>
    <p class="note">
        Free, and it takes about a minute.
        <a href="https://t.me/BotFather">Open BotFather</a>.
    </p>

    <h2 class="section-title">Add an Open button</h2>
    <div class="card">
        {#each openButtonSteps as step, i}
            <div class="row">
                <span class="step">{i + 1}</span>
                <span class="grow">
                    <span class="row-label">{step.title}</span>
                    <span class="sub">{step.body}</span>
                </span>
            </div>
        {/each}
        {#if appUrl}
            <button type="button" class="row" onclick={copyUrl}>
                <span class="grow">
                    <span class="row-label">
                        {copied ? "Copied" : "Tap to copy the URL"}
                    </span>
                    <span class="sub url">{appUrl}</span>
                </span>
            </button>
        {:else}
            <div class="row">
                <span class="grow">
                    <span class="row-label">Open this page from your bot</span>
                    <span class="sub">
                        The URL is built from the bot it was opened for, and this
                        page was opened without one.
                    </span>
                </span>
            </div>
        {/if}
    </div>
    <p class="note">
        Telegram has no way for a bot to set this itself, so each bot's owner has
        to do it once. The id in the URL is what tells this page which bot it is
        configuring — do not drop it.
    </p>

    <h2 class="section-title">Questions</h2>
    <div class="card">
        {#each faq as item}
            <details class="faq">
                <summary>
                    <span class="grow">{item.q}</span>
                    <span class="chevron" aria-hidden="true">›</span>
                </summary>
                <p>{item.a}</p>
            </details>
        {/each}
    </div>

    <p class="note">
        <a href="https://github.com/viperadnan-git/telegram-forwarder-bot"
            >Source code</a
        >
        · <a href="https://t.me/vipercommunity">Support group</a>
        ·
        <a
            href="https://github.com/viperadnan-git/telegram-forwarder-bot/issues"
            >Report a problem</a
        >
    </p>
</div>
