import 'server-only';

import { prisma } from '@/lib/prisma';
import { resolveTreePageDataBySlug } from '@/server/services/tree.service';

import { ensurePosterBio } from './poster-bio';
import { ensurePosterTreeLayout } from './poster-layout';
import { planTreeLayout } from './plan';
import { buildTreeSummary, resolveHeadId } from './summarize';
import { DEFAULT_STYLE_ID } from './style-tokens';
import { resolveEpoch } from './storage-assets';
import type { PosterBioCopy, TreeLayoutPlan } from './types';
import { buildVariantId, resolveFrameIndex } from './variants';

export interface PosterSession {
  treeId: string;
  treeName: string;
  baseStyleId: string;
  epoch: string;
  variantId: string;
  plan: TreeLayoutPlan;
  planBase64: string;
  bioCopy: PosterBioCopy;
}

/**
 * Run the full AI poster generation for one epoch: Pro tier plan (once),
 * CSS frame variant, poster-edition biography.
 */
export async function generatePosterSession(params: {
  shortCode: string;
  baseStyleId?: string;
  regenerate?: boolean;
}): Promise<PosterSession | null> {
  const baseStyleId = params.baseStyleId ?? DEFAULT_STYLE_ID;
  const treeData = await resolveTreePageDataBySlug(params.shortCode);
  if (!treeData.treeId) return null;

  const regenerate = Boolean(params.regenerate);

  const [epoch, frameIndex] = await Promise.all([
    resolveEpoch(baseStyleId, treeData.treeId, regenerate),
    resolveFrameIndex(baseStyleId, treeData.treeId, regenerate),
  ]);

  const persons = treeData.initialPersons;
  const relationships = treeData.initialRelationships;
  const headId = resolveHeadId(persons, treeData.rootPersonId);
  const head = headId ? persons.find((p) => p.id === headId) ?? null : null;

  const aboutRow = await prisma.tree.findUnique({
    where: { id: treeData.treeId },
    select: { about_text: true },
  });

  const summary = buildTreeSummary(persons, relationships, headId);
  const plan = await planTreeLayout(summary, baseStyleId);
  const planBase64 = Buffer.from(JSON.stringify(plan)).toString('base64');

  const variantId = buildVariantId(baseStyleId, treeData.treeId, epoch, frameIndex);

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

  await ensurePosterTreeLayout({
    baseStyleId,
    treeId: treeData.treeId,
    epoch,
    persons,
    relationships,
    headId,
    plan,
    personBios: bioCopy.personBios,
  });

  return {
    treeId: treeData.treeId,
    treeName: treeData.treeName ?? '',
    baseStyleId,
    epoch,
    variantId,
    plan,
    planBase64,
    bioCopy,
  };
}
