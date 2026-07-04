import { useEffect, useRef, useState } from "react";
import {
  fetchVoiceClientConfig,
  type VoiceClientConfig,
} from "../api/lusiyuan-api";

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  onspeechend?: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type VoiceCallMode = "manual" | "call";

const fallbackAutoSilenceMs = 1200;
const autoRestartMs = 500;

const fallbackVoiceConfig: VoiceClientConfig = {
  asr: {
    enabled: true,
    provider: "browser",
    language: "zh-CN",
    max_duration_seconds: 60,
    auto_silence_ms: fallbackAutoSilenceMs,
  },
  tts: {
    enabled: true,
  },
};

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  const browserWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function speechErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") return "麦克风或语音识别权限被浏览器拒绝。";
  if (error === "no-speech") return "没有听到有效语音，可以再说一次。";
  if (error === "audio-capture") return "没有找到可用麦克风。";
  if (error === "network") return "浏览器语音识别服务暂时不可用。";
  return "语音识别失败。";
}

export function useVoiceCall(onTranscript: (text: string) => void | Promise<void>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAutoCallActive, setIsAutoCallActiveState] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceClientConfig>(fallbackVoiceConfig);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const transcriptRef = useRef("");
  const ignoreEndRef = useRef(false);
  const activeModeRef = useRef<VoiceCallMode | null>(null);
  const autoCallActiveRef = useRef(false);
  const isTranscribingRef = useRef(false);
  const maxDurationTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  const isSupported = Boolean(getSpeechRecognitionConstructor());

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    void fetchVoiceClientConfig()
      .then((config) => setVoiceConfig(config))
      .catch(() => setVoiceConfig(fallbackVoiceConfig));
  }, []);

  function setAutoCallActive(value: boolean) {
    autoCallActiveRef.current = value;
    setIsAutoCallActiveState(value);
  }

  function setTranscribing(value: boolean) {
    isTranscribingRef.current = value;
    setIsTranscribing(value);
  }

  function clearMaxDurationTimer() {
    if (maxDurationTimerRef.current === null) return;
    window.clearTimeout(maxDurationTimerRef.current);
    maxDurationTimerRef.current = null;
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current === null) return;
    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }

  function clearRestartTimer() {
    if (restartTimerRef.current === null) return;
    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }

  function resetTranscript() {
    finalTranscriptRef.current = "";
    transcriptRef.current = "";
    setLiveTranscript(null);
  }

  function abortRecognition() {
    ignoreEndRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    clearMaxDurationTimer();
    clearSilenceTimer();
  }

  function scheduleAutoRestart() {
    clearRestartTimer();
    if (!autoCallActiveRef.current) return;
    restartTimerRef.current = window.setTimeout(() => {
      if (!autoCallActiveRef.current || recognitionRef.current) return;
      startRecognition("call");
    }, autoRestartMs);
  }

  function stopForSend() {
    clearSilenceTimer();
    const recognition = recognitionRef.current;
    if (!recognition) {
      void sendCapturedTranscript(activeModeRef.current);
      return;
    }
    setTranscribing(true);
    recognition.stop();
  }

  function scheduleSilenceStop(delayMs = voiceConfig.asr.auto_silence_ms ?? fallbackAutoSilenceMs) {
    if (activeModeRef.current !== "call") return;
    if (!transcriptRef.current.trim()) return;
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(stopForSend, delayMs);
  }

  async function sendCapturedTranscript(mode: VoiceCallMode | null) {
    clearMaxDurationTimer();
    clearSilenceTimer();
    const text = transcriptRef.current.trim();
    setIsRecording(false);

    if (!text) {
      setTranscribing(false);
      if (mode === "call" && autoCallActiveRef.current) {
        scheduleAutoRestart();
      } else {
        setError("没有识别到文字，可以再说一次。");
      }
      return;
    }

    setLiveTranscript(null);
    setLastTranscript(text);
    setError(null);
    setTranscribing(true);

    try {
      await onTranscriptRef.current(text);
    } catch (transcriptError) {
      setError(transcriptError instanceof Error ? transcriptError.message : "发送语音文字失败。");
      if (mode === "call") setAutoCallActive(false);
    } finally {
      setTranscribing(false);
      activeModeRef.current = null;
      if (mode === "call" && autoCallActiveRef.current) {
        scheduleAutoRestart();
      }
    }
  }

  function startRecognition(mode: VoiceCallMode) {
    if (recognitionRef.current || isTranscribingRef.current) return;
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError("当前浏览器不支持语音识别。请使用最新版 Chrome，或在 Edge 中确认 SpeechRecognition 可用。");
      return;
    }
    if (!voiceConfig.asr.enabled) {
      setError("语音识别已在 Admin 中关闭。");
      return;
    }

    clearRestartTimer();
    clearSilenceTimer();
    setError(null);
    setLastTranscript(null);
    resetTranscript();
    ignoreEndRef.current = false;
    activeModeRef.current = mode;

    const recognition = new SpeechRecognition();
    recognition.lang = voiceConfig.asr.language || "zh-CN";
    recognition.continuous = mode === "manual";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalText = finalTranscriptRef.current;
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      finalTranscriptRef.current = finalText;
      transcriptRef.current = `${finalText}${interimText}`.trim();
      setLiveTranscript(transcriptRef.current || null);
      scheduleSilenceStop();
    };
    recognition.onspeechend = () => {
      scheduleSilenceStop();
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" && activeModeRef.current === "call") return;
      ignoreEndRef.current = true;
      setError(event.message || speechErrorMessage(event.error));
      setIsRecording(false);
      setTranscribing(false);
      clearMaxDurationTimer();
      clearSilenceTimer();
      if (activeModeRef.current === "call") setAutoCallActive(false);
      activeModeRef.current = null;
    };
    recognition.onend = () => {
      const endedMode = activeModeRef.current;
      recognitionRef.current = null;
      if (ignoreEndRef.current) {
        ignoreEndRef.current = false;
        clearMaxDurationTimer();
        clearSilenceTimer();
        setIsRecording(false);
        setTranscribing(false);
        return;
      }
      void sendCapturedTranscript(endedMode);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
      setTranscribing(false);
      const maxDurationMs = voiceConfig.asr.max_duration_seconds * 1000;
      maxDurationTimerRef.current = window.setTimeout(stopForSend, maxDurationMs);
    } catch (startError) {
      recognitionRef.current = null;
      activeModeRef.current = null;
      if (mode === "call") setAutoCallActive(false);
      setError(startError instanceof Error ? startError.message : "语音识别启动失败。");
    }
  }

  function startRecording() {
    if (isAutoCallActive) return;
    startRecognition("manual");
  }

  function stopAndSend() {
    if (isTranscribingRef.current) return;
    stopForSend();
  }

  function startAutoCall() {
    if (autoCallActiveRef.current || isTranscribingRef.current) return;
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError("当前浏览器不支持语音识别。请使用最新版 Chrome，或在 Edge 中确认 SpeechRecognition 可用。");
      return;
    }
    if (!voiceConfig.asr.enabled) {
      setError("语音识别已在 Admin 中关闭。");
      return;
    }
    setAutoCallActive(true);
    startRecognition("call");
  }

  function stopAutoCall() {
    setAutoCallActive(false);
    activeModeRef.current = null;
    clearRestartTimer();
    abortRecognition();
    setIsRecording(false);
    setTranscribing(false);
  }

  function close() {
    stopAutoCall();
    setIsOpen(false);
  }

  return {
    isOpen,
    setIsOpen,
    isSupported,
    isRecording,
    isTranscribing,
    isAutoCallActive,
    liveTranscript,
    lastTranscript,
    error,
    startRecording,
    stopAndSend,
    startAutoCall,
    stopAutoCall,
    close,
  };
}
