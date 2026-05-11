import { createContext, useContext, type ReactNode } from "react";
import type { Game } from "../../core/Game.js";
import type { Dispatch } from "./useGame.js";

interface GameContextValue {
  game: Game;
  dispatch: Dispatch;
  /** Discards the current Game and starts a fresh one from initial state. */
  reset: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  value,
  children,
}: {
  value: GameContextValue;
  children: ReactNode;
}) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * Read the current Game instance and dispatch function from context.
 * Throws if called outside a <GameProvider>.
 */
export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside a GameProvider");
  return ctx;
}
