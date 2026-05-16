import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Modifier, PolygonTerrainType, UnitType } from "../../core/types.js";
import { useRulesContext } from "../hooks/useRulesContext.js";
import { theme } from "../theme.js";

/**
 * Editor panel for runtime-mutable vision rules. Mounted inside the Game
 * menu's "Adjust Vision Rules" sub-panel. See `docs/features/game-menu.md`.
 *
 * Each rule value is a free-form numeric input. Edits commit on every
 * change that parses to a positive number; invalid drafts stay in the
 * input but don't propagate. The values flow through `useRulesContext`,
 * which mirrors them into the core Rules singleton and marks
 * `GameState.rulesChangedThisTurn = true` for the next-turn notice.
 *
 * Saved rule sets and file import/export are NOT in this commit — they
 * land in a follow-up.
 */
export function RulesEditor() {
  const { rules, setRules, resetRules } = useRulesContext();

  const setUnitStat = (type: UnitType, field: "baseVision" | "baseStealth", value: number) => {
    setRules({
      unitTypeStats: {
        ...rules.unitTypeStats,
        [type]: { ...rules.unitTypeStats[type], [field]: value },
      },
    });
  };

  const setModifierEffect = (
    mod: Modifier,
    field: "visionMultiplier" | "stealthMultiplier",
    value: number,
  ) => {
    setRules({
      modifierEffects: {
        ...rules.modifierEffects,
        [mod]: { ...rules.modifierEffects[mod], [field]: value },
      },
    });
  };

  const setPolygonStealth = (kind: PolygonTerrainType, value: number) => {
    setRules({
      polygonStealthModifier: {
        ...rules.polygonStealthModifier,
        [kind]: value,
      },
    });
  };

  const handleReset = () => {
    if (window.confirm("Reset all vision rules to defaults? Any in-progress edits will be lost.")) {
      resetRules();
    }
  };

  return (
    <div style={panelStyle}>
      <Section title="Unit type — Infantry">
        <NumberField
          label="Base vision"
          suffix={'"'}
          value={rules.unitTypeStats.Infantry.baseVision}
          onChange={(v) => setUnitStat("Infantry", "baseVision", v)}
        />
        <NumberField
          label="Base stealth"
          suffix="×"
          value={rules.unitTypeStats.Infantry.baseStealth}
          onChange={(v) => setUnitStat("Infantry", "baseStealth", v)}
        />
      </Section>

      <Section title="Unit type — Tank">
        <NumberField
          label="Base vision"
          suffix={'"'}
          value={rules.unitTypeStats.Tank.baseVision}
          onChange={(v) => setUnitStat("Tank", "baseVision", v)}
        />
        <NumberField
          label="Base stealth"
          suffix="×"
          value={rules.unitTypeStats.Tank.baseStealth}
          onChange={(v) => setUnitStat("Tank", "baseStealth", v)}
        />
      </Section>

      <Section title="Modifiers">
        <NumberField
          label="Recon vision"
          suffix="×"
          value={rules.modifierEffects.Recon.visionMultiplier}
          onChange={(v) => setModifierEffect("Recon", "visionMultiplier", v)}
        />
        <NumberField
          label="Recon stealth"
          suffix="×"
          value={rules.modifierEffects.Recon.stealthMultiplier}
          onChange={(v) => setModifierEffect("Recon", "stealthMultiplier", v)}
        />
        <NumberField
          label="Dug-in stealth"
          suffix="×"
          value={rules.dugInStealthModifier}
          onChange={(v) => setRules({ dugInStealthModifier: v })}
        />
      </Section>

      <Section title="Terrain stealth">
        <NumberField
          label="Building"
          suffix="×"
          value={rules.polygonStealthModifier.Building}
          onChange={(v) => setPolygonStealth("Building", v)}
        />
        <NumberField
          label="Tall Woods"
          suffix="×"
          value={rules.polygonStealthModifier.TallWoods}
          onChange={(v) => setPolygonStealth("TallWoods", v)}
        />
        <NumberField
          label="Short Terrain"
          suffix="×"
          value={rules.polygonStealthModifier.ShortTerrain}
          onChange={(v) => setPolygonStealth("ShortTerrain", v)}
        />
        <NumberField
          label="Short Wall"
          suffix="×"
          value={rules.shortWallStealthModifier}
          onChange={(v) => setRules({ shortWallStealthModifier: v })}
        />
        <ReadOnlyRow label="Tall Wall">blocks LOS</ReadOnlyRow>
      </Section>

      <Section title="Terrain blocking">
        <NumberField
          label="Tall Woods ray-through limit"
          suffix={'"'}
          value={rules.tallWoodsRayThroughLimit}
          onChange={(v) => setRules({ tallWoodsRayThroughLimit: v })}
        />
      </Section>

      <div style={footerStyle}>
        <button type="button" onClick={handleReset} style={resetButtonStyle}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  suffix?: string;
  value: number;
  onChange: (next: number) => void;
}

/**
 * Controlled positive-number input with a local draft.
 * - Draft mirrors the input string so the user can type freely.
 * - When the draft parses to a positive finite number, that value flows
 *   up via `onChange`. Otherwise the rules object isn't updated yet (the
 *   draft stays where the user left it).
 * - When `value` changes from outside (e.g., Reset to defaults), the
 *   draft re-syncs.
 */
function NumberField({ label, suffix, value, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(value.toString());

  useEffect(() => {
    setDraft(value.toString());
  }, [value]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.value;
    setDraft(next);
    const parsed = parseFloat(next);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== value) {
      onChange(parsed);
    }
  };

  return (
    <label style={fieldRowStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <span style={fieldInputWrapStyle}>
        <input
          type="number"
          value={draft}
          onChange={handleChange}
          step="any"
          min="0"
          style={fieldInputStyle}
        />
        {suffix && <span style={fieldSuffixStyle}>{suffix}</span>}
      </span>
    </label>
  );
}

function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={fieldRowStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <span style={readOnlyValueStyle}>{children}</span>
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: 320,
  maxHeight: 480,
  overflowY: "auto",
  padding: theme.spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.md,
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: theme.fontSize.xs,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: theme.colors.textMuted,
  fontWeight: 600,
};

const sectionBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs,
};

const fieldRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing.md,
  fontSize: theme.fontSize.sm,
};

const fieldLabelStyle: CSSProperties = {
  color: theme.colors.text,
};

const fieldInputWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.xs,
};

const fieldInputStyle: CSSProperties = {
  width: 70,
  padding: "2px 6px",
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
  textAlign: "right",
};

const fieldSuffixStyle: CSSProperties = {
  color: theme.colors.textMuted,
  fontSize: theme.fontSize.sm,
  width: 12,
};

const readOnlyValueStyle: CSSProperties = {
  color: theme.colors.textMuted,
  fontSize: theme.fontSize.sm,
  fontStyle: "italic",
};

const footerStyle: CSSProperties = {
  marginTop: theme.spacing.sm,
  display: "flex",
  justifyContent: "flex-end",
};

const resetButtonStyle: CSSProperties = {
  padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
  background: theme.colors.secondary,
  color: "#fff",
  border: "none",
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
};
