-- AlterTable
ALTER TABLE "File" ADD COLUMN     "purpose" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "city" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "goals" TEXT,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "sports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SportBranch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SportBranch_pkey" PRIMARY KEY ("id")
);

-- Spor branşları (sabit liste; ilgi alanı ve keşfet filtresi)
INSERT INTO "SportBranch" ("id", "name", "sortOrder") VALUES
  ('fitness', 'Fitness', 1),
  ('kosu', 'Koşu', 2),
  ('yuruyus', 'Yürüyüş', 3),
  ('bisiklet', 'Bisiklet', 4),
  ('yuzme', 'Yüzme', 5),
  ('pilates', 'Pilates', 6),
  ('yoga', 'Yoga', 7),
  ('crossfit', 'CrossFit', 8),
  ('futbol', 'Futbol', 9),
  ('basketbol', 'Basketbol', 10),
  ('voleybol', 'Voleybol', 11),
  ('tenis', 'Tenis', 12),
  ('dovus', 'Dövüş sporları', 13),
  ('boks', 'Boks', 14),
  ('dans', 'Dans', 15),
  ('tirmanis', 'Tırmanış ve doğa', 16),
  ('kayak', 'Kayak ve kış sporları', 17),
  ('beslenme', 'Sağlıklı beslenme', 18)
ON CONFLICT ("id") DO NOTHING;