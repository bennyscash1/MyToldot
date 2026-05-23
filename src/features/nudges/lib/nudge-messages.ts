function hashStringToInt(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks one template deterministically based on the nudge id, so the same
 * card shows the same wording across re-renders but different cards get
 * different prompts.
 */
export function pickStableTemplate(nudgeId: string, templates: readonly string[]): string {
  if (templates.length === 0) return '';
  const idx = hashStringToInt(nudgeId) % templates.length;
  return templates[idx];
}
