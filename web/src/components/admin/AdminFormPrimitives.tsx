import { Select, type SelectOption } from "animal-island-ui";

export type { SelectOption };

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
