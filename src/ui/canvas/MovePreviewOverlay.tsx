import { Circle, Group, Line, Rect, Text } from "react-konva";
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

/**
 * Minimum on-stage segment length (stage px) below which a per-segment pill
 * is omitted. Below this the pill would crowd the segment endpoints; the
 * cursor pill (Display 1) still carries the cumulative total regardless.
 */
const PER_SEGMENT_PILL_MIN_PX = 40;

const WAYPOINT_MARKER_RADIUS = 2.5;

interface Props {
  unit: Unit;
  origin: Point;
  /** Intermediate waypoints in order, ghost → wp₀ → wp₁ → … → cursor. */
  waypoints: readonly Point[];
  cursor: Point;
  perspectiveTeamId: TeamId;
}

/**
 * Visual overlay rendered while a Move-phase unit is being previewed. See
 * feature doc §2.5 for the two distance displays:
 *   1. Cursor pill — always rendered, anchored above the live unit symbol.
 *      Shows cumulative path distance (ghost → all waypoints → cursor).
 *   2. Per-segment pill — only rendered when the path has waypoints (≥2
 *      segments). For a single-segment straight move the cursor pill already
 *      shows the only useful number.
 *
 * Renders inside `MapCanvas`'s overlay layer (listening={false}) — clicks
 * pass through to the units / map below.
 */
export function MovePreviewOverlay({
  unit,
  origin,
  waypoints,
  cursor,
  perspectiveTeamId,
}: Props) {
  const isFriendly = unit.teamId === perspectiveTeamId;
  const teamColor = isFriendly ? theme.colors.friendly : theme.colors.hostile;

  const px = theme.pixelsPerInch;

  // Full path through every anchor point, including the live cursor at the
  // end. Used both for the dashed line geometry and for per-segment maths.
  const pathInches: Point[] = [origin, ...waypoints, cursor];
  const pathPx = pathInches.map((p) => ({ x: p.x * px, y: p.y * px }));

  const flatLinePoints = pathPx.flatMap((p) => [p.x, p.y]);

  let cumulativeInches = 0;
  for (let i = 1; i < pathInches.length; i++) {
    const a = pathInches[i - 1]!;
    const b = pathInches[i]!;
    cumulativeInches += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const totalLabel = `${cumulativeInches.toFixed(1)}"`;
  const totalPillSize = measurePill(totalLabel);

  // Cursor pill: always above the live unit symbol, regardless of direction.
  const cursorPx = pathPx[pathPx.length - 1]!;
  const cursorPillX = cursorPx.x - totalPillSize.width / 2;
  const cursorPillY = cursorPx.y - CURSOR_PILL_OFFSET_ABOVE_DOT - totalPillSize.height;

  const showSegmentPills = waypoints.length > 0;

  return (
    <Group>
      <Line
        points={flatLinePoints}
        stroke={teamColor}
        strokeWidth={LINE_WIDTH}
        dash={DASH_PATTERN}
      />

      {/* Waypoint markers — small filled dots at each intermediate waypoint */}
      {waypoints.map((w, i) => (
        <Circle
          key={i}
          x={w.x * px}
          y={w.y * px}
          radius={WAYPOINT_MARKER_RADIUS}
          fill={teamColor}
        />
      ))}

      {/* Per-segment pills (only when there are waypoints — see §2.5 Display 2) */}
      {showSegmentPills &&
        pathPx.slice(0, -1).map((from, i) => {
          const to = pathPx[i + 1]!;
          const segPxLength = Math.hypot(to.x - from.x, to.y - from.y);
          if (segPxLength < PER_SEGMENT_PILL_MIN_PX) return null;
          const a = pathInches[i]!;
          const b = pathInches[i + 1]!;
          const segLabel = `${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)}"`;
          const segPillSize = measurePill(segLabel);
          return (
            <DistanceLabel
              key={i}
              x={(from.x + to.x) / 2 - segPillSize.width / 2}
              y={(from.y + to.y) / 2 - segPillSize.height / 2}
              width={segPillSize.width}
              height={segPillSize.height}
              text={segLabel}
              color={teamColor}
            />
          );
        })}

      <UnitToken
        unit={unit}
        pixelsPerInch={px}
        perspectiveTeamId={perspectiveTeamId}
        positionOverride={cursor}
      />

      <DistanceLabel
        x={cursorPillX}
        y={cursorPillY}
        width={totalPillSize.width}
        height={totalPillSize.height}
        text={totalLabel}
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
 * and team-color text. The opaque white fill is what makes a per-segment
 * pill "interrupt" the dashed line beneath it.
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
