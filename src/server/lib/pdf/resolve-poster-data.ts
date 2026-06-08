import 'server-only';

import { prisma } from '@/lib/prisma';
import { resolveTreePageDataBySlug } from '@/server/services/tree.service';
import type { PersonRow } from '@/features/family-tree/lib/types';

import { ensurePosterBio } from './poster-bio';
import { ensurePosterTreeLayout, type PosterTreeLayoutData } from './poster-layout';
import { planTreeLayout } from './plan';
import { buildTreeSummary, resolveHeadId } from './summarize';
import { getBaseStyleId, getStyleToken } from './style-tokens';
import { borderAssetPublicUrl, borderAssetStoragePath, objectExistsInDesignAssets } from './storage-assets';
import type { TreeLayoutPlan } from './types';
import { parseVariantId } from './variants';

function decodePlan(raw: string | undefined): TreeLayoutPlan | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as TreeLayoutPlan;
    if (
      parsed?.tiers &&
      Array.isArray(parsed.tiers.primary) &&
      Array.isArray(parsed.tiers.secondary) &&
      Array.isArray(parsed.tiers.compact)
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

export interface PosterRenderData {
  treeId: string;
  treeName: string;
  locale: string;
  dir: 'rtl' | 'ltr';
  styleToken: ReturnType<typeof getStyleToken>;
  variantId: string;
  variantIndex: number;
  borderUrl: string | null;
  usedCssFallback: boolean;
  plan: TreeLayoutPlan;
  personById: Map<string, PersonRow>;
  headId: string | null;
  introParagraphs: string[];
  treeLayout: PosterTreeLayoutData | null;
  epoch: string;
  baseStyleId: string;
}

/**
 * Resolve everything /print needs to render one variant preview.
 * When planBase64 is provided (from /poster), reuse the cached tier plan.
 */
export async function resolvePosterRenderData(params: {
  shortCode: string;
  locale: string;
  variantId: string;
  planBase64?: string;
}): Promise<PosterRenderData | null> {
  const { shortCode, locale, variantId, planBase64 } = params;
  const parsed = parseVariantId(variantId);
  const baseStyleId = parsed?.baseStyleId ?? getBaseStyleId(variantId);
  const epoch = parsed?.epoch ?? '0';
  const variantIndex = parsed?.index ?? 1;

  const treeData = await resolveTreePageDataBySlug(shortCode);
  if (!treeData.treeId) return null;

  const persons = treeData.initialPersons;
  const relationships = treeData.initialRelationships;
  const headId = resolveHeadId(persons, treeData.rootPersonId);
  const personById = new Map(persons.map((p) => [p.id, p]));
  const head = headId ? personById.get(headId) ?? null : null;

  const aboutRow = await prisma.tree.findUnique({
    where: { id: treeData.treeId },
    select: { about_text: true },
  });

  const summary = buildTreeSummary(persons, relationships, headId);
  const plan =
    decodePlan(planBase64) ??
    (await planTreeLayout(summary, baseStyleId));

  const bioCopy = await ensurePosterBio({
    baseStyleId,
    treeId: treeData.treeId,
    epoch,
    treeName: treeData.treeName ?? '',
    aboutText: aboutRow?.about_text ?? null,
    head,
    persons,
    relationships,
    headId,
    plan,
  });

  const treeLayout = await ensurePosterTreeLayout({
    baseStyleId,
    treeId: treeData.treeId,
    epoch,
    persons,
    relationships,
    headId,
    plan,
    personBios: bioCopy.personBios,
  });

  const borderExists = await objectExistsInDesignAssets(borderAssetStoragePath(variantId));
  const borderUrl = borderExists ? borderAssetPublicUrl(variantId) : null;
  const usedCssFallback = !borderExists;

  return {
    treeId: treeData.treeId,
    treeName: treeData.treeName ?? '',
    locale,
    dir: locale === 'he' ? 'rtl' : 'ltr',
    styleToken: getStyleToken(baseStyleId),
    variantId,
    variantIndex,
    borderUrl,
    usedCssFallback,
    plan,
    personById,
    headId,
    introParagraphs: bioCopy.introParagraphs,
    treeLayout,
    epoch,
    baseStyleId,
  };
}

export { decodePlan };
