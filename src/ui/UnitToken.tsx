import { Circle, Group, Rect, Text } from "react-konva";
import type { Unit } from "../core/units/Unit.js";

interface Props {
  unit: Unit;
  pixelsPerInch: number;
  /** When undefined, color from team A perspective (team A = black, team B = red). */
  perspectiveTeamId?: string;
}

const FRIENDLY_COLOR = "#000";
const ENEMY_COLOR = "#c63a2f";

export function UnitToken({ unit, pixelsPerInch, perspectiveTeamId = "A" }: Props) {
  const pos = unit.getPosition();
  const x = pos.x * pixelsPerInch;
  const y = pos.y * pixelsPerInch;
  const radius = 0.5 * pixelsPerInch;
  const fill = unit.teamId === perspectiveTeamId ? FRIENDLY_COLOR : ENEMY_COLOR;

  // Tank: square token. Infantry: circle token. (Placeholder for NATO symbols.)
  return (
    <Group x={x} y={y}>
      {unit.type === "Tank" ? (
        <Rect
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          fill={fill}
        />
      ) : (
        <Circle radius={radius} fill={fill} />
      )}
      <Text
        text={unit.name}
        x={-30}
        y={radius + 2}
        width={60}
        fontSize={10}
        fill="#000"
        align="center"
      />
    </Group>
  );
}
