export function ChatHeader() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium text-lg shrink-0">
        陆
      </div>
      <div className="min-w-0">
        <div className="font-medium text-gray-900 text-sm">陆思源</div>
        <div className="text-xs text-gray-400 truncate">原创 AI 数字人 · 正在慢慢成为自己</div>
      </div>
    </div>
  );
}
