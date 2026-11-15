// Trip naming: "Saturday in Dogpatch". Pure, no RN imports.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_AREA_CHARS = 22;

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = v?.trim();
    if (!t || t.length > MAX_AREA_CHARS) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/**
 * "<Weekday> in <area>" from the most common neighbourhood (district/subregion/city) across stops,
 * falling back to the most common place name. Undefined when nothing was geocoded.
 */
export function tripTitleFrom(
  startAt: number,
  areas: (string | undefined)[],
  moments: { placeName?: string }[],
): string | undefined {
  const area = mostCommon(areas) ?? mostCommon(moments.map((m) => m.placeName));
  if (!area) return undefined;
  return `${WEEKDAYS[new Date(startAt).getDay()]} in ${area}`;
}
