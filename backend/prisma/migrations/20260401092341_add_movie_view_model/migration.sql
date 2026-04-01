-- CreateTable
CREATE TABLE "MovieView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovieView_userId_movieId_key" ON "MovieView"("userId", "movieId");

-- AddForeignKey
ALTER TABLE "MovieView" ADD CONSTRAINT "MovieView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieView" ADD CONSTRAINT "MovieView_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
