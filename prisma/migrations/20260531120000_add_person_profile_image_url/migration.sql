-- AlterTable
ALTER TABLE "persons" ADD COLUMN "profile_image_url" TEXT;

-- AlterTable: gallery external URLs
ALTER TABLE "person_photos" ADD COLUMN "image_url" TEXT;
ALTER TABLE "person_photos" ALTER COLUMN "storage_path" DROP NOT NULL;
