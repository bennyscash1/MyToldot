-- CreateTable
CREATE TABLE "person_photos" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_photos_person_id_idx" ON "person_photos"("person_id");

-- CreateIndex
CREATE INDEX "person_photos_tree_id_idx" ON "person_photos"("tree_id");

-- AddForeignKey
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
