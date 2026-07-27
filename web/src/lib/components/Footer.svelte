<script lang="ts">
import { openTelegramLink } from "../telegram";

// Rendered by Page, so no screen carries a banner of its own.
const REPO = "https://github.com/viperadnan-git/telegram-forwarder-bot";
</script>

<footer class="site-footer">
    <a class="pill gh" href={REPO} target="_blank" rel="noreferrer">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
                1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
                0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68
                0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0
                3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0
                .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
        </svg>
        Source on GitHub
    </a>

    <p class="footer-links">
        Free and open source ·
        <button
            type="button"
            class="linkish"
            onclick={() => openTelegramLink("https://t.me/vipercommunity")}
        >
            Support
        </button>
        ·
        <a href="{REPO}/issues" target="_blank" rel="noreferrer">
            Report a problem
        </a>
    </p>
</footer>

<style>
/* auto pins it to the bottom of a short page; the padding is the gap on a long
   one, where auto collapses to nothing. */
.site-footer {
    margin: auto var(--gutter) 0;
    padding-top: 34px;
    text-align: center;
}

.footer-links {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--subtitle);
}

.footer-links a,
.linkish {
    color: var(--accent);
    text-decoration: none;
    font-size: inherit;
    padding: 0;
}
</style>
