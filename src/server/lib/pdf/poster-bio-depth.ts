import 'server-only';

/** How much biography prose a person receives on the printed poster. */
export type PosterBioDepth = 'full' | 'short' | 'none';

/**
 * Bio depth aligned with poster G-badge rows (G1, G2, G3…):
 * - G1: full bio for the family head and their spouse(s) on that row
 * - G2: short 2–3 sentence summary
 * - G3+: no prose (name + dates only)
 */
export function posterBioDepth(
  personId: string,
  personGen: number,
  minGen: number,
  headId: string,
  headSpouseIds: Set<string>,
): PosterBioDepth {
  const posterGen = personGen - minGen + 1;
  if (posterGen === 1 && (personId === headId || headSpouseIds.has(personId))) {
    return 'full';
  }
  if (posterGen === 2) return 'short';
  return 'none';
}

export function posterBioDepthLabel(depth: PosterBioDepth): string {
  switch (depth) {
    case 'full':
      return 'G1 — ביוגרפיה מלאה (ראש המשפחה ובן/בת הזוג)';
    case 'short':
      return 'G2 — סיכום קצר (2–3 משפטים בלבד)';
    default:
      return 'G3 ומטה — ללא ביוגרפיה (רק שם ותאריכים בכרטיס)';
  }
}
