import { Button, Icon } from "animal-island-ui";

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
    <div className="border-b border-[var(--ls-border-cold)] bg-[var(--ls-panel-cold)] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-[var(--ls-ink-strong)]">语音电话</span>
            <span className={`admin-chip ${isSupported ? "admin-chip-mint" : ""}`}>
              {isSupported ? "已就绪" : "不支持"}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-[var(--ls-ink-soft)]">
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
            <div className="admin-island-row mt-2 bg-white px-3 py-2 text-xs font-semibold text-[var(--ls-ink)]">
              {transcript}
            </div>
          ) : null}
          {error ? (
            <div className="mt-2 text-xs font-bold text-[var(--ls-pink-text)]">{error}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="primary"
            danger={isRecording}
            size="small"
            disabled={!isSupported || isTranscribing || isAutoCallActive}
            onClick={isRecording ? onStopAndSend : onStart}
          >
            {isRecording ? "结束并发送" : "开始说话"}
          </Button>
          <Button
            type="primary"
            danger={isAutoCallActive}
            size="small"
            disabled={!isSupported || (isTranscribing && !isAutoCallActive)}
            onClick={isAutoCallActive ? onStopAutoCall : onStartAutoCall}
          >
            {isAutoCallActive ? "挂断" : "开始通话"}
          </Button>
          <Button type="default" size="small" icon={<Icon name="icon-variant" size={16} />} onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}
