-- AlterEnum
ALTER TYPE "MeasurementKind" ADD VALUE 'NECK';

-- CreateTable
CREATE TABLE "CalorieProfile" (
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "sport" TEXT,
    "breastfeedingMonths" INTEGER,
    "sex" TEXT NOT NULL,
    "ageYears" INTEGER NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPercent" DOUBLE PRECISION,
    "bmr" INTEGER NOT NULL,
    "tdee" INTEGER NOT NULL,
    "targetKcal" INTEGER NOT NULL,
    "proteinG" INTEGER NOT NULL,
    "carbsG" INTEGER NOT NULL,
    "fatG" INTEGER NOT NULL,
    "waterMl" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalorieProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PremiumGrant" (
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumGrant_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RoutineItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "data" JSONB,
    "source" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineItem_userId_date_idx" ON "RoutineItem"("userId", "date");

-- CreateIndex
CREATE INDEX "TaskCheck_userId_date_idx" ON "TaskCheck"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCheck_userId_key_date_key" ON "TaskCheck"("userId", "key", "date");

-- CreateIndex
CREATE INDEX "UserEvent_userId_at_idx" ON "UserEvent"("userId", "at");

-- AddForeignKey
ALTER TABLE "CalorieProfile" ADD CONSTRAINT "CalorieProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumGrant" ADD CONSTRAINT "PremiumGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCheck" ADD CONSTRAINT "TaskCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
