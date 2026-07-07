import { Button } from "animal-island-ui";
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

  return (
    <div className="border-t border-[var(--ls-border)] bg-[var(--ls-panel)] px-4 py-3">
      <div className="admin-island-row flex min-h-[4.5rem] items-end gap-2 bg-white px-3 py-2">
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
          className="min-h-12 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm font-semibold leading-6 text-[var(--ls-ink-strong)] outline-none placeholder:text-[var(--ls-ink-faint)] disabled:opacity-50"
          style={{ height: `${minTextareaHeight}px` }}
        />
        <Button
          type={isSending ? "primary" : "primary"}
          danger={isSending}
          size="middle"
          disabled={isSending ? !stopEnabled : !canSend}
          loading={isStopping}
          onClick={handlePrimaryAction}
          icon={
            isSending ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h13M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
          aria-label={isSending ? "停止" : "发送"}
          title={isSending ? (isStopping ? "正在停止…" : "停止") : "发送"}
        />
      </div>
      <p className="mt-2 text-center text-xs font-bold text-[var(--ls-ink-soft)]">
        按 enter 发送，shift + enter 换行
      </p>
    </div>
  );
}
