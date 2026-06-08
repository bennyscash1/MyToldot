import 'server-only';

import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

/** Public Supabase Storage bucket dedicated to design/style assets. */
export const DESIGN_ASSETS_BUCKET = 'design-assets';

/** Cached poster-edition biography JSON for one generation epoch. */
export function posterBioStoragePath(baseStyleId: string, treeId: string, epoch: string): string {
  return `poster-copy/${baseStyleId}--${treeId}--g${epoch}.json`;
}

/** Cached ELK tree layout JSON for one generation epoch. */
export function posterLayoutStoragePath(baseStyleId: string, treeId: string, epoch: string): string {
  return `poster-layout/${baseStyleId}--${treeId}--g${epoch}.json`;
}

/** Pointer file tracking the latest epoch for a tree + base style. */
export function latestEpochMetaPath(baseStyleId: string, treeId: string): string {
  return `meta/${baseStyleId}--${treeId}/latest-epoch.txt`;
}

/** Pointer file tracking the latest CSS frame index (1–4) for a tree + base style. */
export function latestFrameMetaPath(baseStyleId: string, treeId: string): string {
  return `meta/${baseStyleId}--${treeId}/latest-frame.txt`;
}

let bucketEnsured = false;

/** Idempotent: create the design-assets bucket as public-read if missing. */
export async function ensureDesignAssetsBucket(): Promise<void> {
  if (bucketEnsured || !isSupabaseAdminConfigured()) return;
  const admin = getSupabaseAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === DESIGN_ASSETS_BUCKET)) {
    bucketEnsured = true;
    return;
  }
  await admin.storage.createBucket(DESIGN_ASSETS_BUCKET, { public: true });
  bucketEnsured = true;
}

export async function objectExistsInDesignAssets(path: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const admin = getSupabaseAdminClient();
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
    const { data, error } = await admin.storage.from(DESIGN_ASSETS_BUCKET).list(dir, {
      search: name,
    });
    if (error) return false;
    return (data ?? []).some((f) => f.name === name);
  } catch {
    return false;
  }
}

export async function uploadToDesignAssets(params: {
  path: string;
  body: Buffer | ArrayBuffer;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(DESIGN_ASSETS_BUCKET).upload(params.path, params.body, {
    cacheControl: '3600',
    contentType: params.contentType,
    upsert: params.upsert ?? true,
  });
  if (error) throw new Error(`Design asset upload failed: ${error.message}`);
}

export async function downloadFromDesignAssets(path: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.storage.from(DESIGN_ASSETS_BUCKET).download(path);
    if (error || !data) return null;
    return await data.text();
  } catch {
    return null;
  }
}

export async function getLatestEpoch(baseStyleId: string, treeId: string): Promise<string | null> {
  const raw = await downloadFromDesignAssets(latestEpochMetaPath(baseStyleId, treeId));
  const epoch = raw?.trim();
  return epoch || null;
}

export async function setLatestEpoch(
  baseStyleId: string,
  treeId: string,
  epoch: string,
): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  await ensureDesignAssetsBucket();
  await uploadToDesignAssets({
    path: latestEpochMetaPath(baseStyleId, treeId),
    body: Buffer.from(epoch, 'utf8'),
    contentType: 'text/plain',
    upsert: true,
  });
}

export async function getLatestFrameIndex(
  baseStyleId: string,
  treeId: string,
): Promise<number | null> {
  const raw = await downloadFromDesignAssets(latestFrameMetaPath(baseStyleId, treeId));
  const n = Number.parseInt(raw?.trim() ?? '', 10);
  if (!Number.isFinite(n) || n < 1 || n > 4) return null;
  return n;
}

export async function setLatestFrameIndex(
  baseStyleId: string,
  treeId: string,
  index: number,
): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  await ensureDesignAssetsBucket();
  await uploadToDesignAssets({
    path: latestFrameMetaPath(baseStyleId, treeId),
    body: Buffer.from(String(index), 'utf8'),
    contentType: 'text/plain',
    upsert: true,
  });
}

/**
 * Resolve which epoch to use for this poster session.
 * regenerate=true → mint fresh. Otherwise reuse latest cached epoch or mint if none.
 */
export async function resolveEpoch(
  baseStyleId: string,
  treeId: string,
  regenerate: boolean,
): Promise<string> {
  if (regenerate) {
    const epoch = (await import('./variants')).mintEpoch();
    await setLatestEpoch(baseStyleId, treeId, epoch);
    return epoch;
  }
  const latest = await getLatestEpoch(baseStyleId, treeId);
  if (latest) return latest;
  const epoch = (await import('./variants')).mintEpoch();
  await setLatestEpoch(baseStyleId, treeId, epoch);
  return epoch;
}
