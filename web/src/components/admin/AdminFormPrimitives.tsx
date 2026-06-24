import { Input, Select, type InputProps, type SelectOption } from "animal-island-ui";
import type { ChangeEvent } from "react";

export type { InputProps, SelectOption };

type AdminSelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * 统一 admin 下拉。
 * - 必须挂 .admin-select-below 才能让 dropdown 向下展开（web/src/index.css）。
 * - 容器内任何层级的 .admin-select-host 祖先可让 z-index 突破 stacking context。
 * - UI 库 Select 不带可见 label，调用方要么自己写 <span>，要么用 ariaLabel 走 a11y。
 */
export function AdminSelect({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  placeholder,
  className,
}: AdminSelectProps) {
  return (
    <label className={`admin-select-below block w-full ${className ?? ""}`.trim()}>
      <Select
        options={options}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
      />
    </label>
  );
}

/**
 * 统一 admin 输入框。
 * - 必须挂 .admin-input 才能让 UI 库 Input 复用 admin 视觉（border-radius 1.1rem、
 *   height 45px、box-shadow 0 2px 0 #d4c9b4），否则会变成胶囊形 + 40px。
 * - 默认带 `shadow` 偏移以匹配 admin 卡片其他控件的浮起感。
 * - UI 库 Input 不带可见 label，调用方要么自己写 <span>，要么用 ariaLabel 走 a11y。
 */
export function AdminInput({
  value,
  onChange,
  type,
  placeholder,
  disabled,
  allowClear,
  className,
  "aria-label": ariaLabel,
  ...rest
}: InputProps) {
  return (
    <div className={`admin-input ${className ?? ""}`.trim()}>
      <Input
        value={value}
        onChange={onChange as ((event: ChangeEvent<HTMLInputElement>) => void) | undefined}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        allowClear={allowClear}
        size="middle"
        shadow
        aria-label={ariaLabel}
        {...rest}
      />
    </div>
  );
}
