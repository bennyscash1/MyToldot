import { z } from 'zod';

import { normalizeExternalImageUrl } from '@/lib/images/normalize-external-image-url';

export const ImageConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const ImageCandidateSchema = z.object({
  imageUrl: z.preprocess(
    (v) => (typeof v === 'string' ? normalizeExternalImageUrl(v.trim()) : v),
    z.string().url(),
  ),
  sourcePageUrl: z.string().url().optional(),
  sourceDomain: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(300).optional(),
  confidence: ImageConfidenceSchema,
});

export const ImageSearchResponseSchema = z.object({
  candidates: z.array(ImageCandidateSchema).max(16),
});

export type ImageCandidate = z.infer<typeof ImageCandidateSchema>;

export const SearchPersonImagesInputSchema = z.object({
  personId: z.string().min(1),
  searchContext: z.string().trim().max(2000).optional(),
});
