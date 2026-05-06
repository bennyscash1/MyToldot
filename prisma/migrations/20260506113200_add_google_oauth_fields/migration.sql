-- GOOGLE AUTH ADDED
-- Add provider metadata fields to support manual/google account unification.
ALTER TABLE "users"
ADD COLUMN "googleId" TEXT,
ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
