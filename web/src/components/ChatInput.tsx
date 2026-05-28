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
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2">
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
          className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 leading-relaxed py-0.5 disabled:opacity-50"
          style={{ height: "auto", minHeight: "24px" }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30 hover:bg-purple-600 active:scale-95"
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
      <p className="text-center text-xs text-gray-300 mt-2">
        陆思源是原创 AI 数字人，不是真人。请勿输入敏感隐私信息。
      </p>
    </div>
  );
}
