export interface VoicePlaybackContext {
  userId: string;
  conversationId: string;
}

export interface TtsVoiceProfile {
  provider: "minimax";
  endpoint: string;
  model: string;
  voiceId: string;
  languageBoost: string;
  speed: number;
  vol: number;
  pitch: number;
  sampleRate: number;
  bitrate: number;
  format: "mp3";
  channel: 1;
}

export interface TtsChunk {
  audio: Buffer;
  index: number;
  isFinal: boolean;
  traceId?: string;
}

export interface TtsSynthesisResult {
  audio: Buffer;
  traceId?: string;
  durationMs?: number;
}

export interface VoiceStreamStartEvent {
  message_id: string;
  cache_key: string;
  sequence: number;
  mime_type: string;
  format: "mp3";
}

export interface VoiceStreamChunkEvent {
  message_id: string;
  cache_key: string;
  chunk_index: number;
  audio_base64: string;
}

export interface VoiceStreamDoneEvent {
  message_id: string;
  cache_key: string;
  audio_url: string;
  mime_type: string;
  byte_size: number;
  duration_ms?: number;
  cached: boolean;
}

export interface VoiceStreamErrorEvent {
  message_id?: string;
  error: string;
}

export interface VoiceStreamEmitter {
  start: (event: VoiceStreamStartEvent) => void | Promise<void>;
  chunk: (event: VoiceStreamChunkEvent) => void | Promise<void>;
  done: (event: VoiceStreamDoneEvent) => void | Promise<void>;
  error: (event: VoiceStreamErrorEvent) => void | Promise<void>;
}
