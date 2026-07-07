import { Button, Tooltip } from "animal-island-ui";
import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface ChatHeaderProps {
  displayName?: string;
  voiceAutoplayEnabled: boolean;
  onToggleVoiceAutoplay: () => void;
  onOpenVoiceCall: () => void;
}

export function ChatHeader({
  displayName,
  voiceAutoplayEnabled,
  onToggleVoiceAutoplay,
  onOpenVoiceCall,
}: ChatHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--ls-border)] bg-[var(--ls-yellow-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <LusiyuanAvatar
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border-2 border-[var(--ls-yellow)] bg-[var(--ls-panel-soft)] text-lg font-black text-[var(--ls-ink-strong)] shadow-sm"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-black text-[var(--ls-ink-strong)]">陆思源</span>
            <span className="admin-chip admin-chip-mint">Web Chat</span>
          </div>
          <div className="truncate text-xs font-bold text-[var(--ls-ink-soft)]">
            {displayName ? `${displayName} · ` : ""}原创 AI 数字人 · 岛屿私信小屋
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip
          title={voiceAutoplayEnabled ? "关闭自动语音" : "开启自动语音"}
          variant="island"
          placement="bottom"
        >
          <Button
            type={voiceAutoplayEnabled ? "primary" : "default"}
            size="small"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
                <path
                  d="M16 8.5c1 .9 1.5 2.1 1.5 3.5S17 14.6 16 15.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
            onClick={onToggleVoiceAutoplay}
          />
        </Tooltip>

        <Tooltip title="语音电话" variant="island" placement="bottom">
          <Button
            type="default"
            size="small"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4h3l1.5 4-2 1.2c1 2.1 2.2 3.3 4.3 4.3l1.2-2 4 1.5v3c0 1.1-.9 2-2 2C9.8 19 5 14.2 5 7c0-1.1.9-2 2-2Z"
                  fill="currentColor"
                />
              </svg>
            }
            onClick={onOpenVoiceCall}
          />
        </Tooltip>

      </div>
    </div>
  );
}
