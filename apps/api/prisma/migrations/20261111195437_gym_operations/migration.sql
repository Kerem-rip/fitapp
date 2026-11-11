-- CreateEnum
CREATE TYPE "GymStaffRole" AS ENUM ('TRAINER', 'RECEPTION');

-- CreateEnum
CREATE TYPE "GymStaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'DECLINED', 'ENDED');

-- CreateEnum
CREATE TYPE "GymMemberStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymStaffMember" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GymStaffRole" NOT NULL,
    "status" "GymStaffStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GymStaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "sessionCount" INTEGER,
    "priceKurus" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymMember" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "status" "GymMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "sessionsTotal" INTEGER,
    "sessionsLeft" INTEGER,
    "priceKurus" INTEGER NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymPayment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "membershipId" TEXT,
    "amountKurus" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gym_ownerId_key" ON "Gym"("ownerId");

-- CreateIndex
CREATE INDEX "GymStaffMember_gymId_status_idx" ON "GymStaffMember"("gymId", "status");

-- CreateIndex
CREATE INDEX "GymStaffMember_userId_status_idx" ON "GymStaffMember"("userId", "status");

-- CreateIndex
CREATE INDEX "MembershipPlan_gymId_active_idx" ON "MembershipPlan"("gymId", "active");

-- CreateIndex
CREATE INDEX "GymMember_gymId_status_idx" ON "GymMember"("gymId", "status");

-- CreateIndex
CREATE INDEX "Membership_gymId_endDate_idx" ON "Membership"("gymId", "endDate");

-- CreateIndex
CREATE INDEX "Membership_memberId_idx" ON "Membership"("memberId");

-- CreateIndex
CREATE INDEX "GymPayment_gymId_paidAt_idx" ON "GymPayment"("gymId", "paidAt");

-- CreateIndex
CREATE INDEX "GymPayment_memberId_idx" ON "GymPayment"("memberId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymStaffMember" ADD CONSTRAINT "GymStaffMember_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymStaffMember" ADD CONSTRAINT "GymStaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMember" ADD CONSTRAINT "GymMember_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
