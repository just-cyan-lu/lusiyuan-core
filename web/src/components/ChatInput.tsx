import { useState, useRef, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  isSending: boolean;
  isStopping: boolean;
  canStop: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  isSending,
  isStopping,
  canStop,
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const minTextareaHeight = 48;
  const maxTextareaHeight = 128;

  function handleSend() {
    const content = text.trim();
    if (!content || disabled || isSending) return;
    onSend(content);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${minTextareaHeight}px`;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minTextareaHeight), maxTextareaHeight)}px`;
  }

  function handlePrimaryAction() {
    if (isSending) {
      if (!isStopping) onStop();
      return;
    }
    handleSend();
  }

  const canSend = !isSending && !disabled && Boolean(text.trim());
  const stopEnabled = isSending && canStop && !isStopping;
  const primaryButtonTone = isSending
    ? "bg-[#b85f6b] shadow-[0_3px_0_#8e4650] hover:bg-[#a8505c] active:shadow-[0_1px_0_#8e4650]"
    : "bg-[#6f8fb8] shadow-[0_3px_0_#4f6f98] hover:bg-[#5f7fa7] active:shadow-[0_1px_0_#4f6f98]";

  return (
    <div className="border-t border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <div className="flex min-h-[4.25rem] items-end gap-2 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2 shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="发消息给陆思源…"
          disabled={disabled || isSending}
          rows={2}
          maxLength={4000}
          className="min-h-12 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-6 text-[#172033] outline-none placeholder:text-[#9aa8b8] disabled:opacity-50"
          style={{ height: `${minTextareaHeight}px` }}
        />
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={isSending ? !stopEnabled : !canSend}
          className={`admin-icon-button mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-white transition hover:-translate-y-0.5 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-30 ${primaryButtonTone}`}
          aria-label={isSending ? "停止" : "发送"}
          title={isSending ? (isStopping ? "正在停止…" : "停止") : "发送"}
        >
          {isSending ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-[#7b8ca2]">
        按 enter 发送，shift + enter 换行
      </p>
    </div>
  );
}
