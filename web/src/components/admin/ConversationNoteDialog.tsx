import type { ChangeEvent } from "react";
import { Button, Input } from "animal-island-ui";

interface ConversationNoteDialogProps {
  value: string;
  saving?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ConversationNoteDialog({
  value,
  saving = false,
  onChange,
  onClose,
  onSave,
}: ConversationNoteDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="编辑对话备注"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[var(--ls-border)] bg-white p-5 shadow-[var(--ls-shadow)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ls-ink-strong)]">编辑对话备注</h3>
            <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
              备注只用于 Admin 展示，方便你在下拉框和会话列表里认出这段对话。
            </p>
          </div>
          <button
            type="button"
            className="admin-layout-button rounded-full px-2 py-1 text-sm font-semibold text-[var(--ls-ink-soft)] hover:bg-[var(--ls-panel-soft)]"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            ×
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">
            对话备注
          </span>
          <Input
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            placeholder="比如：7月测试主线 / 微信接入调试"
            maxLength={120}
            aria-label="对话备注"
          />
        </label>

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button type="default" disabled={saving || !value.trim()} onClick={() => onChange("")}>
            清空
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="default" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
