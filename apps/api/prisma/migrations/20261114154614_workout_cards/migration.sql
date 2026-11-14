-- CreateTable
CREATE TABLE "WorkoutCardTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "avoid" TEXT NOT NULL DEFAULT '',
    "doneAt" TIMESTAMP(3),
    "completedMoves" INTEGER,
    "totalMoves" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutCardTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutCardTask_userId_date_idx" ON "WorkoutCardTask"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCardTask_userId_cardId_date_key" ON "WorkoutCardTask"("userId", "cardId", "date");

-- AddForeignKey
ALTER TABLE "WorkoutCardTask" ADD CONSTRAINT "WorkoutCardTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
