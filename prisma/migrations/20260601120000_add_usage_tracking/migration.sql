-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_image_usage" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "uploaded_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_image_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_daily_user_id_day_idx" ON "ai_usage_daily"("user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_user_id_day_key" ON "ai_usage_daily"("user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "tree_image_usage_tree_id_key" ON "tree_image_usage"("tree_id");

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_image_usage" ADD CONSTRAINT "tree_image_usage_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
