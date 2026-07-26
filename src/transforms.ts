import type { MessageEntity } from "grammy/types";
import type { RouteConfig } from "./config";
import { matchSpans } from "./regex";

// Telegram entity offsets are UTF-16 code units, as are JS string indices.
// Do not introduce a conversion.

export type TextAndEntities = {
    text: string;
    entities: MessageEntity[];
};

type Edit = { start: number; end: number; replacement: string };

const LINK_ENTITIES = new Set(["url", "text_link"]);
const MENTION_ENTITIES = new Set(["mention", "text_mention"]);

function applyEdit(input: TextAndEntities, edit: Edit): TextAndEntities {
    const { start, end, replacement } = edit;
    const delta = replacement.length - (end - start);

    const text =
        input.text.slice(0, start) + replacement + input.text.slice(end);

    const entities: MessageEntity[] = [];
    for (const entity of input.entities) {
        const from = entity.offset;
        const to = entity.offset + entity.length;

        let offset: number;
        let length: number;

        if (to <= start) {
            offset = from;
            length = entity.length;
        } else if (from >= end) {
            offset = from + delta;
            length = entity.length;
        } else if (from >= start && to <= end) {
            // Before the containment case, so an exact overlap is dropped.
            continue;
        } else if (from <= start && to >= end) {
            offset = from;
            length = entity.length + delta;
        } else if (from < start) {
            offset = from;
            length = start - from;
        } else {
            offset = start + replacement.length;
            length = to - end;
        }

        if (length > 0) entities.push({ ...entity, offset, length });
    }

    return { text, entities };
}

/** So a literal can be handed to RE2 without its punctuation meaning anything. */
const escapeLiteral = (text: string) =>
    text.replace(/[\\.+*?()|[\]{}^$]/g, "\\$&");

function literalEdits(
    text: string,
    needle: string,
    replacement: string,
    caseSensitive: boolean
): Edit[] {
    // Case folding can change a string's length — "\u0130" lowercases to two code
    // units — which would shift every later index away from the original text
    // the entity maths is indexed against. RE2 folds while matching the
    // original, so the spans stay true.
    if (!caseSensitive) {
        return regexEdits(text, escapeLiteral(needle), replacement, false);
    }

    const edits: Edit[] = [];
    let i = text.indexOf(needle);
    while (i !== -1) {
        edits.push({ start: i, end: i + needle.length, replacement });
        i = text.indexOf(needle, i + needle.length);
    }
    return edits;
}

function regexEdits(
    text: string,
    pattern: string,
    replacement: string,
    caseSensitive: boolean
): Edit[] {
    // RE2 takes the flag inline; there is no flags argument to pass.
    const source = caseSensitive ? pattern : `(?i)${pattern}`;
    return matchSpans(source, text).map(({ start, end }) => ({
        start,
        end,
        replacement
    }));
}

/** Telegram already located these, so no URL regex is needed. */
function entitySpanEdits(
    entities: MessageEntity[],
    types: Set<string>
): Edit[] {
    return entities
        .filter((e) => types.has(e.type))
        .map((e) => ({
            start: e.offset,
            end: e.offset + e.length,
            replacement: ""
        }));
}

/** First edit wins on overlap. */
function resolveOverlaps(edits: Edit[]): Edit[] {
    const sorted = [...edits].sort((a, b) => a.start - b.start);
    const out: Edit[] = [];
    let cursor = -1;
    for (const edit of sorted) {
        if (edit.start >= cursor) {
            out.push(edit);
            cursor = edit.end;
        }
    }
    return out;
}

/** Truncate to a Telegram length limit, clamping entities to what survives. */
export function clamp(input: TextAndEntities, limit: number): TextAndEntities {
    if (input.text.length <= limit) return input;
    const text = input.text.slice(0, limit);
    const entities = input.entities.flatMap((e) => {
        if (e.offset >= limit) return [];
        return [{ ...e, length: Math.min(e.length, limit - e.offset) }];
    });
    return { text, entities };
}

export function applyCaption(
    caption: RouteConfig["caption"],
    input: TextAndEntities
): TextAndEntities {
    if (caption.strip) return { text: "", entities: [] };

    const edits: Edit[] = [];
    if (caption.removeLinks) {
        edits.push(...entitySpanEdits(input.entities, LINK_ENTITIES));
    }
    if (caption.removeMentions) {
        edits.push(...entitySpanEdits(input.entities, MENTION_ENTITIES));
    }
    for (const rule of caption.replace) {
        edits.push(
            ...(rule.isRegex
                ? regexEdits(
                      input.text,
                      rule.pattern,
                      rule.replacement,
                      rule.caseSensitive
                  )
                : literalEdits(
                      input.text,
                      rule.pattern,
                      rule.replacement,
                      rule.caseSensitive
                  ))
        );
    }

    // Right to left, so offsets of pending edits stay valid.
    let out = input;
    for (const edit of resolveOverlaps(edits).reverse()) {
        out = applyEdit(out, edit);
    }

    if (caption.prepend) {
        const shift = caption.prepend.length;
        out = {
            text: caption.prepend + out.text,
            entities: out.entities.map((e) => ({
                ...e,
                offset: e.offset + shift
            }))
        };
    }
    if (caption.append) {
        out = { text: out.text + caption.append, entities: out.entities };
    }

    return out;
}
