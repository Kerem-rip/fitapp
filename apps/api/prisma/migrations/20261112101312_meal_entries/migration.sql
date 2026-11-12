/*
  Warnings:

  - You are about to drop the `MealLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MealLogItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MealLog" DROP CONSTRAINT "MealLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "MealLogItem" DROP CONSTRAINT "MealLogItem_foodId_fkey";

-- DropForeignKey
ALTER TABLE "MealLogItem" DROP CONSTRAINT "MealLogItem_mealLogId_fkey";

-- DropTable
DROP TABLE "MealLog";

-- DropTable
DROP TABLE "MealLogItem";

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "foodKey" TEXT,
    "name" TEXT NOT NULL,
    "portion" TEXT NOT NULL,
    "servings" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealEntry_userId_date_idx" ON "MealEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
