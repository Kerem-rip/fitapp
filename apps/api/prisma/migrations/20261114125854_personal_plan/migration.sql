-- CreateEnum
CREATE TYPE "PlanPurchaseStatus" AS ENUM ('PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PlanLogStatus" AS ENUM ('DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "PlanIntake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "screening" JSONB NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PlanPurchaseStatus" NOT NULL DEFAULT 'PAID',
    "provider" TEXT NOT NULL,
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "purchaseDay" DATE NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "previousInstanceId" TEXT,
    "generatedWeeks" INTEGER NOT NULL DEFAULT 1,
    "needsProfessional" BOOLEAN NOT NULL DEFAULT false,
    "report" JSONB,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "focus" TEXT,
    "title" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "estimatedKcal" INTEGER NOT NULL,
    "entries" JSONB NOT NULL,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntryLog" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "entryIndex" INTEGER NOT NULL,
    "status" "PlanLogStatus" NOT NULL,
    "rpe" INTEGER,
    "pain" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "painSharp" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "actualReps" INTEGER,
    "actualSeconds" INTEGER,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEntryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanIntake_userId_createdAt_idx" ON "PlanIntake"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanPurchase_userId_createdAt_idx" ON "PlanPurchase"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPurchase_userId_idempotencyKey_key" ON "PlanPurchase"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlanInstance_purchaseId_key" ON "PlanInstance"("purchaseId");

-- CreateIndex
CREATE INDEX "PlanInstance_userId_startDate_idx" ON "PlanInstance"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlanInstance_userId_sequence_key" ON "PlanInstance"("userId", "sequence");

-- CreateIndex
CREATE INDEX "PlanDay_instanceId_date_idx" ON "PlanDay"("instanceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_instanceId_dayNumber_key" ON "PlanDay"("instanceId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntryLog_instanceId_dayNumber_entryIndex_key" ON "PlanEntryLog"("instanceId", "dayNumber", "entryIndex");

-- AddForeignKey
ALTER TABLE "PlanIntake" ADD CONSTRAINT "PlanIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPurchase" ADD CONSTRAINT "PlanPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPurchase" ADD CONSTRAINT "PlanPurchase_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "PlanIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInstance" ADD CONSTRAINT "PlanInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInstance" ADD CONSTRAINT "PlanInstance_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PlanPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInstance" ADD CONSTRAINT "PlanInstance_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "PlanIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PlanInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntryLog" ADD CONSTRAINT "PlanEntryLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PlanInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
