<script lang="ts">
// Mirrors a real card's shape so nothing shifts when data lands.
const bays = [2, 1];
</script>

{#each bays as destinations, b}
    <div class="bay" aria-hidden="true">
        <div class="node">
            <span class="sk dot-sk"></span>
            <div class="grow">
                <div class="sk" style="width:52%; height:16px"></div>
                <div class="sk" style="width:30%; height:12px; margin-top:7px"></div>
            </div>
        </div>

        {#each { length: destinations } as _, i}
            <div class="drop">
                <span class="sk dot-sk"></span>
                <div class="grow">
                    <div
                        class="sk"
                        style="width:{58 - i * 9}%; height:15px; animation-delay:{(b * 2 +
                            i) *
                            0.09}s"
                    ></div>
                    <div
                        class="sk"
                        style="width:{34 + i * 8}%; height:11px; margin-top:7px"
                    ></div>
                </div>
            </div>
        {/each}
    </div>
{/each}

<span class="sr-only">Loading your routes</span>
