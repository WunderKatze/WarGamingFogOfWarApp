import type { KonvaEventObject } from "konva/lib/Node";
import ms from "milsymbol";
import { useMemo } from "react";
import { Circle, Group, Image as KonvaImage, Line, Text } from "react-konva";
import type { TeamId, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { theme } from "../theme.js";

const SYMBOL_SIZE_PX = 18;
const NAME_TAG_WIDTH = 80;
const NAME_TAG_FONT_SIZE = 10;

/** Radius of the dot at the unit's actual (x, y). */
const POSITION_DOT_RADIUS = 2.5;
/** Vertical pixels of visible stem between the dot and the name. */
const STEM_LENGTH = 10;
/** Gap between adjacent layout pieces. */
const GAP_SYMBOL_TO_NAME = 2;
const GAP_NAME_TO_STEM = 2;
const GAP_STEM_TO_DOT = POSITION_DOT_RADIUS + 1;

const ECHELON_CODE: Record<UnitSize, string> = {
  Squad: "B",
  Platoon: "D",
  Company: "E",
  Battalion: "F",
};

const FUNCTION_CODE: Record<UnitType, string> = {
  Infantry: "UCI",
  Tank: "UCA",
};

/**
 * Builds a NATO APP-6 / MIL-STD-2525B SIDC string for milsymbol.
 *
 * Layout (15 chars, 1-indexed):
 *   1  Scheme       — `S` (warfighting)
 *   2  Affiliation  — `F` (friend) or `H` (hostile) per perspective
 *   3  Dimension    — `G` (ground)
 *   4  Status       — `P` (present)
 *   5-10 Function   — `UCI---` (infantry) / `UCA---` (armor)
 *   11   Mobility   — `-`
 *   12   Echelon    — `B`/`D`/`E`/`F` from size
 *   13-15 Country/OB — `---`
 */
function buildSidc(unit: Unit, perspectiveTeamId: TeamId): string {
  const affiliation = unit.teamId === perspectiveTeamId ? "F" : "H";
  return `S${affiliation}GP${FUNCTION_CODE[unit.type]}----${ECHELON_CODE[unit.size]}---`;
}

interface Props {
  unit: Unit;
  pixelsPerInch: number;
  perspectiveTeamId: TeamId;
  selected?: boolean;
  fired?: boolean;
  /** True if this unit's position is publicly known (on the physical table). */
  revealed?: boolean;
  onClick?: () => void;
}

/**
 * Visual layout (Group origin = unit's actual position):
 *
 *     [symbol]          ← y ≈ -28, centered horizontally
 *     <name>            ← y ≈ -28 + symbolH/2 + 2
 *      |                ← stem from just below name down to just above dot
 *      •                ← y = 0  (the dot is the unit's actual position)
 *
 * The position dot is z-ordered on top so it's always visible even if the
 * symbol overlaps another unit.
 */
export function UnitToken({
  unit,
  pixelsPerInch,
  perspectiveTeamId,
  selected = false,
  fired = false,
  revealed = false,
  onClick,
}: Props) {
  const pos = unit.getPosition();
  const x = pos.x * pixelsPerInch;
  const y = pos.y * pixelsPerInch;

  const isFriendly = unit.teamId === perspectiveTeamId;
  const dotColor = isFriendly ? theme.colors.friendly : theme.colors.hostile;

  const sidc = buildSidc(unit, perspectiveTeamId);

  const { canvas, width, height } = useMemo(() => {
    const symbol = new ms.Symbol(sidc, { size: SYMBOL_SIZE_PX });
    const c = symbol.asCanvas();
    return { canvas: c, width: c.width, height: c.height };
  }, [sidc]);

  // Anchor everything to the dot at (0, 0), working upward. This keeps the
  // dot-to-name gap fixed regardless of how tall the symbol canvas happens to
  // be (e.g. hostile diamond is taller than friendly rectangle).
  const stemBottomY = -GAP_STEM_TO_DOT;
  const stemTopY = stemBottomY - STEM_LENGTH;
  const nameBottomY = stemTopY - GAP_NAME_TO_STEM;
  const nameTopY = nameBottomY - NAME_TAG_FONT_SIZE - 1;
  const symbolBottomY = nameTopY - GAP_SYMBOL_TO_NAME;
  const symbolCenterY = symbolBottomY - height / 2;

  const ringRadius = Math.max(width, height) / 2 + 4;

  const handleClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!onClick) return;
    e.cancelBubble = true;
    onClick();
  };

  return (
    <Group x={x} y={y} onClick={handleClick} onTap={handleClick}>
      {/* Stem line — back layer so symbol & dot draw over it */}
      {stemTopY < stemBottomY && (
        <Line
          points={[0, stemTopY, 0, stemBottomY]}
          stroke={theme.colors.text}
          strokeWidth={1}
          opacity={0.55}
        />
      )}

      {/* Decoration rings encircle the symbol, not the dot */}
      {revealed && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius + 5}
          stroke={theme.colors.revealedRing}
          strokeWidth={1}
          dash={[2, 2]}
          opacity={0.5}
        />
      )}
      {fired && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius + 2}
          stroke={theme.colors.firedRing}
          strokeWidth={2.5}
        />
      )}
      {selected && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius}
          stroke={theme.colors.selectionRing}
          strokeWidth={2.5}
          dash={[4, 3]}
        />
      )}

      {/* NATO symbol */}
      <KonvaImage
        image={canvas}
        x={-width / 2}
        y={symbolCenterY - height / 2}
      />

      {/* Name tag */}
      <Text
        text={unit.name}
        x={-NAME_TAG_WIDTH / 2}
        y={nameTopY}
        width={NAME_TAG_WIDTH}
        fontSize={NAME_TAG_FONT_SIZE}
        fill={theme.colors.text}
        align="center"
      />

      {/* Position dot at the unit's actual (x, y), drawn last so it's on top.
          Colored by affiliation so it reads as a team marker, not as a NATO
          size amplifier. */}
      <Circle radius={POSITION_DOT_RADIUS} fill={dotColor} />
    </Group>
  );
}
