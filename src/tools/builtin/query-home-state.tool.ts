import { runtimeConfig } from "../../config/runtime-settings.service.js";
import {
  homeAutomationService,
  type QueryHomeStateInput,
  type QueryHomeStateOutput,
} from "../../home-automation/home-automation.service.js";
import { env } from "../../utils/env.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

async function handler(
  input: QueryHomeStateInput,
  context: ToolExecutionContext
): Promise<QueryHomeStateOutput> {
  return homeAutomationService.queryState(input, context);
}

export const queryHomeStateTool: ToolDefinition<QueryHomeStateInput, QueryHomeStateOutput> = {
  name: "query_home_state",
  description: "查询 Home Assistant 中设备的当前状态。可按 entity_id 或 domain 查询，例如客厅灯、空调、窗帘和媒体设备。",
  riskLevel: "low",
  ownerOnly: true,
  parameters: {
    type: "object",
    properties: {
      entity_id: { type: "string", description: "可选的 Home Assistant entity_id，例如 light.living_room" },
      domain: { type: "string", description: "可选的设备 domain，例如 light、climate、cover" },
    },
  },
  enabled: true,
  runtimeAccess: () => toolAccessState(
    "owner_only",
    runtimeConfig.HOME_ASSISTANT_ENABLED && Boolean(env.HOME_ASSISTANT_BASE_URL && env.HOME_ASSISTANT_TOKEN)
  ),
  handler,
};
