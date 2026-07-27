<script lang="ts">
import type { Snippet } from "svelte";
import Footer from "./Footer.svelte";

// The page frame. Owns the footer, so no page has to remember to credit the
// project.
let { footer = false, children }: { footer?: boolean; children: Snippet } =
    $props();
</script>

<div class="page">
    {@render children()}
    {#if footer}<Footer />{/if}
</div>
