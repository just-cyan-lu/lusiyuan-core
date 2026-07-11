import { runtimeConfig } from "../../config/runtime-settings.service.js";
import {
  homeAutomationService,
  type ControlHomeInput,
  type ControlHomeOutput,
} from "../../home-automation/home-automation.service.js";
import { env } from "../../utils/env.js";
import { toolAccessState } from "../tool-access.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

async function handler(
  input: ControlHomeInput,
  context: ToolExecutionContext
): Promise<ControlHomeOutput> {
  return homeAutomationService.control(input, context);
}

export const controlHomeTool: ToolDefinition<ControlHomeInput, ControlHomeOutput> = {
  name: "control_home",
  description: "直接控制 Home Assistant 设备、场景或脚本。传入 domain、action，可选 target 和 data。仅在用户明确要求控制家中设备、场景或自动化时调用。",
  riskLevel: "medium",
  ownerOnly: true,
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Home Assistant domain，例如 light、climate、scene" },
      action: { type: "string", description: "要执行的 action，例如 turn_on、turn_off、set_temperature" },
      target: { type: "object", description: "可选的 HA target，例如 { entity_id: [\"light.living_room\"] }" },
      data: { type: "object", description: "可选的 action 数据，按 Home Assistant 对应 action 的参数传入" },
    },
    required: ["domain", "action"],
  },
  enabled: true,
  runtimeAccess: () => toolAccessState(
    "owner_only",
    runtimeConfig.HOME_ASSISTANT_ENABLED && Boolean(env.HOME_ASSISTANT_BASE_URL && env.HOME_ASSISTANT_TOKEN)
  ),
  handler,
};
