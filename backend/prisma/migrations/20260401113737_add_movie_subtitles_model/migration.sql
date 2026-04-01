-- CreateEnum
CREATE TYPE "SubtitleStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "MovieSubtitle" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vtt',
    "provider" TEXT,
    "providerSubtitleId" TEXT,
    "filePath" TEXT,
    "status" "SubtitleStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieSubtitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovieSubtitle_movieId_idx" ON "MovieSubtitle"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieSubtitle_movieId_languageCode_key" ON "MovieSubtitle"("movieId", "languageCode");

-- AddForeignKey
ALTER TABLE "MovieSubtitle" ADD CONSTRAINT "MovieSubtitle_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
