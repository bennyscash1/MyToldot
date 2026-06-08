import 'server-only';

import { buildBipartiteGraph } from '@/features/family-tree/lib/buildBipartiteGraph';
import { generateStructuredJson } from '@/server/lib/gemini';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';

import { posterBioDepth, posterBioDepthLabel, type PosterBioDepth } from './poster-bio-depth';
import { buildFamilyRelationshipLines } from './poster-relationships';
import { headSpouseIds, personDisplayName } from './summarize';
import {
  downloadFromDesignAssets,
  objectExistsInDesignAssets,
  posterBioStoragePath,
  uploadToDesignAssets,
  ensureDesignAssetsBucket,
} from './storage-assets';
import type { PosterBioCopy, TreeLayoutPlan } from './types';

const POSTER_BIO_SYSTEM = `You are a Hebrew copywriter for printed heirloom family-tree posters.
You receive verified facts about one family. Your job is to write warm, dignified
poster-edition prose suitable for a framed print — NOT genealogy research.

Hard rules:
1. Output STRICT JSON ONLY. No markdown, no code fences, no prose outside JSON.
2. Ground every sentence in the supplied facts. Do NOT invent relatives, dates, places, or events.
3. If a fact is missing, omit it — never guess.
4. Write in Hebrew, RTL-friendly prose. Warm heirloom tone, concise, printable.
5. introParagraphs: 1-2 paragraphs about the family (from about_text facts).
6. personBios: one entry per listed person who needs prose on the poster.
7. Biography DEPTH per person (bioDepth field) — obey exactly:
   - "full": G1 row — family head and spouse(s) — write 1-3 full paragraphs each.
   - "short": G2 row — write a genuine 2-3 sentence summary. NOT the full DB text,
     NOT one long paragraph, NOT empty. Compress meaningfully.
   - Do NOT include persons marked "none" (G3+) in personBios at all.
8. Vary wording each generation epoch while preserving factual accuracy.

Return exactly:
{
  "introParagraphs": ["paragraph..."],
  "personBios": [
    { "personId": "<id>", "paragraphs": ["..."] }
  ]
}`;

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function summarizeToShort(paragraphs: string[]): string[] {
  const text = paragraphs.join(' ').trim();
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const short = sentences
    .slice(0, 3)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return short ? [short] : [];
}

function personIdsForPlan(plan: TreeLayoutPlan): string[] {
  const { primary, secondary, compact } = plan.tiers;
  return [...primary, ...secondary, ...compact];
}

function rosterMinGen(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  headId: string | null | undefined,
  plan: TreeLayoutPlan | undefined,
): number {
  if (!headId || !plan) return 0;
  const ids = personIdsForPlan(plan);
  const genById = new Map<string, number>();
  try {
    const graph = buildBipartiteGraph(persons, relationships, headId);
    for (const node of graph.nodes) {
      if (node.kind === 'person') genById.set(node.id, node.gen);
    }
  } catch {
    return 0;
  }
  const gens = ids.map((id) => genById.get(id) ?? 0);
  return gens.length > 0 ? Math.min(...gens) : 0;
}

function fallbackPersonBiosWithGen(
  roster: Array<{ person: PersonRow; gen: number }>,
  minGen: number,
  headId: string,
  spouses: Set<string>,
  head: PersonRow | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { person, gen } of roster) {
    const depth = posterBioDepth(person.id, gen, minGen, headId, spouses);
    if (depth === 'none') continue;
    if (depth === 'full') {
      const paras = splitParagraphs(head?.bio ?? person.bio);
      if (paras.length > 0) out[person.id] = paras;
      continue;
    }
    const paras = splitParagraphs(person.bio);
    const short = summarizeToShort(paras);
    if (short.length > 0) out[person.id] = short;
  }
  return out;
}

function fallbackCopy(
  aboutText: string | null,
  head: PersonRow | null,
  personBios: Record<string, string[]>,
): PosterBioCopy {
  return {
    introParagraphs: splitParagraphs(aboutText),
    headBioParagraphs: personBios[head?.id ?? ''] ?? splitParagraphs(head?.bio ?? null),
    personBios,
    usedAiCopy: false,
  };
}

function coercePersonBios(parsed: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!parsed || typeof parsed !== 'object') return out;
  const list = (parsed as { personBios?: unknown }).personBios;
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { personId?: unknown; paragraphs?: unknown };
    if (typeof row.personId !== 'string' || !row.personId.trim()) continue;
    const paragraphs = Array.isArray(row.paragraphs)
      ? row.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    if (paragraphs.length > 0) out[row.personId] = paragraphs;
  }
  return out;
}

function coercePosterBio(parsed: unknown, headId: string | null): PosterBioCopy | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const intro = Array.isArray(o.introParagraphs)
    ? o.introParagraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];
  let personBios = coercePersonBios(parsed);

  if (Object.keys(personBios).length === 0) {
    const legacyHead = Array.isArray(o.headBioParagraphs)
      ? o.headBioParagraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    if (headId && legacyHead.length > 0) personBios = { [headId]: legacyHead };
  }

  if (intro.length === 0 && Object.keys(personBios).length === 0) return null;

  const headBioParagraphs = headId ? (personBios[headId] ?? []) : [];
  return { introParagraphs: intro, headBioParagraphs, personBios, usedAiCopy: true };
}

function formatYear(d: Date | string | null): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return String(date.getUTCFullYear());
}

function buildPersonRoster(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  headId: string,
  plan: TreeLayoutPlan,
): Array<{ person: PersonRow; gen: number; depth: PosterBioDepth }> {
  const ids = new Set(personIdsForPlan(plan));
  const genById = new Map<string, number>();
  try {
    const graph = buildBipartiteGraph(persons, relationships, headId);
    for (const node of graph.nodes) {
      if (node.kind === 'person') genById.set(node.id, node.gen);
    }
  } catch {
    // non-fatal
  }
  const spouses = headSpouseIds(headId, relationships);
  const planGens = [...ids].map((id) => genById.get(id) ?? 0);
  const minGen = planGens.length > 0 ? Math.min(...planGens) : 0;
  const personById = new Map(persons.map((p) => [p.id, p]));
  const roster: Array<{ person: PersonRow; gen: number; depth: PosterBioDepth }> = [];

  for (const id of ids) {
    const person = personById.get(id);
    if (!person) continue;
    const gen = genById.get(id) ?? 0;
    const depth = posterBioDepth(id, gen, minGen, headId, spouses);
    if (depth === 'none') continue;
    roster.push({ person, gen, depth });
  }
  return roster;
}

/**
 * Ensure poster-edition biography exists for this generation epoch.
 * Cached in design-assets; falls back to raw DB text on any failure.
 */
export async function ensurePosterBio(params: {
  baseStyleId: string;
  treeId: string;
  epoch: string;
  treeName: string;
  aboutText: string | null;
  head: PersonRow | null;
  persons?: PersonRow[];
  relationships?: RelationshipRow[];
  headId?: string | null;
  plan?: TreeLayoutPlan;
}): Promise<PosterBioCopy> {
  const {
    baseStyleId,
    treeId,
    epoch,
    treeName,
    aboutText,
    head,
    persons = [],
    relationships = [],
    headId,
    plan,
  } = params;
  const storagePath = posterBioStoragePath(baseStyleId, treeId, epoch);

  const roster =
    headId && plan
      ? buildPersonRoster(persons, relationships, headId, plan)
      : head
        ? [{ person: head, gen: 0, depth: 'full' as PosterBioDepth }]
        : [];

  const spouses = headId ? headSpouseIds(headId, relationships) : new Set<string>();
  const minGen = rosterMinGen(persons, relationships, headId, plan);

  const emptyFallback = fallbackCopy(
    aboutText,
    head,
    fallbackPersonBiosWithGen(
      roster.map((r) => ({ person: r.person, gen: r.gen })),
      minGen,
      headId ?? '',
      spouses,
      head,
    ),
  );

  if (await objectExistsInDesignAssets(storagePath)) {
    const raw = await downloadFromDesignAssets(storagePath);
    if (raw) {
      try {
        const cached = coercePosterBio(JSON.parse(raw), headId ?? null);
        if (cached) return cached;
      } catch {
        // fall through to regenerate or fallback
      }
    }
  }

  const hasSource =
    Boolean(aboutText?.trim()) ||
    roster.some((r) => Boolean(r.person.bio?.trim())) ||
    head != null;
  if (!hasSource || !headId || !plan) return emptyFallback;

  const facts: string[] = [`שם העץ: ${treeName}`, `מזהה דור עיצוב (לגיוון ניסוח): g${epoch}`];
  if (aboutText?.trim()) facts.push(`תיאור משפחתי (עובדות): ${aboutText.trim()}`);

  facts.push('', 'אנשים הזקוקים לטקסט בפוסטר (לפי עומק ביוגרפיה):');
  for (const { person, gen, depth } of roster) {
    const lines = [
      `• id: ${person.id}`,
      `  שם: ${personDisplayName(person)}`,
      `  דור יחסי לראש (gen): ${gen}`,
      `  תווית פוסטר: G${gen - minGen + 1}`,
      `  עומק נדרש: ${posterBioDepthLabel(depth)}`,
    ];
    const by = formatYear(person.birth_date);
    const dy = formatYear(person.death_date);
    if (by) lines.push(`  שנת לידה: ${by}`);
    if (dy) lines.push(`  שנת פטירה: ${dy}`);
    if (person.birth_place?.trim()) lines.push(`  מקום לידה: ${person.birth_place.trim()}`);
    if (person.bio?.trim()) lines.push(`  ביוגרפיה קיימת (מקור): ${person.bio.trim()}`);
    facts.push(lines.join('\n'));
  }

  try {
    const graph = buildBipartiteGraph(persons, relationships, headId);
    const personById = new Map(persons.map((p) => [p.id, p]));
    const relLines = buildFamilyRelationshipLines(graph, headId, personById);
    if (relLines.length > 0) {
      facts.push('', 'קשרי משפחה מאומתים (מהעץ):');
      facts.push(...relLines.map((l) => `  • ${l}`));
    }
  } catch {
    // non-fatal
  }

  const userText = [
    'כתוב גרסת פוסטר חדשה לדפוס מהעובדות הבאות בלבד.',
    'הקפד על עומק הביוגרפיה לכל אדם כפי שמסומן (מלאה / 2-3 משפטים / אל תכלול).',
    '',
    facts.join('\n'),
    '',
    'החזר JSON בלבד לפי המבנה שבהוראות המערכת.',
  ].join('\n');

  try {
    const result = await generateStructuredJson({
      systemInstruction: POSTER_BIO_SYSTEM,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      maxOutputTokens: 8192,
      timeoutMs: 45_000,
    });
    const copy = coercePosterBio(result.parsed, headId);
    if (copy) {
      try {
        await ensureDesignAssetsBucket();
        await uploadToDesignAssets({
          path: storagePath,
          body: Buffer.from(JSON.stringify(copy), 'utf8'),
          contentType: 'application/json',
          upsert: true,
        });
      } catch {
        // cache write failure is non-fatal
      }
      return copy;
    }
  } catch {
    // fall through
  }

  return emptyFallback;
}
