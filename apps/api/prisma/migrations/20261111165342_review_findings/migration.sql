-- CreateEnum
CREATE TYPE "FindingLevel" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'FOLLOW_UP', 'CLOSED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "ReviewFinding" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" "FindingLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "basis" JSONB NOT NULL,
    "categories" "SharedDataType"[],
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "decision" TEXT,
    "closedReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewFindingEvent" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFindingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewFinding_professionalId_clientId_status_idx" ON "ReviewFinding"("professionalId", "clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFinding_professionalId_clientId_fingerprint_key" ON "ReviewFinding"("professionalId", "clientId", "fingerprint");

-- CreateIndex
CREATE INDEX "ReviewFindingEvent_findingId_createdAt_idx" ON "ReviewFindingEvent"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "FollowUpTask_professionalId_status_dueAt_idx" ON "FollowUpTask"("professionalId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowUpTask_professionalId_clientId_idx" ON "FollowUpTask"("professionalId", "clientId");

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFindingEvent" ADD CONSTRAINT "ReviewFindingEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ReviewFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ReviewFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
