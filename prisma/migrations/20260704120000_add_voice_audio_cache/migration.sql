CREATE TABLE "voice_audio_caches" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "voiceProfileHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sampleRate" INTEGER NOT NULL,
    "bitrate" INTEGER NOT NULL,
    "channel" INTEGER NOT NULL,
    "storageKind" TEXT NOT NULL DEFAULT 'file',
    "storagePath" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "providerTraceId" TEXT,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_audio_caches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_audio_caches_cacheKey_key" ON "voice_audio_caches"("cacheKey");
CREATE INDEX "voice_audio_caches_messageId_idx" ON "voice_audio_caches"("messageId");
CREATE INDEX "voice_audio_caches_lastPlayedAt_idx" ON "voice_audio_caches"("lastPlayedAt");
CREATE INDEX "voice_audio_caches_createdAt_idx" ON "voice_audio_caches"("createdAt");

ALTER TABLE "voice_audio_caches"
ADD CONSTRAINT "voice_audio_caches_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
