-- CreateEnum
CREATE TYPE "GymLessonKind" AS ENUM ('GROUP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GymLessonStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GymBookingStatus" AS ENUM ('BOOKED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "GymLesson" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "kind" "GymLessonKind" NOT NULL,
    "title" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "seriesId" TEXT,
    "status" "GymLessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymBooking" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "GymBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "membershipId" TEXT,
    "deducted" BOOLEAN NOT NULL DEFAULT false,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymSessionLog" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "bookingId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymTask" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueDate" DATE,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymShift" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "GymShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GymLesson_gymId_date_idx" ON "GymLesson"("gymId", "date");

-- CreateIndex
CREATE INDEX "GymLesson_trainerId_date_idx" ON "GymLesson"("trainerId", "date");

-- CreateIndex
CREATE INDEX "GymBooking_memberId_idx" ON "GymBooking"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "GymBooking_lessonId_memberId_key" ON "GymBooking"("lessonId", "memberId");

-- CreateIndex
CREATE INDEX "GymSessionLog_membershipId_createdAt_idx" ON "GymSessionLog"("membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "GymTask_gymId_doneAt_idx" ON "GymTask"("gymId", "doneAt");

-- CreateIndex
CREATE INDEX "GymTask_assigneeId_doneAt_idx" ON "GymTask"("assigneeId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "GymShift_gymId_userId_weekday_key" ON "GymShift"("gymId", "userId", "weekday");

-- AddForeignKey
ALTER TABLE "GymBooking" ADD CONSTRAINT "GymBooking_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "GymLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
