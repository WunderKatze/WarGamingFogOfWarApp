import { defaultRules, type Rules } from "../../core/rules.js";

/**
 * localStorage + JSON file I/O for named rule sets, shared by the Rules
 * editor. The built-in "Default" set is NOT stored — it lives in code as
 * `defaultRules` and is always available in the dropdown.
 *
 * Schema (in localStorage):
 *   wargame.savedRuleSets     → JSON `{ [name]: Rules }` of user-defined sets
 *   wargame.activeRuleSetName → string, the currently-selected set name
 *
 * Schema (file format for export / import):
 *   { name: string, rules: Rules }
 */

const STORAGE_SETS_KEY = "wargame.savedRuleSets";
const STORAGE_ACTIVE_KEY = "wargame.activeRuleSetName";

export const DEFAULT_SET_NAME = "Default";

/** Read all saved sets (user-defined only — "Default" is implicit). */
export function readSavedSets(): Record<string, Rules> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_SETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Each value should validate as a Rules; drop anything that doesn't.
    const out: Record<string, Rules> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      const rules = validateRules(value);
      if (rules) out[name] = rules;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeSavedSets(sets: Record<string, Rules>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_SETS_KEY, JSON.stringify(sets));
  } catch {
    // Quota exceeded or storage unavailable — degrade silently. The editor
    // is still functional with in-memory rules; the caller may want to warn
    // the user separately.
  }
}

export function readActiveSetName(): string {
  if (typeof localStorage === "undefined") return DEFAULT_SET_NAME;
  try {
    return localStorage.getItem(STORAGE_ACTIVE_KEY) ?? DEFAULT_SET_NAME;
  } catch {
    return DEFAULT_SET_NAME;
  }
}

export function writeActiveSetName(name: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_ACTIVE_KEY, name);
  } catch {
    // Same degrade path as writeSavedSets.
  }
}

/**
 * Coerce an unknown value into a Rules. Missing top-level keys fall back
 * to `defaultRules`, so a saved set from an earlier schema still loads.
 * Returns null if the input isn't even an object — the caller decides
 * whether to surface that as an error.
 *
 * Deep shape isn't fully validated in v1 — we trust files that look
 * roughly right. A malicious / corrupt deep value will produce wrong
 * behavior, not a crash.
 */
export function validateRules(raw: unknown): Rules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Partial<Rules>;
  return {
    unitTypeStats: o.unitTypeStats ?? structuredClone(defaultRules.unitTypeStats),
    modifierEffects: o.modifierEffects ?? structuredClone(defaultRules.modifierEffects),
    dugInStealthModifier:
      typeof o.dugInStealthModifier === "number"
        ? o.dugInStealthModifier
        : defaultRules.dugInStealthModifier,
    polygonStealthModifier:
      o.polygonStealthModifier ?? structuredClone(defaultRules.polygonStealthModifier),
    shortWallStealthModifier:
      typeof o.shortWallStealthModifier === "number"
        ? o.shortWallStealthModifier
        : defaultRules.shortWallStealthModifier,
    tallWoodsRayThroughLimit:
      typeof o.tallWoodsRayThroughLimit === "number"
        ? o.tallWoodsRayThroughLimit
        : defaultRules.tallWoodsRayThroughLimit,
  };
}

/** Wraps a Rules in the export envelope. */
export interface RuleSetFile {
  name: string;
  rules: Rules;
}

/** Trigger a browser download of a JSON rule-set file. */
export function downloadRuleSet(name: string, rules: Rules): void {
  const payload: RuleSetFile = { name, rules };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wargame-rules-${sanitizeFileName(name)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse the JSON contents of an uploaded file. */
export function parseRuleSetFile(jsonText: string): RuleSetFile | null {
  try {
    const raw = JSON.parse(jsonText);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name !== "string" || !obj.name.trim()) return null;
    const rules = validateRules(obj.rules);
    if (!rules) return null;
    return { name: obj.name.trim(), rules };
  } catch {
    return null;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 64) || "ruleset";
}
