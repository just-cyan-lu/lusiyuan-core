import { WebSocket } from "undici";
import { env } from "../utils/env.js";
import type { TtsSynthesisResult, TtsVoiceProfile } from "./voice.types.js";

type JsonObject = Record<string, unknown>;

class WebSocketJsonReader {
  private queue: JsonObject[] = [];
  private waiters: Array<{
    resolve: (value: JsonObject) => void;
    reject: (error: Error) => void;
  }> = [];
  private closedError: Error | null = null;

  constructor(private readonly ws: InstanceType<typeof WebSocket>) {
    ws.addEventListener("message", (event) => {
      void this.handleMessage(event.data);
    });
    ws.addEventListener("error", (event) => {
      const message = event instanceof ErrorEvent && event.message
        ? event.message
        : "MiniMax TTS WebSocket error";
      this.rejectAll(new Error(message));
    });
    ws.addEventListener("close", () => {
      this.rejectAll(new Error("MiniMax TTS WebSocket closed"));
    });
  }

  async next(signal?: AbortSignal): Promise<JsonObject> {
    if (this.queue.length > 0) return this.queue.shift()!;
    if (this.closedError) throw this.closedError;

    return new Promise<JsonObject>((resolve, reject) => {
      const waiter = { resolve, reject };
      const cleanup = () => {
        signal?.removeEventListener("abort", onAbort);
        const index = this.waiters.indexOf(waiter);
        if (index !== -1) this.waiters.splice(index, 1);
      };
      const onAbort = () => {
        cleanup();
        reject(signal?.reason instanceof Error ? signal.reason : new Error("MiniMax TTS cancelled"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push({
        resolve: (value) => {
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      });
      if (signal?.aborted) onAbort();
    });
  }

  private async handleMessage(data: unknown): Promise<void> {
    try {
      const text = await messageDataToText(data);
      const parsed = JSON.parse(text) as JsonObject;
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(parsed);
      else this.queue.push(parsed);
    } catch (error) {
      this.rejectAll(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private rejectAll(error: Error): void {
    if (!this.closedError) this.closedError = error;
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) waiter.reject(error);
  }
}

async function messageDataToText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  if (data instanceof Blob) {
    return Buffer.from(await data.arrayBuffer()).toString("utf8");
  }
  return String(data);
}

function statusError(message: JsonObject): Error | null {
  const baseResp = message.base_resp as { status_code?: number; status_msg?: string } | undefined;
  if (!baseResp || baseResp.status_code === 0) return null;
  return new Error(baseResp.status_msg || `MiniMax TTS failed: ${baseResp.status_code}`);
}

function extractTraceId(message: JsonObject): string | undefined {
  return typeof message.trace_id === "string" ? message.trace_id : undefined;
}

function extractDurationMs(message: JsonObject): number | undefined {
  const extraInfo = message.extra_info as { audio_length?: number } | undefined;
  return typeof extraInfo?.audio_length === "number" ? extraInfo.audio_length : undefined;
}

function ensureOpen(
  ws: InstanceType<typeof WebSocket>,
  endpoint: string,
  signal?: AbortSignal
): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`MiniMax TTS WebSocket connection failed: ${endpoint}`));
    };
    const onAbort = () => {
      cleanup();
      reject(signal?.reason instanceof Error ? signal.reason : new Error("MiniMax TTS cancelled"));
    };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export class MiniMaxTtsService {
  async synthesize(input: {
    text: string;
    profile: TtsVoiceProfile;
    signal?: AbortSignal;
    onChunk?: (chunk: Buffer, index: number, traceId?: string) => void | Promise<void>;
  }): Promise<TtsSynthesisResult> {
    if (!env.MINIMAX_API_KEY) {
      throw new Error("MINIMAX_API_KEY is not configured");
    }
    if (!input.profile.voiceId.trim()) {
      throw new Error("VOICE_TTS_VOICE_ID is not configured");
    }
    if (!input.text.trim()) {
      throw new Error("TTS text is empty");
    }

    const ws = new WebSocket(input.profile.endpoint, {
      headers: {
        Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
      },
    });
    const reader = new WebSocketJsonReader(ws);
    const audioChunks: Buffer[] = [];
    let chunkIndex = 0;
    let traceId: string | undefined;
    let durationMs: number | undefined;

    try {
      await ensureOpen(ws, input.profile.endpoint, input.signal);
      const connected = await reader.next(input.signal);
      if (connected.event !== "connected_success") {
        throw statusError(connected) ?? new Error("MiniMax TTS did not return connected_success");
      }

      ws.send(JSON.stringify({
        event: "task_start",
        model: input.profile.model,
        language_boost: input.profile.languageBoost,
        voice_setting: {
          voice_id: input.profile.voiceId,
          speed: input.profile.speed,
          vol: input.profile.vol,
          pitch: input.profile.pitch,
          english_normalization: false,
        },
        audio_setting: {
          sample_rate: input.profile.sampleRate,
          bitrate: input.profile.bitrate,
          format: input.profile.format,
          channel: input.profile.channel,
        },
      }));

      const started = await reader.next(input.signal);
      if (started.event !== "task_started") {
        throw statusError(started) ?? new Error("MiniMax TTS task did not start");
      }
      traceId = extractTraceId(started);

      ws.send(JSON.stringify({
        event: "task_continue",
        text: input.text,
      }));

      for (;;) {
        const message = await reader.next(input.signal);
        const failed = statusError(message);
        if (failed) throw failed;
        if (message.event === "task_failed") {
          throw new Error("MiniMax TTS task failed");
        }
        traceId = extractTraceId(message) ?? traceId;
        durationMs = extractDurationMs(message) ?? durationMs;

        const data = message.data as { audio?: string } | undefined;
        if (data?.audio) {
          const audio = Buffer.from(data.audio, "hex");
          audioChunks.push(audio);
          await input.onChunk?.(audio, chunkIndex++, traceId);
        }
        if (message.is_final === true) break;
      }

      ws.send(JSON.stringify({ event: "task_finish" }));
      return {
        audio: Buffer.concat(audioChunks),
        traceId,
        durationMs,
      };
    } finally {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  }
}

export const minimaxTtsService = new MiniMaxTtsService();
