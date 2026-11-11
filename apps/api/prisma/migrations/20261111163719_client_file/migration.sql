-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('SELF', 'PROFESSIONAL', 'DEVICE');

-- CreateEnum
CREATE TYPE "MeasurementKind" AS ENUM ('WEIGHT', 'HEIGHT', 'WAIST', 'HIP', 'CHEST', 'ARM', 'THIGH', 'BODY_FAT_PERCENT', 'MUSCLE_MASS', 'BODY_WATER_PERCENT');

-- CreateEnum
CREATE TYPE "MeasurementMethod" AS ENUM ('SCALE', 'TAPE', 'CALIPER', 'BIA', 'DEXA', 'SELF_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeQuestionType" AS ENUM ('TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTI_CHOICE');

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MeasurementKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "method" "MeasurementMethod" NOT NULL,
    "deviceName" TEXT,
    "source" "DataSource" NOT NULL,
    "enteredById" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeQuestion" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "IntakeQuestionType" NOT NULL,
    "options" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" "DataSource" NOT NULL,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalNote" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Measurement_userId_kind_takenAt_idx" ON "Measurement"("userId", "kind", "takenAt");

-- CreateIndex
CREATE INDEX "IntakeQuestion_ownerId_active_idx" ON "IntakeQuestion"("ownerId", "active");

-- CreateIndex
CREATE INDEX "IntakeAnswer_userId_questionKey_answeredAt_idx" ON "IntakeAnswer"("userId", "questionKey", "answeredAt");

-- CreateIndex
CREATE INDEX "ProfessionalNote_professionalId_clientId_createdAt_idx" ON "ProfessionalNote"("professionalId", "clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeQuestion" ADD CONSTRAINT "IntakeQuestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeAnswer" ADD CONSTRAINT "IntakeAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeAnswer" ADD CONSTRAINT "IntakeAnswer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalNote" ADD CONSTRAINT "ProfessionalNote_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalNote" ADD CONSTRAINT "ProfessionalNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
