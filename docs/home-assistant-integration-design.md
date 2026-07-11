# Home Assistant 智能家居接入设计

## 1. 文档状态

- 状态：设计稿
- 目标版本：智能家居功能第一版
- 适用项目：`lusiyuan-core`
- 核心结论：Home Assistant 独立部署，智能家居接入代码作为当前仓库中的独立模块实现

## 2. 背景

`lusiyuan-core` 当前是一个由 LLM 驱动的聊天机器人项目，已经具备人格、记忆、关系、Dream、渠道接入和结构化工具调用能力，但没有智能家居领域能力。

智能家居与现有记忆、关系和 Dream 的职责不同：

- 聊天机器人负责理解用户表达、选择工具并组织自然语言回复。
- Home Assistant 负责接入真实设备、维护实体状态、执行设备动作和运行自动化。
- 新增的智能家居模块负责连接两者，并隔离 Home Assistant 的接口细节。

第一版不重新实现设备协议，不直接接入米家、Matter、Zigbee、HomeKit、Hue 等厂商或协议。设备统一先接入 Home Assistant。

## 3. 已确认的设计决策

### 3.1 使用 Home Assistant

Home Assistant 作为智能家居中枢和设备状态的唯一事实来源。

选择 Home Assistant 的主要原因：

- 统一不同厂商和协议的设备模型。
- 已有成熟的实体、区域、场景、自动化和状态管理能力。
- 提供 REST API、WebSocket API、Conversation API 和 MCP Server。
- 聊天机器人不需要维护具体设备协议和厂商认证逻辑。

Home Assistant 不是聊天机器人的子模块，也不负责人格、记忆、关系或回复生成。

### 3.2 部署独立，代码同仓

Home Assistant 作为独立服务部署，可以运行在 HA OS、Docker、虚拟机或局域网内的其他主机上。

智能家居接入代码暂时放在 `lusiyuan-core` 仓库中，使用独立目录和清晰边界，不新建业务仓库或微服务。

只有后续出现以下情况时，才考虑拆出独立的 `home-gateway` 服务：

- 多个机器人或应用需要共享同一个家居网关。
- 需要把 HA 完全隔离在局域网，而机器人部署在其他网络。
- 出现多家庭、多租户需求。
- 智能家居模块需要独立发布、伸缩或故障隔离。

### 3.3 不增加操作确认

第一版不实现以下交互：

```text
准备将客厅空调设为 18℃，确认吗？
```

用户发出控制请求后，只要调用者具有权限并且 Home Assistant 接受该动作，就直接执行。

不新增：

- 待确认操作记录。
- “确认/取消”对话状态。
- 一次性确认令牌。
- `requiresApproval` 对应的审批流程。

### 3.4 不增加业务参数范围限制

智能家居模块不自行规定空调温度、灯光亮度、音量等业务参数范围。

模块只做调用所必需的基础处理：

- 输入必须是可解析的对象。
- 必填字段存在。
- 字段类型能够转换为 Home Assistant 请求。
- 不允许构造任意 URL、请求头或非预期的网络目标。

具体设备是否支持某个动作或参数值，由 Home Assistant 和对应设备集成判断。Home Assistant 返回的失败信息由工具转换后交给 LLM 组织回复。

### 3.5 不修改聊天编排层

不修改 `src/core/chat.service.ts` 中现有的：

- Prompt 材料准备流程。
- LLM function calling 循环。
- 多轮工具调用方式。
- 工具结果回填方式。
- 回复生成与分段方式。
- 原有工具的调用次数和行为。

HA 工具通过现有 `ToolDefinition`、`ToolRegistry` 和 `ToolExecutor` 接入。

为了让现有工具候选路由能够发现 HA 工具，需要登记智能家居意图和对应工具名；这属于新增工具的注册配置，不改变聊天编排算法，也不改变任何已有工具的路由规则。

## 4. `ActionPolicy` 与 `requiresApproval`

`ActionPolicy` 和 `requiresApproval` 不是两个并列的功能模块。

- `ActionPolicy` 是工具执行前的权限检查器。
- `requiresApproval` 是 `PolicyDecision` 返回对象中的一个布尔字段。

当前 `ActionPolicy` 只检查：

1. 工具是否启用。
2. `ownerOnly` 工具是否由 Owner 调用。

当前所有允许执行的工具都会返回：

```ts
{
  allowed: true,
  requiresApproval: false
}
```

本设计不修改 `ActionPolicy`，也不使用 `requiresApproval`。HA 控制工具和其他工具一样，在 `allowed: true` 时直接进入 handler 执行。

## 5. 总体架构

```text
Telegram / 微信 / Web
          │
          ▼
  lusiyuan-core 聊天流程
          │
          ▼
现有 ToolRegistry / ToolExecutor
          │
          ▼
  home-automation 独立模块
    ├── HA 查询工具
    ├── HA 控制工具
    ├── 单轮调用预算
    ├── 幂等保护
    └── Home Assistant Client
          │
          ▼
     Home Assistant
          │
          ▼
灯、空调、窗帘、媒体设备、传感器、场景和自动化
```

## 6. 模块边界

建议新增目录：

```text
src/home-automation/
  home-automation.types.ts
  home-automation.service.ts
  home-tool-execution-guard.ts
  home-action-idempotency.ts
  home-assistant/
    home-assistant-client.ts
    home-assistant.types.ts
    home-assistant-error.ts
  tools/
    query-home-state.tool.ts
    control-home.tool.ts
```

各组件职责如下。

### 6.1 `home-assistant-client.ts`

只负责 Home Assistant 协议通信：

- 认证。
- 请求超时。
- 查询实体状态。
- 调用 action/service。
- 把 HA HTTP 错误转换为统一异常。
- 隐藏 Token，避免写入普通日志或工具返回值。

它不负责：

- 判断是否由 Owner 调用。
- 理解自然语言。
- 生成聊天回复。
- 保存机器人记忆。
- 决定调用次数。

### 6.2 `home-automation.service.ts`

作为应用层入口：

- 接收结构化查询或控制请求。
- 调用单轮预算和幂等组件。
- 把领域请求转换为 HA 调用。
- 返回适合工具层消费的结构化结果。

### 6.3 `home-tool-execution-guard.ts`

只限制 HA 工具，不修改全局工具循环。

建议以 `ToolExecutionContext.messageId` 作为一次用户消息的标识。每次执行 HA 工具时累计计数：

```text
key = messageId
value = {
  totalHaCalls,
  mutationCalls,
  expiresAt
}
```

建议默认配置：

```text
HOME_ASSISTANT_MAX_CALLS_PER_TURN=3
HOME_ASSISTANT_MAX_MUTATIONS_PER_TURN=2
```

含义：

- 一条用户消息最多实际访问 HA 三次。
- 一条用户消息最多执行两次状态变更。
- 超限后 HA 工具返回结构化错误，不再访问 HA。
- 记忆搜索、网页读取等现有工具完全不受影响。

计数可以先保存在进程内存中，并设置短 TTL 自动清理。第一版不必为它新增数据库表。

该限制只能保证 HA 不再被实际调用，不负责终止外层 LLM 工具循环。按照“不修改聊天编排层”的约束，外层循环保持现状。

### 6.4 `home-action-idempotency.ts`

防止同一条用户消息中的相同动作被重复发送给 HA。

建议幂等键：

```text
messageId + toolName + normalizedInput
```

同一个幂等键再次出现时：

- 不再次访问 HA。
- 返回第一次执行的结果。
- 该次命中不再访问 HA，也不消耗额外的 HA 工具调用预算。

第一版可以使用带 TTL 的进程内缓存。未来如果部署多个 `lusiyuan-core` 实例，再迁移到 Redis 或数据库。

## 7. 工具设计

第一版提供两个工具，不把 HA 的所有底层 service 直接暴露给 LLM。

### 7.1 `query_home_state`

用途：查询 Home Assistant 中的设备状态。

建议输入：

```json
{
  "entity_id": "light.living_room",
  "domain": "light"
}
```

所有字段均可选，允许按实体或 domain 查询。第一版不按区域查询；区域到实体的解析留待后续接入 HA 实体注册表或 WebSocket 后再实现。

建议属性：

```ts
{
  name: "query_home_state",
  riskLevel: "low",
  ownerOnly: true
}
```

建议输出：

```json
{
  "entities": [
    {
      "entity_id": "light.living_room",
      "name": "客厅灯",
      "state": "on",
      "attributes": {
        "brightness": 180
      }
    }
  ]
}
```

返回属性应进行体积裁剪，避免把 HA 中无关的大字段全部送回 LLM。

### 7.2 `control_home`

用途：调用 Home Assistant action/service，直接改变设备状态或执行场景、脚本和自动化动作。

建议输入：

```json
{
  "domain": "light",
  "action": "turn_on",
  "target": {
    "entity_id": ["light.living_room"]
  },
  "data": {
    "brightness_pct": 60
  }
}
```

也允许调用场景：

```json
{
  "domain": "scene",
  "action": "turn_on",
  "target": {
    "entity_id": ["scene.sleep_mode"]
  },
  "data": {}
}
```

建议属性：

```ts
{
  name: "control_home",
  riskLevel: "medium",
  ownerOnly: true
}
```

该工具不进行二次确认。通过现有 Owner 判定后直接调用 HA。

建议输出：

```json
{
  "executed": true,
  "domain": "light",
  "action": "turn_on",
  "targets": ["light.living_room"],
  "response": {}
}
```

## 8. 权限与暴露范围

第一版两个 HA 工具都设置为 `ownerOnly: true`。

权限边界分两层：

1. `lusiyuan-core` 使用现有 Owner 身份判断，决定是否向当前对话暴露和执行 HA 工具。
2. Home Assistant 使用专用账号和 Token，决定该连接可以访问的 HA 能力。

不新增聊天确认，但仍建议通过配置控制允许调用的 HA domain：

```text
HOME_ASSISTANT_ALLOWED_DOMAINS=light,switch,climate,cover,media_player,scene,script
```

这不是参数范围校验，而是确定第一版提供哪些控制功能。未配置的 domain 不会被 `control_home` 转发给 Home Assistant；查询工具不受该列表限制。

如果希望完全信任 Owner 并开放 HA 的全部 domain，可以提供显式配置：

```text
HOME_ASSISTANT_ALLOWED_DOMAINS=*
```

默认值建议采用有限列表，是否改成 `*` 由部署者决定。

## 9. Home Assistant 接口选择

### 9.1 第一版使用 REST API

第一版使用 Home Assistant REST API：

- `GET /api/states`：读取实体状态。
- `GET /api/states/{entity_id}`：读取单个实体状态。
- `POST /api/services/{domain}/{service}`：执行动作。

请求使用：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

选择 REST 的原因：

- 实现简单。
- 和当前 TypeScript/Fastify 项目兼容。
- 结构化动作容易记录和测试。
- 不需要新增常驻连接管理。
- 不需要修改当前 LLM 或聊天编排流程。

官方文档：<https://developers.home-assistant.io/docs/api/rest/>

### 9.2 WebSocket 作为后续能力

当需要主动接收设备事件时，再增加 WebSocket 客户端：

- 设备状态变化。
- 传感器告警。
- 自动化完成。
- 设备上线或离线。

WebSocket 事件不应默认写入长期记忆。是否进入 runtime、通知或记忆系统，应在后续功能中单独设计。

官方文档：<https://developers.home-assistant.io/docs/api/websocket/>

### 9.3 第一版不使用 MCP

Home Assistant 官方 MCP Server 使用 Streamable HTTP，当前项目里的 `StdioMcpClient` 面向本地 stdio 子进程，不能直接连接。

第一版不为了 HA 改造 MCP 基础设施。未来如果需要动态发现 HA 工具或直接使用 Assist API，可以新增独立的 Streamable HTTP MCP client，但不替换本设计中的权限、调用预算和幂等边界。

官方文档：<https://www.home-assistant.io/integrations/mcp_server>

## 10. 配置设计

建议新增运行配置：

```text
HOME_ASSISTANT_ENABLED=false
HOME_ASSISTANT_ALLOWED_DOMAINS=light,switch,climate,cover,media_player,scene,script
HOME_ASSISTANT_MAX_CALLS_PER_TURN=3
HOME_ASSISTANT_MAX_MUTATIONS_PER_TURN=2
```

连接地址和 Token 是启动密钥，只从环境变量读取：

```text
HOME_ASSISTANT_BASE_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=
```

配置要求：

- `BASE_URL` 在启动时解析为固定 URL。
- 每次请求只能访问该固定 origin，工具输入不能覆盖 URL。
- Token 不进入工具参数、Prompt、普通日志或 API 返回。
- 未配置或连接失败时，HA 工具应显示为不可用或返回明确错误。

## 11. 错误处理

统一错误类型建议包括：

- `HomeAssistantNotConfiguredError`
- `HomeAssistantUnavailableError`
- `HomeAssistantAuthenticationError`
- `HomeAssistantRequestTimeoutError`
- `HomeAssistantActionError`
- `HomeAssistantCallBudgetExceededError`

工具层只返回必要的信息：

```json
{
  "ok": false,
  "code": "HOME_ASSISTANT_ACTION_FAILED",
  "message": "Home Assistant 拒绝了该设备操作"
}
```

不要返回：

- Access Token。
- 完整请求头。
- 包含凭证的 URL。
- 不必要的 HA 内部堆栈。

## 12. 日志与审计

复用现有 `ToolExecutor` 和 `ToolCallLog`，不新增一套平行日志系统。

现有日志会记录：

- 工具名。
- 成功、失败或阻止状态。
- 执行耗时。
- 用户、会话和消息标识。
- HA 调用产生的简化错误。

Token 永远不记录。

如果现有工具日志策略不记录输入和输出，则保持现状，不为 HA 单独改变全局日志策略。幂等命中和预算拦截目前只作为工具结果返回，不新增单独的审计字段。

## 13. 与现有项目的接入点

第一版只需要以下接入：

1. 在运行配置 registry 中登记 HA 配置。
2. 在 builtin tool 注册入口登记两个 HA 工具。
3. 在工具候选路由中新增智能家居意图到 HA 工具名的映射。
4. 新增 `src/home-automation/` 模块。
5. 新增 HA 模块自身测试。

明确不修改：

- `src/core/chat.service.ts` 的工具循环。
- `src/core/model-provider.ts`。
- 现有三个 builtin tool 的实现。
- 记忆、关系、Dream 和 runtime 状态逻辑。
- 现有工具的调用次数限制。

## 14. 测试方案

### 14.1 Client 单元测试

- 正确附加 Bearer Token。
- 正确拼接固定 HA URL。
- 正确读取单实体和实体列表。
- 正确发送 domain、service、target 和 data。
- 401、403、404、超时和 5xx 转换为统一错误。
- 错误和日志中不出现 Token。

### 14.2 工具测试

- 非 Owner 看不到或不能执行 HA 工具。
- Owner 可以查询状态。
- Owner 可以直接执行控制动作，不产生确认步骤。
- HA 错误能被转换为结构化工具错误。
- 原有工具注册和执行不受影响。

### 14.3 HA 调用预算测试

- 同一 `messageId` 在预算内正常执行。
- 超过 HA 总调用次数后不再请求 HA。
- 超过 mutation 次数后查询仍按配置决定是否可用。
- 不同 `messageId` 使用独立预算。
- 计数过期后自动清理。
- 记忆、网页等工具不受 HA 预算影响。

### 14.4 幂等测试

- 相同消息、相同动作只实际调用 HA 一次。
- 重复调用返回第一次结果。
- 相同消息的不同动作可以分别执行。
- 不同消息中的相同动作正常执行。

### 14.5 集成测试

建议用模拟 HA HTTP Server 验证：

1. 用户说“打开客厅灯”。
2. LLM 选择 `control_home`。
3. 工具发送一次 HA REST 请求。
4. HA 返回成功。
5. LLM 根据结构化结果回复用户。

测试不依赖真实家电，真实 HA 只用于最后的手动验收。

## 15. 实施顺序

### 阶段一：连接与只读查询

- 增加配置。
- 实现 REST client。
- 实现 `query_home_state`。
- 完成连接检查、错误转换和测试。

### 阶段二：直接控制

- 实现 `control_home`。
- 接入 Owner 权限。
- 接入 HA domain 配置。
- 不增加确认流程。

### 阶段三：HA 局部保护

- 实现 HA 单轮调用预算。
- 实现操作幂等。
- 保证所有限制只作用于 HA 工具。

### 阶段四：管理界面

admin 页面可以展示：

- HA 是否启用。
- HA 连接是否正常。
- HA 版本。
- 当前允许的 domain。
- HA 工具最近调用记录。

第一版不在 admin 中重新实现完整的设备管理页面。设备、区域、场景和自动化继续由 Home Assistant 管理。

### 阶段五：可选实时事件

- 接入 WebSocket。
- 订阅必要事件。
- 单独设计事件进入 runtime、主动消息或长期记忆的规则。

## 16. 验收标准

第一版完成时应满足：

- Home Assistant 与 `lusiyuan-core` 独立部署。
- Owner 可以通过自然语言查询 HA 状态。
- Owner 可以通过自然语言直接控制已支持的 HA 设备或场景。
- 控制过程中没有额外确认对话。
- 智能家居模块不自行限制空调温度等业务参数范围。
- HA 重复调用受到模块内预算和幂等保护。
- 现有聊天编排、记忆、关系、Dream 和原有工具行为不变。
- HA Token 不会进入 Prompt、工具输出或普通日志。
- HA 不可用时聊天服务仍可正常处理不涉及智能家居的消息。

## 17. 暂不实现

第一版明确不实现：

- 自研设备协议或厂商适配。
- 操作前确认和审批。
- 空调温度、音量等业务参数范围限制。
- 修改全局工具循环最大次数。
- 把 HA 事件自动写入长期记忆。
- 在本项目中复制 HA 的设备管理后台。
- Home Assistant MCP client。
- 独立的智能家居微服务或新仓库。
