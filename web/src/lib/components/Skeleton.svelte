<script lang="ts">
// Mirrors a link card's shape so nothing shifts when data lands.
const groups = [2, 1];
</script>

{#each groups as destinations, g}
    <div class="card linkage" aria-hidden="true">
        <div class="link-source">
            <span class="link-rail down"></span>
            <span class="sk node-sk"></span>
            <div class="grow">
                <div class="sk" style="width:50%; height:17px"></div>
                <div class="sk" style="width:28%; height:14px; margin-top:3px"></div>
            </div>
        </div>
        {#each { length: destinations } as _, i}
            <div class="link-dest">
                <span class="link-rail"></span>
                {#if i < destinations - 1}
                    <span class="link-rail down"></span>
                {/if}
                <span class="sk node-sk"></span>
                <div class="grow">
                    <div
                        class="sk"
                        style="width:{56 - i * 9}%; height:17px; animation-delay:{(g *
                            2 +
                            i) *
                            0.09}s"
                    ></div>
                    <div
                        class="sk"
                        style="width:{32 + i * 8}%; height:14px; margin-top:3px"
                    ></div>
                </div>
            </div>
        {/each}
    </div>
{/each}

<span class="sr-only">Loading what is being forwarded</span>

<style>
/* --- loading: shaped like the real list, so nothing jumps ---------------- */

.sk {
    background: var(--fill);
    background-image: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--hint) 14%, transparent) 45%,
        transparent 90%
    );
    background-size: 260% 100%;
    background-repeat: no-repeat;
    border-radius: 6px;
    animation: shimmer 1.35s ease-in-out infinite;
}

.sk.node-sk {
    width: var(--node);
    height: var(--node);
    border-radius: 50%;
    flex: none;
}

/* The shimmer is aria-hidden; this is what gets announced. */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
</style>
