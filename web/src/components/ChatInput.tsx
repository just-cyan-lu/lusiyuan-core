import { useState, useRef, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const content = text.trim();
    if (!content || disabled) return;
    onSend(content);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="border-t border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <div className="flex items-end gap-2 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="发消息给陆思源…"
          disabled={disabled}
          rows={1}
          maxLength={4000}
          className="flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-[#172033] outline-none placeholder:text-[#9aa8b8] disabled:opacity-50"
          style={{ height: "auto", minHeight: "24px" }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#6f8fb8] transition disabled:opacity-30 hover:bg-[#5f7fa7] active:scale-95"
          aria-label="发送"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-[#7b8ca2]">
        陆思源是原创 AI 数字人，不是真人。请勿输入敏感隐私信息。
      </p>
    </div>
  );
}
