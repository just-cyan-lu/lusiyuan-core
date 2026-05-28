import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types/chat";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  messages: ChatMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
}

export function MessageList({ messages, isSending, isLoadingHistory }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <div className="flex justify-start mb-3">
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium shrink-0 mr-2 mt-0.5">
            陆
          </div>
          <div className="bg-white border border-gray-100 shadow-sm px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-800 leading-relaxed max-w-[72%]">
            你好。嗯……你可以直接和我聊天。
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isSending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
