import { useChat } from "../hooks/useChat";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatPage() {
  const { messages, isSending, isLoadingHistory, error, sendMessage } = useChat();

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[34rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
      <ChatHeader />
      <MessageList
        messages={messages}
        isSending={isSending}
        isLoadingHistory={isLoadingHistory}
      />
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-3 py-2 text-sm text-[#8d6048]">
          {error}
        </div>
      )}
      <ChatInput onSend={sendMessage} disabled={isSending} />
    </div>
  );
}
