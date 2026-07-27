<script lang="ts">
import ActionRow from "./ActionRow.svelte";
import Hero from "./Hero.svelte";
import Page from "./Page.svelte";
import RouteLink from "./RouteLink.svelte";
import Skeleton from "./Skeleton.svelte";
import { type Route, withDefaults } from "./types";

let {
    routes,
    loading,
    error,
    starting,
    onopen,
    onpick,
    onmanual,
    onhelp,
    onowner
}: {
    routes: Route[];
    loading: boolean;
    error: string;
    starting: boolean;
    onopen: (route: Route) => void;
    onpick: () => void;
    onmanual: () => void;
    onhelp: () => void;
    onowner: () => void;
} = $props();

const grouped = $derived(
    [
        ...new Map(
            routes.map((r) => [
                r.sourceChatId,
                routes.filter((x) => x.sourceChatId === r.sourceChatId)
            ])
        )
    ].sort(([a], [b]) => a - b)
);

/** Only non-default settings, so divergence between destinations shows. */
function chips(route: Route): string[] {
    const c = withDefaults(route.config);
    const out: string[] = [];
    if (c.mode === "forward") out.push("forward");
    if (c.protectContent) out.push("protected");
    if (c.silent) out.push("silent");
    if (c.removeButtons) out.push("no buttons");
    if (c.filters.whitelist.length)
        out.push(`${c.filters.whitelist.length} allow`);
    if (c.filters.blacklist.length)
        out.push(`${c.filters.blacklist.length} block`);
    if (c.caption.strip) {
        out.push("no caption");
        return out;
    }
    if (c.caption.removeLinks) out.push("no links");
    if (c.caption.removeMentions) out.push("no mentions");
    if (c.caption.prepend || c.caption.append) out.push("signature");
    if (c.caption.replace.length)
        out.push(`${c.caption.replace.length} replace`);
    return out;
}

const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;
</script>

<Page footer>
    <Hero icon="forward" title="Forwarding">
        {#if loading}
            &nbsp;
        {:else if routes.length}
            {plural(grouped.length, "source")} · {plural(
                routes.length,
                "destination"
            )}
        {:else}
            Copy new messages from one chat into another
        {/if}
    </Hero>

    {#if error}<p class="banner">{error}</p>{/if}

    {#if loading}
        <Skeleton />
    {:else if routes.length === 0}
        <div class="empty">
            <strong>Nothing forwarding yet</strong>
            <p>Pick a chat to forward from, and one to forward to.</p>
        </div>
    {:else}
        <div class="stagger">
            {#each grouped as [source, dests], gi (source)}
                <div style="animation-delay:{gi * 45}ms">
                    <RouteLink
                        sourceChatId={source}
                        sourceName={dests[0].sourceName}
                        routes={dests}
                        {chips}
                        {onopen}
                    />
                </div>
            {/each}
        </div>
    {/if}

    <h2 class="section-title">Add forwarding</h2>
    <div class="card inset-rules">
        <ActionRow
            icon="plus"
            tone="accent"
            label={starting ? "Opening picker…" : "Pick from a list"}
            onclick={onpick}
        />
        <ActionRow
            icon="plus"
            label="Enter chats yourself"
            onclick={onmanual}
        />
    </div>
    <p class="note">
        The picker lists channels where we are both administrators, and groups I
        am in. Enter a chat yourself when it is not listed.
    </p>

    <h2 class="section-title">This bot</h2>
    <div class="card inset-rules">
        <ActionRow icon="help" label="How it works" onclick={onhelp} />
        <ActionRow icon="owner" label="Owner" onclick={onowner} />
    </div>
</Page>
