-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "externalMessageId" TEXT;

-- CreateTable
CREATE TABLE "ChannelEvent" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalEventId" TEXT,
    "externalUserId" TEXT,
    "externalMessageId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelEvent_channel_idx" ON "ChannelEvent"("channel");

-- CreateIndex
CREATE INDEX "ChannelEvent_externalEventId_idx" ON "ChannelEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "ChannelEvent_externalMessageId_idx" ON "ChannelEvent"("externalMessageId");

-- CreateIndex
CREATE INDEX "Message_externalMessageId_idx" ON "Message"("externalMessageId");
