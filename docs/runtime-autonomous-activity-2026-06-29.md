# 运行态与自主活动重构

## 结论

运行态不再承担“陆思源正在做什么”的职责。它只保留心力、状态标签、最近事件和状态备注。

“正在做的事”改为独立的自主任务系统：任务会被创建、推进、产生产物并落库，而不是只写在 `RuntimeState.currentActivity` 这种展示字段里。

## 已完成

- `runtime_states` 删除 `currentGoal`、`currentFocus`、`currentActivity`、`updateMode`、`updateStrategy`。
- Owner 聊天不再自动写入运行态，只记录 `RuntimeEvent`，作为 Dream 或后续整理材料。
- Dream 完成后只写整理摘要和元数据，不再简单给心力 `+4`。
- 自启动检查保留心力调节：聊天太多时降心力，聊天较少时缓慢恢复。
- 新增自主任务表：
  - `autonomous_tasks`
  - `autonomous_task_runs`
  - `autonomous_artifacts`
- Admin 运行态页新增“自主任务”区域：
  - 创建任务
  - 暂停/继续/完成/放弃
  - 手动推进一步
  - 查看最近产物
- 自启动在低聊天密度时会尝试推进一个 active 自主任务；已有任务运行中则跳过。

## 当前第一版边界

- 自主任务每次只推进一小步，避免 AI 一口气把长期任务全部“想完”。
- 任务类型先分为：
  - `reading`
  - `game_research`
  - `content_creation`
  - `self_growth`
  - `open_research`
  - `custom`
- 每次推进会要求模型输出：
  - 本轮摘要
  - 本轮计划
  - 本轮产物
  - 当前进度
  - 下一步
  - 是否完成

## 后续可继续做

- 给自主任务接入工具调用，比如网页搜索、网页读取、Chrome MCP、小红书平台能力。
- 给任务添加更明确的“流程模板编辑器”，让不同任务类型有可配置步骤。
- Dream 生成候选自主任务，但先进入待审核，不直接创建 active 任务。
- 自主任务接入 running task registry，让长任务可以在运维页停止。
- 给任务产物做导出格式，方便以后作为训练数据或内容草稿库。
