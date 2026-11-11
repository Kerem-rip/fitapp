-- CreateEnum
CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "changeNote" TEXT,
    "basedOnNumber" INTEGER,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "acknowledged" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "optionIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionPlan_professionalId_clientId_key" ON "NutritionPlan"("professionalId", "clientId");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_status_idx" ON "PlanVersion"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_number_key" ON "PlanVersion"("planId", "number");

-- CreateIndex
CREATE INDEX "PlanEvent_planId_createdAt_idx" ON "PlanEvent"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanChoice_planId_date_idx" ON "PlanChoice"("planId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanChoice_userId_planId_date_mealId_key" ON "PlanChoice"("userId", "planId", "date", "mealId");

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChoice" ADD CONSTRAINT "PlanChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChoice" ADD CONSTRAINT "PlanChoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
