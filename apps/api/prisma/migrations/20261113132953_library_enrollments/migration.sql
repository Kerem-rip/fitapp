-- CreateEnum
CREATE TYPE "LibraryEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'LEFT');

-- CreateTable
CREATE TABLE "LibraryEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "status" "LibraryEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LibraryEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCompletion" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryEnrollment_userId_status_idx" ON "LibraryEnrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCompletion_enrollmentId_dayIndex_stepIndex_key" ON "LibraryCompletion"("enrollmentId", "dayIndex", "stepIndex");

-- CreateIndex
CREATE INDEX "LibraryTask_userId_date_idx" ON "LibraryTask"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTask_userId_itemId_date_key" ON "LibraryTask"("userId", "itemId", "date");

-- AddForeignKey
ALTER TABLE "LibraryEnrollment" ADD CONSTRAINT "LibraryEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCompletion" ADD CONSTRAINT "LibraryCompletion_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LibraryEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryTask" ADD CONSTRAINT "LibraryTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
