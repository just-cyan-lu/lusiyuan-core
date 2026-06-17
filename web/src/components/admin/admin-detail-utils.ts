export function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "暂无";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return jsonText(value);
}

export function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "暂无";
  } catch {
    return String(value);
  }
}

export function formatAdminDate(value: string | null): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function textListFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export function shortAdminId(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function sourceIdListText(value: unknown, maxVisible = 4): string {
  const items = textListFromJson(value);
  if (items.length === 0) return "暂无";
  const visible = items.slice(0, maxVisible).map(shortAdminId);
  return items.length > maxVisible
    ? `${visible.join(" / ")} 等 ${items.length} 条`
    : visible.join(" / ");
}
