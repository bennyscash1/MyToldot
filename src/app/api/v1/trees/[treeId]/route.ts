/**
 * /api/v1/trees/[treeId]
 *
 * GET   → single tree (VIEWER+ member)
 * PATCH → partial update name / description / is_public / about_images (EDITOR+)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import type { TreeAboutImageItem, TreeDto } from '@/types/api';
import { deleteProfileImage } from '@/lib/supabase/storage';
import {
  extractPathsFromAboutJson,
  normalizeAboutImages,
  parseAboutImagesFromJson,
  pathBelongsToTreeAbout,
  treeAboutImagesSchema,
} from '@/lib/tree/about-images';

const TREE_DTO_SELECT = {
  id: true,
  slug: true,
  shortCode: true,
  name: true,
  description: true,
  is_public: true,
  about_text: true,
  main_surnames: true,
  about_images: true,
  created_at: true,
  updated_at: true,
} as const;

const updateTreeBodySchema = z
  .object({
    name: z.string().max(120).optional(),
    description: z.union([z.string().max(2000), z.null()]).optional(),
    is_public: z.boolean().optional(),
    about_images: treeAboutImagesSchema.optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ treeId: string }> };

function toTreeDto(tree: {
  id: string;
  slug: string;
  shortCode: string;
  name: string;
  description: string | null;
  is_public: boolean;
  about_text: string | null;
  main_surnames: string[];
  about_images: Prisma.JsonValue | null;
  created_at: Date;
  updated_at: Date;
}): TreeDto {
  return {
    id: tree.id,
    slug: tree.slug,
    shortCode: tree.shortCode,
    name: tree.name,
    description: tree.description,
    is_public: tree.is_public,
    about_text: tree.about_text,
    main_surnames: tree.main_surnames,
    about_images: parseAboutImagesFromJson(tree.about_images),
    created_at: tree.created_at.toISOString(),
    updated_at: tree.updated_at.toISOString(),
  };
}

async function findTreeOrThrow(treeId: string) {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: TREE_DTO_SELECT,
  });
  if (!tree) throw Errors.notFound('Tree');
  return tree;
}

// GET /api/v1/trees/:treeId
export const GET = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { treeId } = await ctx.params;
  await requireTreeRole(treeId, 'VIEWER');
  const tree = await findTreeOrThrow(treeId);
  return ok<TreeDto>(toTreeDto(tree));
});

// PATCH /api/v1/trees/:treeId
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { treeId } = await ctx.params;
  await requireTreeRole(treeId, 'EDITOR');

  const prevRow = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { about_images: true },
  });
  if (!prevRow) throw Errors.notFound('Tree');

  const json = await req.json().catch(() => {
    throw Errors.badRequest('Request body must be valid JSON');
  });

  const parsed = updateTreeBodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw Errors.unprocessable(message);
  }

  const body = parsed.data;
  const data: {
    name?: string;
    description?: string | null;
    is_public?: boolean;
    about_images?: Prisma.InputJsonValue;
  } = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      throw Errors.badRequest('`name` cannot be empty');
    }
    data.name = trimmed;
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      data.description = null;
    } else {
      const trimmed = body.description.trim();
      data.description = trimmed.length === 0 ? null : trimmed;
    }
  }

  if (body.is_public !== undefined) {
    data.is_public = body.is_public;
  }

  let normalizedAbout: TreeAboutImageItem[] | undefined;
  if (body.about_images !== undefined) {
    normalizedAbout = normalizeAboutImages(body.about_images);
    for (const { path } of normalizedAbout) {
      if (!pathBelongsToTreeAbout(treeId, path)) {
        throw Errors.badRequest(
          'Each image path must be under this tree’s about folder.',
        );
      }
    }
    data.about_images = normalizedAbout as unknown as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    const current = await findTreeOrThrow(treeId);
    return ok<TreeDto>(toTreeDto(current));
  }

  const updated = await prisma.tree.update({
    where: { id: treeId },
    data,
    select: TREE_DTO_SELECT,
  });

  if (normalizedAbout !== undefined) {
    const prevPaths = extractPathsFromAboutJson(prevRow.about_images);
    const nextSet = new Set(normalizedAbout.map((i) => i.path));
    await Promise.all(
      prevPaths
        .filter(
          (p) =>
            !nextSet.has(p) && pathBelongsToTreeAbout(treeId, p),
        )
        .map((p) =>
          deleteProfileImage(p).catch((err) => {
            console.warn('[trees PATCH] delete removed about image failed', p, err);
          }),
        ),
    );
  }

  return ok<TreeDto>(toTreeDto(updated));
});
