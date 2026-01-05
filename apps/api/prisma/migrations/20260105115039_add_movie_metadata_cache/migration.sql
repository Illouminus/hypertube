-- CreateTable
CREATE TABLE "MovieMetadataCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieMetadataCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovieMetadataCache_cacheKey_key" ON "MovieMetadataCache"("cacheKey");

-- CreateIndex
CREATE INDEX "MovieMetadataCache_cacheKey_idx" ON "MovieMetadataCache"("cacheKey");

-- CreateIndex
CREATE INDEX "MovieMetadataCache_expiresAt_idx" ON "MovieMetadataCache"("expiresAt");
