/**
 * One dialog for the whole app, so a question and a message never arrive
 * looking like two different products. Callers await a promise; App.svelte
 * renders the single component this state drives.
 */

type Request = {
    title: string;
    body: string[];
    confirmLabel?: string;
    cancellable: boolean;
    settle: (ok: boolean) => void;
};

export const dialog = $state<{ current: Request | null }>({ current: null });

function open(req: Omit<Request, "settle">): Promise<boolean> {
    // A second request would strand the first caller's promise for ever.
    dialog.current?.settle(false);

    return new Promise((resolve) => {
        dialog.current = {
            ...req,
            settle: (ok) => {
                dialog.current = null;
                resolve(ok);
            }
        };
    });
}

/** Resolves false when dismissed, so callers can guard on it. */
export const ask = (
    title: string,
    body: string | string[],
    confirmLabel?: string
): Promise<boolean> =>
    open({
        title,
        body: Array.isArray(body) ? body : [body],
        confirmLabel,
        cancellable: true
    });

/** Nothing to decide: one button, and dismissing is the only outcome. */
export const alert = (title: string, body: string | string[]): Promise<void> =>
    open({
        title,
        body: Array.isArray(body) ? body : [body],
        cancellable: false
    }).then(() => {});
