import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getRules,
  resetRules as coreResetRules,
  setRules as coreSetRules,
  subscribeRules,
  type Rules,
} from "../../core/rules.js";
import { useGameContext } from "./useGameContext.js";

interface RulesContextValue {
  /** Live snapshot of the current rule values. Re-rendered on every change. */
  rules: Rules;
  /**
   * Merges `partial` into the current rules (shallow at the top level — see
   * core `setRules`) and marks `GameState.rulesChangedThisTurn = true` so
   * the next Transition shows a notice.
   */
  setRules(partial: Partial<Rules>): void;
  /** Restore default values. Also marks rules-changed. */
  resetRules(): void;
}

const RulesContext = createContext<RulesContextValue | null>(null);

/**
 * Subscribes to the core rules singleton and exposes a React-friendly API.
 * Mount inside GameProvider — needs `dispatch` to flip the game's
 * `rulesChangedThisTurn` flag whenever a rule is edited from the UI.
 */
export function RulesProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useGameContext();
  const [, setVersion] = useState(0);

  useEffect(() => {
    return subscribeRules(() => setVersion((v) => v + 1));
  }, []);

  const setRules = useCallback(
    (partial: Partial<Rules>) => {
      coreSetRules(partial);
      dispatch((g) => g.markRulesChanged());
    },
    [dispatch],
  );

  const resetRules = useCallback(() => {
    coreResetRules();
    dispatch((g) => g.markRulesChanged());
  }, [dispatch]);

  const rules = getRules();
  const value = useMemo<RulesContextValue>(
    () => ({ rules, setRules, resetRules }),
    [rules, setRules, resetRules],
  );

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useRulesContext(): RulesContextValue {
  const ctx = useContext(RulesContext);
  if (!ctx) throw new Error("useRulesContext must be used inside a RulesProvider");
  return ctx;
}
