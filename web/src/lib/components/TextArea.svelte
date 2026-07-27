<script lang="ts">
// Sizes itself with no JavaScript: an invisible ::after copy of the text shares
// the textarea's grid cell, so the cell is always as tall as the content and
// there is no measure step to go stale.
// No fallback on the bindable: prepend/append are undefined when unset, and
// Svelte refuses to bind undefined to a prop that has one.
let {
    value = $bindable(),
    placeholder
}: { value?: string; placeholder?: string } = $props();
</script>

<div class="input textarea" data-value={value ?? ""}>
    <textarea bind:value {placeholder} rows="1"></textarea>
</div>

<style>
.textarea {
    display: grid;
    line-height: 1.35;
}

/* Both layers share one cell and must render text identically. */
.textarea > textarea,
.textarea::after {
    grid-area: 1 / 1;
    font: inherit;
    line-height: inherit;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.textarea > textarea {
    resize: none;
    overflow: hidden;
}

.textarea > textarea:focus {
    outline: none;
}

/* The trailing space keeps a final newline from collapsing. */
.textarea::after {
    content: attr(data-value) " ";
    visibility: hidden;
}
</style>
