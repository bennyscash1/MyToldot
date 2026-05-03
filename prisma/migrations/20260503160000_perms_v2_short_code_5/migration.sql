-- ============================================================
-- Permissions v2 + 5-digit shortCodes
--
-- 1. Add EDITOR_PENDING value to TreeMemberRole.
-- 2. Drop the global RBAC columns (User.is_approved, User.access_role)
--    and the AccessRole enum. All editing rights are now per-tree only.
-- 3. Regenerate every Tree.short_code as a unique 5-digit string.
-- ============================================================

-- ── 1. Extend TreeMemberRole enum ──
ALTER TYPE "TreeMemberRole" ADD VALUE IF NOT EXISTS 'EDITOR_PENDING';

-- ── 2. Drop the global RBAC ──
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_approved";
ALTER TABLE "users" DROP COLUMN IF EXISTS "access_role";
DROP TYPE IF EXISTS "AccessRole";

-- ── 3. Regenerate all short_codes as unique 5-digit strings ──
-- We clear them first so the unique constraint cannot collide with the
-- old 4-digit codes during the loop.
UPDATE "trees" SET "short_code" = NULL;

-- short_code is currently NOT NULL; widen briefly so we can clear it,
-- then refill and tighten again. (NOT NULL was added in the previous
-- migration; we keep the unique index in place.)
ALTER TABLE "trees" ALTER COLUMN "short_code" DROP NOT NULL;

DO $$
DECLARE
  r RECORD;
  code TEXT;
  attempts INT;
BEGIN
  FOR r IN SELECT id FROM trees WHERE short_code IS NULL
  LOOP
    attempts := 0;
    LOOP
      code := LPAD((FLOOR(RANDOM() * 100000))::INT::TEXT, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM trees WHERE short_code = code);
      attempts := attempts + 1;
      IF attempts > 500 THEN
        RAISE EXCEPTION 'Failed to assign unique 5-digit short_code for tree %', r.id;
      END IF;
    END LOOP;
    UPDATE trees SET short_code = code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "trees" ALTER COLUMN "short_code" SET NOT NULL;
