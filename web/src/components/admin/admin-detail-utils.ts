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
