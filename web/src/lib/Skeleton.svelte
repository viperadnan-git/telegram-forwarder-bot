<script lang="ts">
// Mirrors a link card's shape so nothing shifts when data lands.
const groups = [2, 1];
</script>

{#each groups as destinations, g}
    <div class="card linkage" aria-hidden="true">
        <div class="link-source">
            <span class="sk node-sk"></span>
            <div class="grow">
                <div class="sk" style="width:50%; height:15px"></div>
                <div class="sk" style="width:28%; height:11px; margin-top:7px"></div>
            </div>
        </div>
        {#each { length: destinations } as _, i}
            <div class="link-dest">
                <span class="link-rail"></span>
                <span class="sk node-sk"></span>
                <div class="grow">
                    <div
                        class="sk"
                        style="width:{56 - i * 9}%; height:15px; animation-delay:{(g *
                            2 +
                            i) *
                            0.09}s"
                    ></div>
                    <div
                        class="sk"
                        style="width:{32 + i * 8}%; height:11px; margin-top:7px"
                    ></div>
                </div>
            </div>
        {/each}
    </div>
{/each}

<span class="sr-only">Loading what is being forwarded</span>
