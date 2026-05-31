import type { Ruleset } from "./Ruleset.js";

/**
 * Process-wide registry of available rulesets, keyed by `Ruleset.id`.
 *
 * The registry is the spine through which engine-core stays
 * ruleset-agnostic: engine-core code never imports a specific ruleset
 * directly (R3), it looks one up by id. Each ruleset bundle calls
 * `registerRuleset` from its own entry module; the application's boot
 * sequence (src/main.tsx) imports and registers every ruleset before
 * mounting the UI.
 *
 * Step 1a only establishes the pattern — nothing in the engine yet
 * consults the registry. Subsequent Phase B step-1 sub-steps add the
 * axis-specific slots to `Ruleset`, and step 2 migrates the WWII
 * implementation to be sourced from the registered bundle.
 *
 * See docs/features/v2/mechanics-refactor.md §8 (sequencing) and
 * §13.1 (file organization / R3).
 */

const rulesets = new Map<string, Ruleset>();

/**
 * Register a ruleset bundle. Throws if a different ruleset with the same
 * id is already registered (catches accidental double-registration with
 * conflicting contents). Re-registering the exact same object reference
 * is a no-op so HMR / repeated test setup remains safe.
 */
export function registerRuleset(ruleset: Ruleset): void {
  const existing = rulesets.get(ruleset.id);
  if (existing === ruleset) return;
  if (existing !== undefined) {
    throw new Error(
      `Ruleset already registered with id "${ruleset.id}". Use a distinct id ` +
        `or unregister the previous bundle first.`,
    );
  }
  rulesets.set(ruleset.id, ruleset);
}

/** Look up a ruleset by id. Returns undefined when none is registered. */
export function getRuleset(id: string): Ruleset | undefined {
  return rulesets.get(id);
}

/**
 * Snapshot of every currently-registered ruleset. The returned array is
 * a fresh copy; ordering is registration order.
 */
export function listRulesets(): readonly Ruleset[] {
  return [...rulesets.values()];
}

/**
 * Drop every registered ruleset. Test-only convenience — production code
 * should never need to clear the registry. Exposed because vitest's
 * default isolation reuses the same module instance across tests in a
 * file, so a per-test reset is the cleanest way to keep the registry
 * state predictable.
 */
export function clearRulesets(): void {
  rulesets.clear();
}
