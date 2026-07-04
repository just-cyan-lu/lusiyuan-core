import { useMemo, useRef, useState } from "react";
import {
  API_BASE_URL,
  streamMessageVoice,
} from "../api/lusiyuan-api";
import { VoicePlayer } from "../audio/voicePlayer";
import type { MediaSourceVoiceStream } from "../audio/voicePlayer";
import type { VoiceStreamEvent } from "../types/chat";
import type { WebIdentity } from "../utils/storage";

interface PendingVoice {
  chunks: string[];
  mimeType: string;
  stream: MediaSourceVoiceStream | null;
  queueToken: number;
}

interface VoicePlaybackJob {
  messageId: string;
  play: () => Promise<void>;
}

const storageKey = "lusiyuan.voice.autoplay";

function absoluteAudioUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function chunksToBlob(chunks: string[], mimeType: string): Blob {
  const parts = chunks.map((chunk) => bytesToArrayBuffer(base64ToBytes(chunk)));
  return new Blob(parts, { type: mimeType || "audio/mpeg" });
}

export function useVoicePlayback(identity: WebIdentity) {
  const [autoplayEnabled, setAutoplayEnabledState] = useState(
    () => localStorage.getItem(storageKey) === "true"
  );
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingMessageIds, setLoadingMessageIds] = useState<string[]>([]);
  const [errorByMessageId, setErrorByMessageId] = useState<Record<string, string>>({});
  const playerRef = useRef(new VoicePlayer());
  const pendingRef = useRef(new Map<string, PendingVoice>());
  const playbackQueueRef = useRef<VoicePlaybackJob[]>([]);
  const playingMessageIdRef = useRef<string | null>(null);
  const queueTokenRef = useRef(0);
  const idleWaitersRef = useRef<Array<() => void>>([]);

  const loadingSet = useMemo(
    () => new Set(loadingMessageIds),
    [loadingMessageIds]
  );

  function setAutoplayEnabled(value: boolean) {
    localStorage.setItem(storageKey, String(value));
    setAutoplayEnabledState(value);
    if (!value) stop();
  }

  function markLoading(messageId: string, loading: boolean) {
    setLoadingMessageIds((current) => {
      const set = new Set(current);
      if (loading) set.add(messageId);
      else set.delete(messageId);
      return Array.from(set);
    });
  }

  function isIdle() {
    return !playingMessageIdRef.current &&
      playbackQueueRef.current.length === 0 &&
      pendingRef.current.size === 0;
  }

  function notifyIdleIfNeeded() {
    if (!isIdle()) return;
    const waiters = idleWaitersRef.current.splice(0);
    for (const resolve of waiters) resolve();
  }

  function setCurrentPlaying(messageId: string | null) {
    playingMessageIdRef.current = messageId;
    setPlayingMessageId(messageId);
    if (!messageId) notifyIdleIfNeeded();
  }

  function clearQueue() {
    playbackQueueRef.current = [];
    queueTokenRef.current += 1;
    notifyIdleIfNeeded();
  }

  function waitUntilIdle(): Promise<void> {
    if (isIdle()) return Promise.resolve();
    return new Promise((resolve) => {
      idleWaitersRef.current.push(resolve);
    });
  }

  function makeChunkJob(messageId: string, pending: PendingVoice): VoicePlaybackJob {
    const chunks = [...pending.chunks];
    const mimeType = pending.mimeType;
    return {
      messageId,
      play: () => playerRef.current.playBlob(chunksToBlob(chunks, mimeType)),
    };
  }

  function makeUrlJob(messageId: string, url: string): VoicePlaybackJob {
    return {
      messageId,
      play: () => playerRef.current.playUrl(absoluteAudioUrl(url)),
    };
  }

  function drainQueue() {
    if (playingMessageIdRef.current) return;
    const next = playbackQueueRef.current.shift();
    if (!next) {
      notifyIdleIfNeeded();
      return;
    }
    void runJob(next);
  }

  async function runJob(job: VoicePlaybackJob) {
    setCurrentPlaying(job.messageId);
    try {
      await job.play();
    } catch (error) {
      setErrorByMessageId((current) => ({
        ...current,
        [job.messageId]: error instanceof Error ? error.message : "语音播放失败",
      }));
    } finally {
      if (playingMessageIdRef.current === job.messageId) setCurrentPlaying(null);
      drainQueue();
    }
  }

  function enqueueOrPlay(job: VoicePlaybackJob) {
    if (playingMessageIdRef.current) {
      if (!playbackQueueRef.current.some((item) => item.messageId === job.messageId)) {
        playbackQueueRef.current.push(job);
      }
      return;
    }
    void runJob(job);
  }

  function handleStreamEvent(event: VoiceStreamEvent) {
    if (event.type === "voice_start") {
      const canStreamNow = !playingMessageIdRef.current && playbackQueueRef.current.length === 0;
      const stream = canStreamNow ? playerRef.current.startStream(event.data.mime_type) : null;
      pendingRef.current.set(event.data.message_id, {
        chunks: [],
        mimeType: event.data.mime_type,
        stream,
        queueToken: queueTokenRef.current,
      });
      if (stream) {
        setCurrentPlaying(event.data.message_id);
      }
      markLoading(event.data.message_id, true);
      setErrorByMessageId((current) => {
        const next = { ...current };
        delete next[event.data.message_id];
        return next;
      });
      return;
    }
    if (event.type === "voice_chunk") {
      const pending = pendingRef.current.get(event.data.message_id);
      if (pending) {
        pending.chunks.push(event.data.audio_base64);
        pending.stream?.append(base64ToBytes(event.data.audio_base64));
      }
      return;
    }
    if (event.type === "voice_done") {
      const pending = pendingRef.current.get(event.data.message_id);
      pendingRef.current.delete(event.data.message_id);
      markLoading(event.data.message_id, false);
      if (pending?.stream) {
        const fallback = makeChunkJob(event.data.message_id, pending);
        void pending.stream.finish()
          .catch(async () => {
            try {
              await fallback.play();
            } catch (error) {
              setErrorByMessageId((current) => ({
                ...current,
                [event.data.message_id]: error instanceof Error ? error.message : "语音播放失败",
              }));
            }
          })
          .finally(() => {
            if (playingMessageIdRef.current === event.data.message_id) {
              setCurrentPlaying(null);
            }
            drainQueue();
          });
      } else if (pending) {
        if (pending.queueToken !== queueTokenRef.current) {
          notifyIdleIfNeeded();
          return;
        }
        enqueueOrPlay(
          pending.chunks.length > 0
            ? makeChunkJob(event.data.message_id, pending)
            : makeUrlJob(event.data.message_id, event.data.audio_url)
        );
      } else {
        enqueueOrPlay(makeUrlJob(event.data.message_id, event.data.audio_url));
      }
      return;
    }
    if (event.type === "voice_error") {
      const messageId = event.data.message_id;
      if (messageId) {
        pendingRef.current.delete(messageId);
        markLoading(messageId, false);
        if (playingMessageIdRef.current === messageId) setCurrentPlaying(null);
        setErrorByMessageId((current) => ({
          ...current,
          [messageId]: event.data.error,
        }));
      }
    }
  }

  async function playMessage(messageId: string) {
    if (playingMessageId === messageId) {
      clearQueue();
      playerRef.current.stop();
      setCurrentPlaying(null);
      return;
    }

    markLoading(messageId, true);
    setErrorByMessageId((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
    try {
      await streamMessageVoice({
        userId: identity.userId,
        conversationId: identity.conversationId,
        messageId,
      }, handleStreamEvent);
    } catch (error) {
      markLoading(messageId, false);
      setErrorByMessageId((current) => ({
        ...current,
        [messageId]: error instanceof Error ? error.message : "语音播放失败",
      }));
    }
  }

  function stop() {
    clearQueue();
    playerRef.current.stop();
    setCurrentPlaying(null);
  }

  return {
    autoplayEnabled,
    setAutoplayEnabled,
    playingMessageId,
    loadingMessageIds: loadingSet,
    errorByMessageId,
    handleStreamEvent,
    playMessage,
    clearQueue,
    waitUntilIdle,
    stop,
  };
}
