interface VoiceCallPanelProps {
  isOpen: boolean;
  isSupported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isAutoCallActive: boolean;
  liveTranscript: string | null;
  lastTranscript: string | null;
  error: string | null;
  onStart: () => void;
  onStopAndSend: () => void;
  onStartAutoCall: () => void;
  onStopAutoCall: () => void;
  onClose: () => void;
}

export function VoiceCallPanel({
  isOpen,
  isSupported,
  isRecording,
  isTranscribing,
  isAutoCallActive,
  liveTranscript,
  lastTranscript,
  error,
  onStart,
  onStopAndSend,
  onStartAutoCall,
  onStopAutoCall,
  onClose,
}: VoiceCallPanelProps) {
  if (!isOpen) return null;

  const transcript = liveTranscript || lastTranscript;

  return (
    <div className="border-b border-[#d9e2ec] bg-[#eef6ff] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#172033]">语音电话</div>
          <div className="mt-0.5 text-xs text-[#66758a]">
            {!isSupported
              ? "当前浏览器不支持语音识别。"
              : isAutoCallActive && isRecording
              ? "通话中。"
              : isAutoCallActive && isTranscribing
                ? "思源回复中。"
              : isRecording
              ? "正在听你说话，结束后会转成文字发给思源。"
              : isTranscribing
                ? "正在整理文字…"
                : "按下开始说话，说完后发送。"}
          </div>
          {transcript ? (
            <div className="mt-2 rounded-md border border-[#c9d6e5] bg-white px-3 py-2 text-xs text-[#334155]">
              {transcript}
            </div>
          ) : null}
          {error ? (
            <div className="mt-2 text-xs font-medium text-[#b85f6b]">{error}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={isRecording ? onStopAndSend : onStart}
            disabled={!isSupported || isTranscribing || isAutoCallActive}
            className={`h-9 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-40 ${
              isRecording
                ? "bg-[#b85f6b] hover:bg-[#a8505c]"
                : "bg-[#6f8fb8] hover:bg-[#5f7fa7]"
            }`}
          >
            {isRecording ? "结束并发送" : "开始说话"}
          </button>
          <button
            type="button"
            onClick={isAutoCallActive ? onStopAutoCall : onStartAutoCall}
            disabled={!isSupported || (isTranscribing && !isAutoCallActive)}
            className={`h-9 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-40 ${
              isAutoCallActive
                ? "bg-[#b85f6b] hover:bg-[#a8505c]"
                : "bg-[#4f9a7a] hover:bg-[#438768]"
            }`}
          >
            {isAutoCallActive ? "挂断" : "开始通话"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#c9d6e5] bg-white px-3 text-sm font-medium text-[#334155] hover:bg-[#f8fbff]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
