import { Group, Line, Rect, Text } from "react-konva";
import type { Point, TeamId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { theme } from "../theme.js";
import { UnitToken } from "./UnitToken.js";

const DASH_PATTERN = [6, 4];
const LINE_WIDTH = 1.5;

const PILL_PADDING_X = 5;
const PILL_PADDING_Y = 3;
const PILL_FONT_SIZE = 10;
const PILL_BORDER_WIDTH = 1;
const PILL_RADIUS = 3;

/**
 * Vertical clearance (stage pixels) between the unit's position dot and the
 * bottom edge of the cursor pill. Tuned so the pill sits above the tallest
 * unit symbol (hostile diamond is ~28 px tall + stem + name ≈ 50 total).
 */
const CURSOR_PILL_OFFSET_ABOVE_DOT = 56;

interface Props {
  unit: Unit;
  origin: Point;
  cursor: Point;
  perspectiveTeamId: TeamId;
}

/**
 * Visual overlay rendered while a Move-phase unit is being previewed. Renders
 * the dashed line from ghost to cursor, the live unit at the cursor, and a
 * cursor pill above the live symbol showing total distance (§2.5 Display 1).
 *
 * Per-segment pills (§2.5 Display 2) are intentionally not rendered for the
 * straight-line case — they'll be reintroduced for waypoint paths where
 * per-segment distance is genuinely useful.
 *
 * This component renders inside `MapCanvas`'s overlay layer, which has
 * `listening={false}` — clicks pass through to the units / map below.
 */
export function MovePreviewOverlay({ unit, origin, cursor, perspectiveTeamId }: Props) {
  const isFriendly = unit.teamId === perspectiveTeamId;
  const teamColor = isFriendly ? theme.colors.friendly : theme.colors.hostile;

  const px = theme.pixelsPerInch;
  const originPx = { x: origin.x * px, y: origin.y * px };
  const cursorPx = { x: cursor.x * px, y: cursor.y * px };

  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  const distanceInches = Math.sqrt(dx * dx + dy * dy);
  const distanceLabel = `${distanceInches.toFixed(1)}"`;

  const pillSize = measurePill(distanceLabel);
  const cursorPillX = cursorPx.x - pillSize.width / 2;
  const cursorPillY = cursorPx.y - CURSOR_PILL_OFFSET_ABOVE_DOT - pillSize.height;

  return (
    <Group>
      <Line
        points={[originPx.x, originPx.y, cursorPx.x, cursorPx.y]}
        stroke={teamColor}
        strokeWidth={LINE_WIDTH}
        dash={DASH_PATTERN}
      />
      <UnitToken
        unit={unit}
        pixelsPerInch={px}
        perspectiveTeamId={perspectiveTeamId}
        positionOverride={cursor}
      />
      <DistanceLabel
        x={cursorPillX}
        y={cursorPillY}
        width={pillSize.width}
        height={pillSize.height}
        text={distanceLabel}
        color={teamColor}
      />
    </Group>
  );
}

interface DistanceLabelProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

/**
 * Small distance "pill": white-filled rounded rect with a team-color border
 * and team-color text. Used for both displays in §2.5. The opaque white fill
 * is what makes the per-segment pill "interrupt" the dashed line beneath it.
 */
function DistanceLabel({ x, y, width, height, text, color }: DistanceLabelProps) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        width={width}
        height={height}
        fill="#fff"
        stroke={color}
        strokeWidth={PILL_BORDER_WIDTH}
        cornerRadius={PILL_RADIUS}
      />
      <Text
        x={0}
        y={PILL_PADDING_Y}
        width={width}
        text={text}
        fontSize={PILL_FONT_SIZE}
        fill={color}
        align="center"
      />
    </Group>
  );
}

function measurePill(text: string): { width: number; height: number } {
  const textWidth = text.length * PILL_FONT_SIZE * 0.6;
  return {
    width: textWidth + PILL_PADDING_X * 2,
    height: PILL_FONT_SIZE + PILL_PADDING_Y * 2,
  };
}
