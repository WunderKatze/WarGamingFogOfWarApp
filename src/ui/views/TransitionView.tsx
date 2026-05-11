import { useGameContext } from "../hooks/useGameContext.js";

export function TransitionView() {
  const { game, dispatch } = useGameContext();
  const activePlayer = game.state.getActivePlayer();
  const nextIsDeploy = !game.state.isDeploymentComplete();
  const recent = game.state.recentReveals;
  const buttonLabel = nextIsDeploy ? "Begin Deployment" : "Start Turn";

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
