/*
  Warnings:

  - You are about to drop the column `fortytwoId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fortyTwoId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_fortytwoId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "fortytwoId",
ADD COLUMN     "fortyTwoId" TEXT;

-- CreateTable
CREATE TABLE "Movie" (
    "id" TEXT NOT NULL,
    "imdbId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "runtime" INTEGER NOT NULL DEFAULT 0,
    "genres" TEXT[],
    "summary" TEXT NOT NULL,
    "coverImageUrl" TEXT NOT NULL,
    "director" TEXT,
    "cast" TEXT[],
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Torrent" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "magnet" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "seeds" INTEGER NOT NULL DEFAULT 0,
    "peers" INTEGER NOT NULL DEFAULT 0,
    "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "filePath" TEXT,
    "movieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Torrent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movie_imdbId_key" ON "Movie"("imdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Torrent_hash_key" ON "Torrent"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "User_fortyTwoId_key" ON "User"("fortyTwoId");

-- AddForeignKey
ALTER TABLE "Torrent" ADD CONSTRAINT "Torrent_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
