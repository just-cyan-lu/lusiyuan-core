export type ToolAccessMode = "off" | "owner_only" | "on";

const toolAccessModes: ToolAccessMode[] = ["off", "owner_only", "on"];

export function normalizeToolAccessMode(
  value: string | undefined,
  fallback: ToolAccessMode,
  key = "tool access mode"
): ToolAccessMode {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (toolAccessModes.includes(normalized as ToolAccessMode)) {
    return normalized as ToolAccessMode;
  }

  throw new Error(
    `Invalid ${key}: ${value}. Supported: ${toolAccessModes.join(", ")}`
  );
}

export function toolAccessState(
  mode: ToolAccessMode,
  prerequisiteEnabled = true
): { enabled: boolean; ownerOnly: boolean; accessMode: ToolAccessMode } {
  return {
    enabled: prerequisiteEnabled && mode !== "off",
    ownerOnly: mode === "owner_only",
    accessMode: mode,
  };
}
