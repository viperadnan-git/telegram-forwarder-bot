import { safely, webApp } from "./telegram";

/**
 * Telegram's three haptic vocabularies are not interchangeable. The app uses
 * these verbs and nothing else, so call sites cannot drift:
 *
 *   notify    the outcome of something the user asked for
 *   selection a value being changed: toggles, segments, chips
 *   impact    a discrete physical event, like text landing on the clipboard
 */

type Outcome = "success" | "warning" | "error";

const feedback = () => webApp?.HapticFeedback;

export const notify = (outcome: Outcome = "success") =>
    safely(() => feedback()?.notificationOccurred(outcome));

export const selection = () => safely(() => feedback()?.selectionChanged());

export const impact = (
    style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light"
) => safely(() => feedback()?.impactOccurred(style));

/**
 * Always reports an outcome: a failure that buzzes nothing feels like nothing
 * happened. Rethrows, so the caller still shows its own error.
 */
export async function run<T>(
    op: () => Promise<T>,
    outcome: (result: T) => Outcome = () => "success"
): Promise<T> {
    try {
        const result = await op();
        notify(outcome(result));
        return result;
    } catch (error) {
        notify("error");
        throw error;
    }
}
