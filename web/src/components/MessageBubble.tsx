import type { ChatMessage } from "../types/chat";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium shrink-0 mr-2 mt-0.5">
          陆
        </div>
      )}
      <div
        className={`
          max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isUser
            ? "bg-purple-500 text-white rounded-tr-sm"
            : "bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100"
          }
        `}
      >
        {message.content}
      </div>
    </div>
  );
}
