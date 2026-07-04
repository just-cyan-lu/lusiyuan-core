import type { FastifyInstance } from "fastify";
import { env } from "../utils/env.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { voiceCacheService } from "./voice-cache.service.js";
import type { VoicePlaybackContext, VoiceStreamEmitter } from "./voice.types.js";

function routeError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function ssePayload(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function voiceContext(body: { user_id?: string; conversation_id?: string }): VoicePlaybackContext {
  if (!body.user_id?.trim()) throw routeError("user_id is required");
  if (!body.conversation_id?.trim()) throw routeError("conversation_id is required");
  return {
    userId: body.user_id,
    conversationId: body.conversation_id,
  };
}

function streamEmitter(writeEvent: (event: string, data: unknown) => void): VoiceStreamEmitter {
  return {
    start: (event) => writeEvent("voice_start", event),
    chunk: (event) => writeEvent("voice_chunk", event),
    done: (event) => writeEvent("voice_done", event),
    error: (event) => writeEvent("voice_error", event),
  };
}

export async function voiceRoute(app: FastifyInstance): Promise<void> {
  app.get("/v1/voice/config", async (_request, reply) => {
    return reply.send({
      asr: {
        enabled: runtimeConfig.VOICE_ASR_ENABLED,
        provider: runtimeConfig.VOICE_ASR_PROVIDER,
        language: runtimeConfig.VOICE_ASR_LANGUAGE,
        max_duration_seconds: runtimeConfig.VOICE_ASR_MAX_DURATION_SECONDS,
        auto_silence_ms: runtimeConfig.VOICE_ASR_AUTO_SILENCE_MS,
      },
      tts: {
        enabled: runtimeConfig.VOICE_TTS_ENABLED,
      },
    });
  });

  app.post("/v1/voice/messages/:messageId/play", async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const body = (request.body ?? {}) as { user_id?: string; conversation_id?: string };
    const context = voiceContext(body);

    const controller = new AbortController();
    const cancel = () => controller.abort(new Error("client disconnected"));
    request.raw.on("aborted", cancel);

    reply.hijack();
    const response = reply.raw;
    let closed = false;
    response.on("close", () => {
      closed = true;
      cancel();
    });

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": env.WEB_ORIGIN,
      Vary: "Origin",
    });

    const writeEvent = (event: string, data: unknown) => {
      if (closed || response.destroyed) return;
      response.write(ssePayload(event, data));
    };

    try {
      await voiceCacheService.streamMessageSpeech({
        messageId,
        context,
        signal: controller.signal,
        emit: streamEmitter(writeEvent),
      });
    } catch (error) {
      writeEvent("voice_error", {
        message_id: messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      request.raw.off("aborted", cancel);
      if (!closed && !response.destroyed) response.end();
    }
  });

  app.get("/v1/voice/audio/:cacheKey", async (request, reply) => {
    const { cacheKey } = request.params as { cacheKey: string };
    const query = request.query as { user_id?: string; conversation_id?: string };
    const result = await voiceCacheService.getAudioReadStream({
      cacheKey,
      context: voiceContext(query),
    });
    return reply
      .type(result.mimeType)
      .header("Content-Length", String(result.byteSize))
      .send(result.stream);
  });
}
