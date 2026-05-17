-- AlterTable
ALTER TABLE "persons" ADD COLUMN "is_deceased" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anyone with a recorded death date is marked deceased
UPDATE "persons" SET "is_deceased" = TRUE WHERE "death_date" IS NOT NULL;
