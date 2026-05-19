/**
 * Ensures the `person-galleries` Supabase Storage bucket exists (public read).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- node scripts/ensure-person-galleries-bucket.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const PERSON_PHOTO_BUCKET = 'person-galleries';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    console.error('listBuckets failed:', listError.message);
    process.exit(1);
  }

  const exists = buckets?.some((b) => b.name === PERSON_PHOTO_BUCKET);
  if (exists) {
    console.log(`Bucket "${PERSON_PHOTO_BUCKET}" already exists.`);
    return;
  }

  const { error: createError } = await admin.storage.createBucket(PERSON_PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_PHOTO_BYTES,
  });

  if (createError) {
    console.error('createBucket failed:', createError.message);
    process.exit(1);
  }

  console.log(`Created public bucket "${PERSON_PHOTO_BUCKET}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
