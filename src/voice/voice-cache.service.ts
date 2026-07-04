import { createHash } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { env } from "../utils/env.js";
import { minimaxTtsService } from "./minimax-tts.service.js";
import type {
  TtsVoiceProfile,
  VoicePlaybackContext,
  VoiceStreamEmitter,
} from "./voice.types.js";
import type { Message, VoiceAudioCache } from "@prisma/client";

type PlayableMessage = Message & {
  conversation: {
    externalConversationId: string;
    user: {
      externalId: string;
    };
  };
};

type AudioReadResult = {
  stream: ReadStream;
  mimeType: string;
  byteSize: number;
};

const generationTasks = new Map<string, Promise<VoiceAudioCache>>();

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  ));
}

function currentProfile(): TtsVoiceProfile {
  const endpoint = normalizedTtsEndpoint(runtimeConfig.VOICE_TTS_WS_ENDPOINT);
  return {
    provider: "minimax",
    endpoint,
    model: runtimeConfig.VOICE_TTS_MODEL,
    voiceId: runtimeConfig.VOICE_TTS_VOICE_ID,
    languageBoost: runtimeConfig.VOICE_TTS_LANGUAGE_BOOST,
    speed: runtimeConfig.VOICE_TTS_SPEED,
    vol: runtimeConfig.VOICE_TTS_VOL,
    pitch: runtimeConfig.VOICE_TTS_PITCH,
    sampleRate: runtimeConfig.VOICE_TTS_SAMPLE_RATE,
    bitrate: runtimeConfig.VOICE_TTS_BITRATE,
    format: runtimeConfig.VOICE_TTS_FORMAT,
    channel: 1,
  };
}

function normalizedTtsEndpoint(configuredEndpoint: string): string {
  try {
    const configured = new URL(configuredEndpoint);
    const base = env.MINIMAX_BASE_URL ? new URL(env.MINIMAX_BASE_URL) : null;
    if (
      configured.hostname === "api.minimax.io" &&
      base?.hostname === "api.minimaxi.com"
    ) {
      return "wss://api.minimaxi.com/ws/v1/t2a_v2";
    }
  } catch {
    return configuredEndpoint;
  }
  return configuredEndpoint;
}

function mimeTypeForFormat(format: string): string {
  return format === "mp3" ? "audio/mpeg" : `audio/${format}`;
}

function cacheRelativePath(cacheKey: string, format: string, date = new Date()): string {
  const month = date.toISOString().slice(0, 7);
  return path.join("data", "voice-cache", month, `${cacheKey}.${format}`);
}

function absoluteStoragePath(storagePath: string): string {
  return path.isAbsolute(storagePath)
    ? storagePath
    : path.join(process.cwd(), storagePath);
}

function audioUrl(cacheKey: string, context: VoicePlaybackContext): string {
  const params = new URLSearchParams({
    user_id: context.userId,
    conversation_id: context.conversationId,
  });
  return `/v1/voice/audio/${encodeURIComponent(cacheKey)}?${params.toString()}`;
}

function cacheShape(input: {
  message: Message;
  profile: TtsVoiceProfile;
}) {
  const textHash = sha256(input.message.content);
  const voiceProfileHash = sha256(stableJson({
    provider: input.profile.provider,
    model: input.profile.model,
    voiceId: input.profile.voiceId,
    languageBoost: input.profile.languageBoost,
    speed: input.profile.speed,
    vol: input.profile.vol,
    pitch: input.profile.pitch,
    sampleRate: input.profile.sampleRate,
    bitrate: input.profile.bitrate,
    format: input.profile.format,
    channel: input.profile.channel,
  }));
  const cacheKey = sha256(`${input.message.id}:${textHash}:${voiceProfileHash}`);
  return { cacheKey, textHash, voiceProfileHash };
}

async function fileExists(storagePath: string): Promise<boolean> {
  try {
    const info = await stat(absoluteStoragePath(storagePath));
    return info.isFile();
  } catch {
    return false;
  }
}

export class VoiceCacheService {
  async streamMessageSpeech(input: {
    messageId: string;
    context: VoicePlaybackContext;
    signal?: AbortSignal;
    emit: VoiceStreamEmitter;
  }): Promise<void> {
    if (!runtimeConfig.VOICE_TTS_ENABLED) {
      await input.emit.error({
        message_id: input.messageId,
        error: "TTS is disabled",
      });
      return;
    }

    const message = await this.getPlayableMessage(input.messageId, input.context);
    const profile = currentProfile();
    const shape = cacheShape({ message, profile });
    const mimeType = mimeTypeForFormat(profile.format);

    const existing = await prisma.voiceAudioCache.findUnique({
      where: { cacheKey: shape.cacheKey },
    });
    if (existing && existing.status === "ready" && await fileExists(existing.storagePath)) {
      const touched = await this.markPlayed(existing.id);
      await input.emit.done({
        message_id: message.id,
        cache_key: touched.cacheKey,
        audio_url: audioUrl(touched.cacheKey, input.context),
        mime_type: touched.mimeType,
        byte_size: touched.byteSize,
        duration_ms: touched.durationMs ?? undefined,
        cached: true,
      });
      return;
    }
    if (existing) {
      await prisma.voiceAudioCache.delete({ where: { id: existing.id } }).catch(() => undefined);
    }

    await input.emit.start({
      message_id: message.id,
      cache_key: shape.cacheKey,
      sequence: 0,
      mime_type: mimeType,
      format: profile.format,
    });

    const running = generationTasks.get(shape.cacheKey);
    if (running) {
      const generated = await running;
      const touched = await this.markPlayed(generated.id);
      await input.emit.done({
        message_id: message.id,
        cache_key: touched.cacheKey,
        audio_url: audioUrl(touched.cacheKey, input.context),
        mime_type: touched.mimeType,
        byte_size: touched.byteSize,
        duration_ms: touched.durationMs ?? undefined,
        cached: true,
      });
      return;
    }

    const task = this.generateAndStore({
      message,
      profile,
      shape,
      mimeType,
      signal: input.signal,
      emit: input.emit,
    });
    generationTasks.set(shape.cacheKey, task);
    try {
      const generated = await task;
      await input.emit.done({
        message_id: message.id,
        cache_key: generated.cacheKey,
        audio_url: audioUrl(generated.cacheKey, input.context),
        mime_type: generated.mimeType,
        byte_size: generated.byteSize,
        duration_ms: generated.durationMs ?? undefined,
        cached: false,
      });
    } finally {
      generationTasks.delete(shape.cacheKey);
    }
  }

  async getAudioReadStream(input: {
    cacheKey: string;
    context: VoicePlaybackContext;
  }): Promise<AudioReadResult> {
    const row = await prisma.voiceAudioCache.findFirst({
      where: {
        cacheKey: input.cacheKey,
        status: "ready",
        message: {
          role: "assistant",
          conversation: {
            externalConversationId: input.context.conversationId,
            user: {
              externalId: input.context.userId,
            },
          },
        },
      },
    });
    if (!row) {
      throw new Error("Voice audio not found");
    }
    if (!(await fileExists(row.storagePath))) {
      await prisma.voiceAudioCache.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new Error("Voice audio file is missing");
    }
    const touched = await this.markPlayed(row.id);
    return {
      stream: createReadStream(absoluteStoragePath(touched.storagePath)),
      mimeType: touched.mimeType,
      byteSize: touched.byteSize,
    };
  }

  async cleanupExpired(): Promise<{ deleted: number; failed: number }> {
    const cutoff = new Date(Date.now() - runtimeConfig.VOICE_CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const rows = await prisma.voiceAudioCache.findMany({
      where: { lastPlayedAt: { lt: cutoff } },
      take: 500,
    });
    let failed = 0;
    const deletedIds: string[] = [];
    for (const row of rows) {
      try {
        await unlink(absoluteStoragePath(row.storagePath)).catch((error: unknown) => {
          const code = (error as { code?: string }).code;
          if (code !== "ENOENT") throw error;
        });
        deletedIds.push(row.id);
      } catch {
        failed++;
      }
    }
    if (deletedIds.length > 0) {
      await prisma.voiceAudioCache.deleteMany({
        where: { id: { in: deletedIds } },
      });
    }
    return { deleted: deletedIds.length, failed };
  }

  private async getPlayableMessage(
    messageId: string,
    context: VoicePlaybackContext
  ): Promise<PlayableMessage> {
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        role: "assistant",
        conversation: {
          externalConversationId: context.conversationId,
          user: {
            externalId: context.userId,
          },
        },
      },
      include: {
        conversation: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!message) {
      throw new Error("Assistant message not found");
    }
    if (!message.content.trim()) {
      throw new Error("Assistant message is empty");
    }
    return message;
  }

  private async generateAndStore(input: {
    message: Message;
    profile: TtsVoiceProfile;
    shape: ReturnType<typeof cacheShape>;
    mimeType: string;
    signal?: AbortSignal;
    emit: VoiceStreamEmitter;
  }): Promise<VoiceAudioCache> {
    let lastTraceId: string | undefined;
    const result = await minimaxTtsService.synthesize({
      text: input.message.content,
      profile: input.profile,
      signal: input.signal,
      onChunk: async (chunk, index, traceId) => {
        lastTraceId = traceId ?? lastTraceId;
        await input.emit.chunk({
          message_id: input.message.id,
          cache_key: input.shape.cacheKey,
          chunk_index: index,
          audio_base64: chunk.toString("base64"),
        });
      },
    });
    if (result.audio.length === 0) {
      throw new Error("MiniMax TTS returned empty audio");
    }
    const storagePath = cacheRelativePath(input.shape.cacheKey, input.profile.format);
    const absolutePath = absoluteStoragePath(storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, result.audio);
    const now = new Date();
    return prisma.voiceAudioCache.create({
      data: {
        messageId: input.message.id,
        cacheKey: input.shape.cacheKey,
        textHash: input.shape.textHash,
        voiceProfileHash: input.shape.voiceProfileHash,
        provider: input.profile.provider,
        model: input.profile.model,
        voiceId: input.profile.voiceId,
        format: input.profile.format,
        mimeType: input.mimeType,
        sampleRate: input.profile.sampleRate,
        bitrate: input.profile.bitrate,
        channel: input.profile.channel,
        storageKind: "file",
        storagePath,
        byteSize: result.audio.length,
        durationMs: result.durationMs,
        status: "ready",
        providerTraceId: result.traceId ?? lastTraceId,
        lastPlayedAt: now,
        playCount: 1,
      },
    });
  }

  private async markPlayed(id: string): Promise<VoiceAudioCache> {
    return prisma.voiceAudioCache.update({
      where: { id },
      data: {
        lastPlayedAt: new Date(),
        playCount: { increment: 1 },
      },
    });
  }
}

export const voiceCacheService = new VoiceCacheService();
