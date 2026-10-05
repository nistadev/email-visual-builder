/**
 * Polls a synchronous condition on a real-timer interval instead of
 * sleeping a fixed duration and asserting immediately after. Interaction
 * tests that trigger a debounced/async UI update (a canvas re-encode, a
 * floating toolbar mounting after a selection change) were sleeping a
 * guessed number of milliseconds before checking the DOM — a bound that is
 * comfortable on a fast local machine but not guaranteed on a
 * slower/contended CI runner. Polling for the actual condition removes the
 * guesswork: it resolves as soon as the condition is true and only fails
 * after a generous ceiling genuinely elapses.
 *
 * For a React test, pass `tick` as an `act()`-wrapped wait (e.g.
 * `() => act(async () => { await new Promise(r => setTimeout(r, 25)); })`)
 * rather than calling this from inside one long-running `act()` yourself.
 * React only flushes/commits state updates when an `act()` scope *closes*
 * — checking the DOM from inside a single act() call that never returns
 * until the condition is met can never see the update that would satisfy
 * it. Each tick must be its own act() call so React gets a chance to
 * commit between checks.
 */
export async function pollUntil(
  check: () => boolean,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    label?: string;
    tick?: () => Promise<void>;
  } = {},
): Promise<void> {
  const {
    timeoutMs = 5000,
    intervalMs = 25,
    label = "condition",
    tick = () => new Promise((resolve) => setTimeout(resolve, intervalMs)),
  } = options;
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) {
      throw new Error(`pollUntil: ${label} was not met within ${timeoutMs}ms`);
    }
    await tick();
  }
}
