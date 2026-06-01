import { useMemo } from "react";
import { Circle, Group, Text } from "react-konva";
import { type Rules } from "../../core/rules.js";
import type { Point, TeamId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import type { VisionCalculator } from "../../core/VisionCalculator.js";
import {
  abstractDivisorRings,
  resolveLens,
  ringsForUnit,
  type Ring,
  type ResolvedLens,
} from "./discoveryRings.js";
import { useDiscoveryVisualizerContext } from "../hooks/useDiscoveryVisualizerContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useRulesContext } from "../hooks/useRulesContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";
import { theme } from "../theme.js";

const INCOMING_COLOR = "#c04040";
const OUTGOING_COLOR = "#2d8e2d";
const RING_OPACITY = 0.55;
const RING_STROKE_WIDTH = 1.5;
const LABEL_FONT_SIZE = 10;
const LABEL_OFFSET_PX = 4;

interface Props {
  perspectiveTeamId: TeamId;
}

/**
 * Konva overlay rendering the Discovery Visualizer rings on the map.
 * Mounted via the `overlay` prop on `MapCanvas` from each gameplay view.
 *
 * Reads settings from the Visualizer context, computes rings via the pure
 * `discoveryRings` module, and renders one Group per shown unit.
 *
 * See docs/features/v1/discovery-visualizer.md §2.5 / §8.4.
 */
export function DiscoveryVisualizerOverlay({ perspectiveTeamId }: Props) {
  const { game } = useGameContext();
  const { rules } = useRulesContext();
  const { settings } = useDiscoveryVisualizerContext();
  const { selectedUnitId, hoveredUnitId, previewPositionOverride } = useSelectionContext();

  const shownUnits = useMemo<Unit[]>(() => {
    if (settings.scope === "off") return [];
    if (settings.scope === "selected") {
      const u = selectedUnitId ? game.state.getUnitById(selectedUnitId) : undefined;
      if (!u || u.teamId !== perspectiveTeamId) return [];
      return [u];
    }
    return game.state.units.filter((u) => u.teamId === perspectiveTeamId);
  }, [settings.scope, selectedUnitId, game, perspectiveTeamId]);

  // Copy-from-hover override: if a revealed enemy is hovered, build a lens
  // from its actual state. Otherwise, resolve the manually-selected lens.
  const lens: ResolvedLens | null = useMemo(() => {
    if (settings.archetype.kind === "none") return null;
    if (settings.copyFromHover && hoveredUnitId) {
      const enemy = game.state.getUnitById(hoveredUnitId);
      const isRevealedEnemy =
        enemy &&
        enemy.teamId !== perspectiveTeamId &&
        game.state.visionState.revealed.has(enemy.id);
      if (isRevealedEnemy && enemy) {
        return enemyAsLens(enemy, game.visionCalculator, rules);
      }
    }
    return resolveLens(
      settings.archetype,
      settings.postureModifier,
      settings.goneToGround,
      rules,
    );
  }, [
    settings.archetype,
    settings.postureModifier,
    settings.goneToGround,
    settings.copyFromHover,
    hoveredUnitId,
    game,
    perspectiveTeamId,
    rules,
  ]);

  if (shownUnits.length === 0) return null;

  const px = theme.pixelsPerInch;

  return (
    <Group listening={false}>
      {shownUnits.map((unit) => {
        const isPreviewing = previewPositionOverride?.unitId === unit.id;
        const position = isPreviewing ? previewPositionOverride.position : unit.getPosition();
        const rings = lens === null
          ? abstractDivisorRings(unit, rules)
          : ringsForUnit(unit, position, game.visionCalculator, lens, { treatAsJustMoved: isPreviewing });
        return (
          <UnitRingGroup
            key={unit.id}
            position={position}
            rings={rings}
            pixelsPerInch={px}
          />
        );
      })}
    </Group>
  );
}

function UnitRingGroup({
  position,
  rings,
  pixelsPerInch,
}: {
  position: Point;
  rings: Ring[];
  pixelsPerInch: number;
}) {
  const cx = position.x * pixelsPerInch;
  const cy = position.y * pixelsPerInch;
  return (
    <Group>
      {rings.map((r, i) => {
        const radiusPx = r.radiusInches * pixelsPerInch;
        const color = r.direction === "incoming" ? INCOMING_COLOR : OUTGOING_COLOR;
        return (
          <Group key={i}>
            <Circle
              x={cx}
              y={cy}
              radius={radiusPx}
              stroke={color}
              strokeWidth={RING_STROKE_WIDTH}
              opacity={RING_OPACITY}
              listening={false}
            />
            <Text
              x={cx + radiusPx + LABEL_OFFSET_PX}
              y={cy - LABEL_FONT_SIZE / 2}
              text={r.label}
              fontSize={LABEL_FONT_SIZE}
              fill={color}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * Build a ResolvedLens from a revealed enemy unit's actual state. Used
 * by the copy-from-hover feature.
 *
 * The lens reads the enemy's actual effective stealth through the engine
 * R4 read API (R4 closes B7). For the `postureModifier` slot — which
 * historically was just the position-only terrain stealth — we strip
 * out the intrinsic + GtG factors so it represents the *cover-only*
 * portion the player would see in the lens picker. The intrinsic and
 * GtG-conditional factors are reapplied via the lens's existing
 * `threatEffectiveStealthMultiplier` formula so the outgoing-ring math
 * stays self-consistent with manually-picked lenses.
 */
function enemyAsLens(enemy: Unit, vc: VisionCalculator, rules: Rules): ResolvedLens {
  // Position-only stealth read (no observer): this is the cover-only
  // contribution from polygons containing the enemy's position. It
  // mirrors what the player would pick from the posture dropdown.
  const positionStealth = vc.effectiveStealth(enemy, enemy.getPosition());
  // Strip intrinsic + GtG from the returned breakdown to isolate the
  // "cover" portion. Intrinsic and GtG are re-applied below so the
  // lens's posture aligns with what the dropdown options represent.
  const coverReadings = positionStealth.breakdown.filter(
    (r) => r.contributorId !== "intrinsic" && r.contributorId !== "gone-to-ground",
  );
  const posture = coverReadings.length === 0
    ? 1
    : coverReadings.reduce((m, r) => Math.max(m, r.modifier), 1);
  const gtgStacks = enemy.goneToGround && posture > 1;
  return {
    archetype: {
      unitType: enemy.type,
      recon: enemy.hasModifier("Recon"),
      label: enemy.name,
      vision: enemy.getVision(),
      intrinsicStealth: enemy.getIntrinsicStealth(),
    },
    postureModifier: posture,
    goneToGround: enemy.goneToGround,
    threatEffectiveStealthMultiplier:
      enemy.getIntrinsicStealth() *
      posture *
      (gtgStacks ? rules.goneToGroundStealthModifier : 1),
  };
}

