-- CreateEnum
CREATE TYPE "DmPolicy" AS ENUM ('EVERYONE', 'FOLLOWING');

-- CreateEnum
CREATE TYPE "DmConversationKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "DmMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DmMemberStatus" AS ENUM ('ACTIVE', 'REQUEST', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "DmMessageKind" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'VOICE', 'POST', 'STORY_REPLY', 'SYSTEM');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "dmPolicy" "DmPolicy" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "showActivity" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DmConversation" (
    "id" TEXT NOT NULL,
    "kind" "DmConversationKind" NOT NULL,
    "directKey" TEXT,
    "title" TEXT,
    "avatarFileId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "DmMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "DmMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "lastDeliveredAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),

    CONSTRAINT "DmMember_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "DmMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" "DmMessageKind" NOT NULL,
    "text" TEXT,
    "fileId" TEXT,
    "durationMs" INTEGER,
    "replyToId" TEXT,
    "postId" TEXT,
    "storyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsentAt" TIMESTAMP(3),

    CONSTRAINT "DmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmHidden" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DmHidden_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DmConversation_directKey_key" ON "DmConversation"("directKey");

-- CreateIndex
CREATE INDEX "DmConversation_lastMessageAt_idx" ON "DmConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "DmMember_userId_status_idx" ON "DmMember"("userId", "status");

-- CreateIndex
CREATE INDEX "DmMessage_conversationId_createdAt_idx" ON "DmMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "DmConversation" ADD CONSTRAINT "DmConversation_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMember" ADD CONSTRAINT "DmMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMember" ADD CONSTRAINT "DmMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DmMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmHidden" ADD CONSTRAINT "DmHidden_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DmMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmHidden" ADD CONSTRAINT "DmHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
