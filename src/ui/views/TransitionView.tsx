import type { CSSProperties } from "react";
import { useGameContext } from "../hooks/useGameContext.js";

const noticeStyle: CSSProperties = {
  background: "rgba(255, 200, 60, 0.12)",
  border: "1px solid #c9a14b",
  color: "#ffd87a",
  borderRadius: 6,
  padding: "10px 16px",
  fontSize: 14,
  textAlign: "center",
};

export function TransitionView() {
  const { game, dispatch } = useGameContext();
  const activePlayer = game.state.getActivePlayer();
  const nextIsDeploy = !game.state.isDeploymentComplete();
  const recent = game.state.recentReveals;
  const buttonLabel = nextIsDeploy ? "Begin Deployment" : "Start Turn";
  const debugUsed = game.state.debugUsedThisTurn;
  const rulesChanged = game.state.rulesChangedThisTurn;
  // Render the post-deployment first-player-select variant when both
  // players have deployed but nobody has been picked to go first yet.
  // Per docs/features/deployment-stop-gap.md §2.5, this is a separate
  // screen so a misclick lands on the wrong team's Start-Turn prompt
  // rather than directly revealing their map.
  if (
    game.state.isDeploymentComplete() &&
    game.state.turnNumber === 0 &&
    !game.state.firstPlayerChosen
  ) {
    return <FirstPlayerSelect />;
  }

  const reveal = (ids: string[]) =>
    ids.map((id) => game.state.getUnitById(id)?.name ?? id).join(", ");

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#222",
        color: "#eee",
        gap: 24,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7 }}>Pass the device.</div>
      <h1 style={{ fontSize: 48, margin: 0 }}>
        Team {activePlayer} — your turn
      </h1>

      {(debugUsed || rulesChanged) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxWidth: 480,
          }}
        >
          {debugUsed && (
            <div style={noticeStyle}>
              ⚠ The previous player used Debug Mode this turn.
            </div>
          )}
          {rulesChanged && (
            <div style={noticeStyle}>
              ⚠ Vision Rules changed this turn.
            </div>
          )}
        </div>
      )}

      {(recent.added.length > 0 || recent.removed.length > 0) && (
        <div
          style={{
            background: "#333",
            border: "1px solid #555",
            borderRadius: 6,
            padding: "16px 20px",
            maxWidth: 480,
            fontSize: 14,
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>
            Reveal changes from the last turn:
          </strong>
          {recent.added.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "#ffa64d" }}>Place on table: </span>
              {reveal(recent.added)}
            </div>
          )}
          {recent.removed.length > 0 && (
            <div>
              <span style={{ color: "#a0d8ff" }}>Remove from table: </span>
              {reveal(recent.removed)}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => dispatch((g) => g.startTurn())}
        style={{
          padding: "14px 28px",
          background: "#2b6cb0",
          color: "white",
          border: "none",
          borderRadius: 6,
          fontSize: 18,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

/**
 * Post-deployment "who goes first?" variant. Shown once, between the last
 * player's endDeployment and the first Move turn. Clicking a team sets the
 * active player and surfaces that team's normal Start-Turn Transition on
 * the next render — a misclick is recoverable because the wrong team's
 * Start-Turn screen reveals no map.
 */
function FirstPlayerSelect() {
  const { game, dispatch } = useGameContext();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#222",
        color: "#eee",
        gap: 32,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7 }}>Deployment complete.</div>
      <h1 style={{ fontSize: 40, margin: 0 }}>Who goes first?</h1>
      <p style={{ fontSize: 14, opacity: 0.7, margin: 0, maxWidth: 480, textAlign: "center" }}>
        Roll off at the table, then tap the winning team.
      </p>
      <div style={{ display: "flex", gap: 24 }}>
        {game.state.players.map((team) => (
          <button
            key={team}
            type="button"
            onClick={() => dispatch((g) => g.chooseFirstPlayer(team))}
            style={{
              padding: "20px 36px",
              background: "#2b6cb0",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 22,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Team {team} goes first
          </button>
        ))}
      </div>
    </div>
  );
}
