/**
 * Compute the name a cloned unit should take.
 *
 * Strategy: if `sourceName` ends in a trailing integer, increment it; else
 * append " 2". Then keep incrementing until the result doesn't collide with
 * any name in `existingNames`. Behavior is purely textual — no awareness of
 * unit type or faction.
 *
 * Examples (no collisions):
 *   "Alpha"               -> "Alpha 2"
 *   "Alpha 2"             -> "Alpha 3"
 *   "M4 Tank Platoon 7"   -> "M4 Tank Platoon 8"
 *   "I-3"                 -> "I-4"
 *   "X-1A"                -> "X-1A 2"  (the trailing token isn't a number)
 *
 * Collisions skip the busy values, so cloning "Alpha 2" when "Alpha 3"
 * already exists yields "Alpha 4". See docs/features/deployment-stop-gap.md
 * §2.4 / §4 decision 6.
 */
export function nextCloneName(
  sourceName: string,
  existingNames: Iterable<string>,
): string {
  const taken = new Set(existingNames);
  // Match a final integer, optionally preceded by a separator (space or "-")
  // that we keep so "I-3" -> "I-4", "Alpha 2" -> "Alpha 3".
  const match = sourceName.match(/^(.*?)([ -])(\d+)$/);
  let prefix: string;
  let separator: string;
  let next: number;
  if (match) {
    prefix = match[1]!;
    separator = match[2]!;
    next = parseInt(match[3]!, 10) + 1;
  } else {
    prefix = sourceName;
    separator = " ";
    next = 2;
  }
  while (taken.has(`${prefix}${separator}${next}`)) {
    next += 1;
  }
  return `${prefix}${separator}${next}`;
}
