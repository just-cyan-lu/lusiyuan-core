import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types/chat";
import { LusiyuanAvatar } from "./LusiyuanAvatar";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  messages: ChatMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
}

export function MessageList({ messages, isSending, isLoadingHistory }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasDraftMessage = messages.some((message) => message.isDraft);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (isLoadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#7b8ca2]">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <div className="flex justify-start mb-3">
          <LusiyuanAvatar className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d9e2ec] bg-[#fff4c7] text-xs font-semibold text-[#794f27]" />
          <div className="max-w-[72%] rounded-lg rounded-tl-sm border border-[#d9e2ec] bg-[#f8fbff] px-3.5 py-2.5 text-sm leading-relaxed text-[#334155] shadow-sm">
            你好。嗯……你可以直接和我聊天。
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isSending && !hasDraftMessage && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
