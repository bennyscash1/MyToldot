-- CreateEnum
CREATE TYPE "TreeMemberRole" AS ENUM ('VIEWER', 'EDITOR', 'OWNER');

-- Migrate tree_members.role from Role → TreeMemberRole
ALTER TABLE "tree_members" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "tree_members"
  ALTER COLUMN "role" TYPE "TreeMemberRole"
  USING (
    CASE "role"::text
      WHEN 'VIEWER' THEN 'VIEWER'::"TreeMemberRole"
      WHEN 'EDITOR' THEN 'EDITOR'::"TreeMemberRole"
      WHEN 'ADMIN' THEN 'OWNER'::"TreeMemberRole"
      WHEN 'SUPER_ADMIN' THEN 'OWNER'::"TreeMemberRole"
      ELSE 'VIEWER'::"TreeMemberRole"
    END
  );

ALTER TABLE "tree_members" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"TreeMemberRole";

-- Drop old enum (no longer referenced)
DROP TYPE "Role";

-- Tree short codes: add, fill with unique 4-digit strings, enforce NOT NULL + unique
ALTER TABLE "trees" ADD COLUMN IF NOT EXISTS "short_code" TEXT;

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
      code := LPAD((FLOOR(RANDOM() * 10000))::INT::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM trees WHERE short_code = code);
      attempts := attempts + 1;
      IF attempts > 200 THEN
        RAISE EXCEPTION 'Failed to assign unique short_code for tree %', r.id;
      END IF;
    END LOOP;
    UPDATE trees SET short_code = code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "trees" ALTER COLUMN "short_code" SET NOT NULL;

CREATE UNIQUE INDEX "trees_short_code_key" ON "trees"("short_code");
