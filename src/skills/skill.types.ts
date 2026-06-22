import type { ToolAccessMode } from "../tools/tool-access.js";

export type SkillStatus = "available" | "disabled" | "profile_disabled";

export interface SkillProfileDefinition {
  id: string;
  label: string;
  platform?: string;
  description: string;
  enabled: boolean;
  implemented: boolean;
  configKeys: string[];
  disabledReason: string | null;
  rulesSummary: string[];
}

export interface SkillDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
  accessMode: ToolAccessMode;
  enabled: boolean;
  disabledReason: string | null;
  configKeys: string[];
  entryPoints: string[];
  outputContract: string[];
  disabledBehavior: string;
  profiles: SkillProfileDefinition[];
}
