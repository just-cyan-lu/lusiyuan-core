export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium shrink-0 mr-2 mt-0.5">
        陆
      </div>
      <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
