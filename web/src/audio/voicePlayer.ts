export class VoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private stream: MediaSourceVoiceStream | null = null;
  private stopCurrentPlayback: (() => void) | null = null;

  stop(): void {
    this.stream?.abort();
    this.stream = null;
    this.stopCurrentPlayback?.();
    this.stopCurrentPlayback = null;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio = null;
  }

  async playUrl(url: string): Promise<void> {
    this.stop();
    const audio = new Audio(url);
    this.audio = audio;
    await this.play(audio);
  }

  async playBlob(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      await this.playUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  startStream(mimeType: string): MediaSourceVoiceStream | null {
    this.stop();
    if (!supportsMediaSource(mimeType)) return null;

    const mediaSource = new MediaSource();
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(mediaSource);
    audio.src = objectUrl;
    this.audio = audio;

    const stream = new MediaSourceVoiceStream({
      audio,
      mediaSource,
      mimeType,
      objectUrl,
      onDone: () => {
        if (this.stream === stream) this.stream = null;
        if (this.audio === audio) this.audio = null;
      },
    });
    this.stream = stream;
    return stream;
  }

  private play(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        if (this.stopCurrentPlayback === onStop) this.stopCurrentPlayback = null;
      };
      const onEnded = () => {
        cleanup();
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      const onError = () => {
        cleanup();
        if (this.audio === audio) this.audio = null;
        reject(new Error("语音播放失败"));
      };
      const onStop = () => {
        cleanup();
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      this.stopCurrentPlayback = onStop;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      audio.play().catch((error: unknown) => {
        cleanup();
        if (this.audio === audio) this.audio = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}

function supportsMediaSource(mimeType: string): boolean {
  return typeof MediaSource !== "undefined" &&
    typeof MediaSource.isTypeSupported === "function" &&
    MediaSource.isTypeSupported(mimeType);
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

interface MediaSourceVoiceStreamInput {
  audio: HTMLAudioElement;
  mediaSource: MediaSource;
  mimeType: string;
  objectUrl: string;
  onDone: () => void;
}

export class MediaSourceVoiceStream {
  private readonly input: MediaSourceVoiceStreamInput;
  private sourceBuffer: SourceBuffer | null = null;
  private queue: ArrayBuffer[] = [];
  private finished = false;
  private aborted = false;
  private playStarted = false;
  private readonly donePromise: Promise<void>;
  private resolveDone!: () => void;
  private rejectDone!: (error: Error) => void;

  constructor(input: MediaSourceVoiceStreamInput) {
    this.input = input;
    this.donePromise = new Promise<void>((resolve, reject) => {
      this.resolveDone = resolve;
      this.rejectDone = reject;
    });

    input.mediaSource.addEventListener("sourceopen", () => this.handleOpen(), { once: true });
    input.audio.addEventListener("ended", () => this.complete(), { once: true });
    input.audio.addEventListener("error", () => this.fail(new Error("语音播放失败")), { once: true });
  }

  get done(): Promise<void> {
    return this.donePromise;
  }

  append(bytes: Uint8Array): void {
    if (this.aborted || this.finished) return;
    this.queue.push(bytesToArrayBuffer(bytes));
    this.pump();
  }

  finish(): Promise<void> {
    this.finished = true;
    this.pump();
    return this.done;
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    try {
      if (this.input.mediaSource.readyState === "open") {
        this.input.mediaSource.endOfStream();
      }
    } catch {
      // MediaSource may already be closing.
    }
    URL.revokeObjectURL(this.input.objectUrl);
    this.input.onDone();
    this.resolveDone();
  }

  private handleOpen(): void {
    if (this.aborted) return;
    try {
      this.sourceBuffer = this.input.mediaSource.addSourceBuffer(this.input.mimeType);
      this.sourceBuffer.mode = "sequence";
      this.sourceBuffer.addEventListener("updateend", () => this.pump());
      this.pump();
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private pump(): void {
    if (this.aborted || !this.sourceBuffer) return;
    if (this.sourceBuffer.updating) return;

    const next = this.queue.shift();
    if (next) {
      try {
        this.sourceBuffer.appendBuffer(next);
        this.startPlayback();
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    if (this.finished && this.input.mediaSource.readyState === "open") {
      try {
        this.input.mediaSource.endOfStream();
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private startPlayback(): void {
    if (this.playStarted) return;
    this.playStarted = true;
    this.input.audio.play().catch((error: unknown) => {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    });
  }

  private complete(): void {
    if (this.aborted) return;
    URL.revokeObjectURL(this.input.objectUrl);
    this.input.onDone();
    this.resolveDone();
  }

  private fail(error: Error): void {
    if (this.aborted) return;
    this.aborted = true;
    URL.revokeObjectURL(this.input.objectUrl);
    this.input.onDone();
    this.rejectDone(error);
  }
}
