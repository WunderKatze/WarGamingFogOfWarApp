import ms from "milsymbol";
import { useMemo } from "react";
import { Group, Image as KonvaImage, Text } from "react-konva";
import type { TeamId, UnitSize, UnitType } from "../core/types.js";
import type { Unit } from "../core/units/Unit.js";

const SYMBOL_SIZE_PX = 32;

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
  /** Whose perspective drives Friend-vs-Hostile rendering. */
  perspectiveTeamId: TeamId;
}

export function UnitToken({ unit, pixelsPerInch, perspectiveTeamId }: Props) {
  const pos = unit.getPosition();
  const x = pos.x * pixelsPerInch;
  const y = pos.y * pixelsPerInch;

  const sidc = buildSidc(unit, perspectiveTeamId);

  const { canvas, width, height } = useMemo(() => {
    const symbol = new ms.Symbol(sidc, { size: SYMBOL_SIZE_PX });
    const c = symbol.asCanvas();
    return { canvas: c, width: c.width, height: c.height };
  }, [sidc]);

  return (
    <Group x={x} y={y}>
      <KonvaImage image={canvas} x={-width / 2} y={-height / 2} />
      <Text
        text={unit.name}
        x={-50}
        y={height / 2 + 2}
        width={100}
        fontSize={11}
        fill="#111"
        align="center"
      />
    </Group>
  );
}
