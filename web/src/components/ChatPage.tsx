import { useChat } from "../hooks/useChat";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatPage() {
  const { messages, isSending, isLoadingHistory, error, sendMessage } = useChat();

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full bg-gray-50">
      <ChatHeader />
      <MessageList
        messages={messages}
        isSending={isSending}
        isLoadingHistory={isLoadingHistory}
      />
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-500">
          {error}
        </div>
      )}
      <ChatInput onSend={sendMessage} disabled={isSending} />
    </div>
  );
}
