import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { defaultRules, type Rules } from "../../core/rules.js";
import type { Modifier, PolygonTerrainType, UnitType } from "../../core/types.js";
import { useRulesContext } from "../hooks/useRulesContext.js";
import { theme } from "../theme.js";
import {
  DEFAULT_SET_NAME,
  downloadRuleSet,
  parseRuleSetFile,
  readActiveSetName,
  readSavedSets,
  writeActiveSetName,
  writeSavedSets,
} from "./ruleSetStorage.js";

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
 * Saved rule sets persist to browser localStorage; "Default" is the
 * built-in baseline and is always present in the dropdown. JSON file
 * import/export complements localStorage for sharing sets between users.
 */
export function RulesEditor() {
  const { rules, setRules, resetRules } = useRulesContext();
  const [savedSets, setSavedSets] = useState<Record<string, Rules>>(() => readSavedSets());
  const [activeSetName, setActiveSetName] = useState<string>(() => readActiveSetName());
  /**
   * Non-null while the player is naming a new saved set via the inline
   * Save-as UI. We avoid window.prompt here because Chromium renders it as
   * a small browser-chrome dropdown that's easy to miss while focused on
   * the bottom-of-screen menu.
   */
  const [pendingSaveName, setPendingSaveName] = useState<string | null>(null);
  /**
   * Non-null while the saved-set dropdown change is awaiting confirmation.
   * The confirm is fired from an effect, NOT directly inside the select's
   * onChange, because calling window.confirm synchronously while a select
   * is committing leaves Chromium's display stuck on the previous option
   * even after React updates the controlled `value`.
   */
  const [pendingSwitchName, setPendingSwitchName] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Keep activeSetName in sync with localStorage in case multiple tabs are
  // open (StorageEvent fires in *other* tabs when this one writes).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "wargame.savedRuleSets") setSavedSets(readSavedSets());
      if (e.key === "wargame.activeRuleSetName") setActiveSetName(readActiveSetName());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const applySet = (name: string) => {
    const next = name === DEFAULT_SET_NAME ? structuredClone(defaultRules) : savedSets[name];
    if (!next) return;
    setRules(next);
    setActiveSetName(name);
    writeActiveSetName(name);
  };

  const handleSelectSet = (name: string) => {
    if (name === activeSetName) return;
    // Stash the target and let an effect fire the confirm — running it
    // inside this synchronous handler leaves Chromium's select stuck.
    setPendingSwitchName(name);
  };

  useEffect(() => {
    if (pendingSwitchName === null) return;
    const target = pendingSwitchName;
    setPendingSwitchName(null);
    if (target === activeSetName) return;
    if (!window.confirm(`Switch to rule set "${target}"? Any in-progress edits will be replaced.`)) return;
    applySet(target);
    // applySet/activeSetName are stable enough that re-running on every
    // change is benign — the early null check is the real gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSwitchName]);

  const beginSaveAs = () => {
    setPendingSaveName(activeSetName === DEFAULT_SET_NAME ? "" : activeSetName);
  };

  const cancelSaveAs = () => {
    setPendingSaveName(null);
  };

  const commitSaveAs = () => {
    if (pendingSaveName === null) return;
    const name = pendingSaveName.trim();
    if (!name) return;
    if (name === DEFAULT_SET_NAME) {
      window.alert(`"${DEFAULT_SET_NAME}" is reserved.`);
      return;
    }
    if (savedSets[name] && !window.confirm(`Overwrite existing "${name}"?`)) return;
    const next = { ...savedSets, [name]: structuredClone(rules) };
    setSavedSets(next);
    writeSavedSets(next);
    setActiveSetName(name);
    writeActiveSetName(name);
    setPendingSaveName(null);
  };

  const handleDelete = () => {
    if (activeSetName === DEFAULT_SET_NAME) return;
    if (!window.confirm(`Delete rule set "${activeSetName}"?`)) return;
    const next = { ...savedSets };
    delete next[activeSetName];
    setSavedSets(next);
    writeSavedSets(next);
    setActiveSetName(DEFAULT_SET_NAME);
    writeActiveSetName(DEFAULT_SET_NAME);
    setRules(structuredClone(defaultRules));
  };

  const handleExport = () => {
    downloadRuleSet(activeSetName, rules);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename later
    if (!file) return;
    const text = await file.text();
    const parsed = parseRuleSetFile(text);
    if (!parsed) {
      window.alert("Couldn't read rule set — file is malformed or missing required fields.");
      return;
    }
    let name = parsed.name;
    // "Default" is reserved for the built-in baseline; an exported Default
    // set must be re-saved under a different name when it comes back in.
    if (name === DEFAULT_SET_NAME) {
      const renamed = window.prompt(`"${DEFAULT_SET_NAME}" is reserved. Save imported set as:`, "Imported");
      if (!renamed?.trim()) return;
      name = renamed.trim();
      if (name === DEFAULT_SET_NAME) return; // user just typed Default again
    }
    if (savedSets[name]) {
      const overwrite = window.confirm(`A rule set named "${name}" already exists. Overwrite?`);
      if (!overwrite) {
        const renamed = window.prompt("New name:", `${name} (imported)`);
        if (!renamed?.trim()) return;
        name = renamed.trim();
        if (name === DEFAULT_SET_NAME) return;
      }
    }
    const next = { ...savedSets, [name]: parsed.rules };
    setSavedSets(next);
    writeSavedSets(next);
    setActiveSetName(name);
    writeActiveSetName(name);
    setRules(parsed.rules);
  };

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

  // Filter out any "Default" key that might have leaked into savedSets from
  // an older buggy import — the dropdown shows the built-in Default exactly
  // once, always at the top.
  const userSetNames = Object.keys(savedSets).filter((n) => n !== DEFAULT_SET_NAME).sort();
  const setNames: string[] = [DEFAULT_SET_NAME, ...userSetNames];
  const canDelete = activeSetName !== DEFAULT_SET_NAME;

  return (
    <div style={panelStyle}>
      <Section title="Saved rule sets">
        <div style={fieldRowStyle}>
          <span style={fieldLabelStyle}>Active</span>
          <select
            value={activeSetName}
            onChange={(e) => handleSelectSet(e.target.value)}
            style={selectStyle}
          >
            {setNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div style={buttonRowStyle}>
          <button type="button" onClick={beginSaveAs} style={smallButtonStyle}>Save as…</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            style={canDelete ? smallButtonStyle : smallButtonDisabledStyle}
          >
            Delete
          </button>
          <button type="button" onClick={handleExport} style={smallButtonStyle}>Export</button>
          <button type="button" onClick={handleImportClick} style={smallButtonStyle}>Import</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
        {pendingSaveName !== null && (
          <div style={inlineSaveRowStyle}>
            <input
              autoFocus
              type="text"
              value={pendingSaveName}
              onChange={(e) => setPendingSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSaveAs();
                if (e.key === "Escape") cancelSaveAs();
              }}
              placeholder="New rule-set name"
              style={inlineSaveInputStyle}
            />
            <button
              type="button"
              onClick={commitSaveAs}
              disabled={!pendingSaveName.trim()}
              style={pendingSaveName.trim() ? smallButtonStyle : smallButtonDisabledStyle}
            >
              Save
            </button>
            <button type="button" onClick={cancelSaveAs} style={smallButtonStyle}>Cancel</button>
          </div>
        )}
      </Section>

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
        <NumberField
          label="Woods / Short Terrain edge grace"
          suffix={'"'}
          value={rules.terrainEdgeGraceDistance}
          onChange={(v) => setRules({ terrainEdgeGraceDistance: v })}
        />
      </Section>

      <Section title="Gone to Ground">
        <NumberField
          label="Stealth multiplier (stacks)"
          suffix="×"
          value={rules.goneToGroundStealthModifier}
          onChange={(v) => setRules({ goneToGroundStealthModifier: v })}
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

const selectStyle: CSSProperties = {
  padding: "2px 6px",
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
  background: "#fff",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.xs,
  marginTop: theme.spacing.xs,
};

const smallButtonStyle: CSSProperties = {
  padding: `2px ${theme.spacing.sm + 2}px`,
  background: "#fff",
  color: theme.colors.text,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  cursor: "pointer",
};

const smallButtonDisabledStyle: CSSProperties = {
  ...smallButtonStyle,
  opacity: 0.4,
  cursor: "not-allowed",
};

const inlineSaveRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.xs,
  marginTop: theme.spacing.xs,
};

const inlineSaveInputStyle: CSSProperties = {
  flex: 1,
  padding: "2px 6px",
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
};
