import { theme } from "../theme.js";

const NICE_INTERVALS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const TARGET_BAR_PX = 100;
const BAR_SLOP = 1.5; // accept a candidate that overshoots target by this factor

interface Props {
  /** Current Konva stage scale (1 = native, < 1 = zoomed out, > 1 = zoomed in). */
  scale: number;
  pixelsPerInch: number;
}

/**
 * Bottom-right scale bar showing how many inches a screen segment represents at
 * the current zoom level. Picks a "nice" interval (1/2/5/10/20/...) so the bar
 * stays readable across the zoom range.
 */
export function ScaleIndicator({ scale, pixelsPerInch }: Props) {
  const pxPerInchEffective = pixelsPerInch * scale;
  let inches = NICE_INTERVALS[0]!;
  for (const candidate of NICE_INTERVALS) {
    if (candidate * pxPerInchEffective <= TARGET_BAR_PX * BAR_SLOP) {
      inches = candidate;
    }
  }
  const barWidth = inches * pxPerInchEffective;

  return (
    <div
      style={{
        position: "absolute",
        bottom: theme.spacing.lg,
        right: theme.spacing.lg,
        background: "rgba(255,255,255,0.92)",
        border: `1px solid ${theme.colors.sidebarBorder}`,
        borderRadius: theme.radius.sm,
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
        fontSize: theme.fontSize.sm,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: barWidth,
          height: 6,
          borderLeft: `2px solid ${theme.colors.text}`,
          borderRight: `2px solid ${theme.colors.text}`,
          borderBottom: `2px solid ${theme.colors.text}`,
        }}
      />
      <div style={{ marginTop: 2, textAlign: "center" }}>
        {inches}″
      </div>
    </div>
  );
}
