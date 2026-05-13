import type { KonvaEventObject } from "konva/lib/Node";
import ms from "milsymbol";
import { useMemo } from "react";
import { Circle, Group, Image as KonvaImage, Line, Text } from "react-konva";
import type { Point, TeamId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { theme } from "../theme.js";
import { buildSidc } from "./sidc.js";

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

interface Props {
  unit: Unit;
  pixelsPerInch: number;
  perspectiveTeamId: TeamId;
  selected?: boolean;
  fired?: boolean;
  /** True if this unit's position is publicly known (on the physical table). */
  revealed?: boolean;
  /**
   * If set, the token renders at this position (in inch coords) instead of
   * `unit.getPosition()`. Used during the Move-phase live preview so the same
   * token visual can follow the cursor without mutating game state.
   */
  positionOverride?: Point;
  /** Render at reduced opacity (used for the ghost during a live preview). */
  ghosted?: boolean;
  /**
   * When true (default), the entire token visual is clickable — easier to
   * grab a unit. When false, only the position dot is clickable; the symbol,
   * name, stem, and rings pass clicks through. Strict mode is used during an
   * active move so the player doesn't accidentally re-select a different
   * unit by hovering near its symbol.
   */
  easySelect?: boolean;
  onClick?: () => void;
  /** Fired on Konva mouse enter / leave on the token. */
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
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
  positionOverride,
  ghosted = false,
  easySelect = true,
  onClick,
  onHoverEnter,
  onHoverLeave,
}: Props) {
  const pos = positionOverride ?? unit.getPosition();
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

  // In easy-select mode the whole token Group listens (decorative children
  // bubble clicks up). In strict mode every decorative child has
  // `listening={false}` so only the position dot intercepts clicks. The dot
  // always carries its own onClick + cancelBubble so it remains clickable in
  // either mode without double-firing the Group handler.
  const groupHandlers = easySelect ? { onClick: handleClick, onTap: handleClick } : {};
  const decorativeListening = easySelect;
  // Hover is independent of select mode: in strict (active-move) mode only the
  // dot listens, so hover fires when the cursor crosses the dot. That's
  // acceptable because during an active move the info menu is locked to the
  // moving unit anyway and hover is decorative.
  const hoverHandlers = {
    ...(onHoverEnter && { onMouseEnter: () => onHoverEnter() }),
    ...(onHoverLeave && { onMouseLeave: () => onHoverLeave() }),
  };

  return (
    <Group
      x={x}
      y={y}
      opacity={ghosted ? 0.3 : 1}
      {...groupHandlers}
      {...hoverHandlers}
    >
      {/* Stem line — back layer so symbol & dot draw over it */}
      {stemTopY < stemBottomY && (
        <Line
          points={[0, stemTopY, 0, stemBottomY]}
          stroke={theme.colors.text}
          strokeWidth={1}
          opacity={0.55}
          listening={decorativeListening}
        />
      )}

      {/* Decoration rings encircle the symbol, not the dot. All three rings
          are pure status indicators and non-listening — they never obstruct
          clicks on adjacent units, even when one of them happens to overlap
          a neighbouring unit's symbol. */}
      {revealed && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius + 5}
          stroke={theme.colors.revealedRing}
          strokeWidth={1}
          dash={[2, 2]}
          opacity={0.5}
          listening={false}
        />
      )}
      {fired && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius + 2}
          stroke={theme.colors.firedRing}
          strokeWidth={2.5}
          listening={false}
        />
      )}
      {selected && (
        <Circle
          y={symbolCenterY}
          radius={ringRadius}
          stroke={dotColor}
          strokeWidth={2.5}
          dash={[4, 3]}
          listening={false}
        />
      )}

      {/* NATO symbol */}
      <KonvaImage
        image={canvas}
        x={-width / 2}
        y={symbolCenterY - height / 2}
        listening={decorativeListening}
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
        listening={decorativeListening}
      />

      {/* Position dot at the unit's actual (x, y), drawn last so it's on top.
          Always listens — in strict mode it's the only clickable element. */}
      <Circle
        radius={POSITION_DOT_RADIUS}
        fill={dotColor}
        onClick={handleClick}
        onTap={handleClick}
      />
    </Group>
  );
}
