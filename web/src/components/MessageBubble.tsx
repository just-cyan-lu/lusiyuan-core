import type { ChatMessage } from "../types/chat";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#6f8fb8] text-xs font-semibold text-white">
          陆
        </div>
      )}
      <div
        className={`
          max-w-[72%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isUser
            ? "rounded-tr-sm bg-[#6f8fb8] text-white"
            : "rounded-tl-sm border border-[#d9e2ec] bg-[#f8fbff] text-[#334155] shadow-sm"
          }
        `}
      >
        {message.content}
      </div>
    </div>
  );
}
