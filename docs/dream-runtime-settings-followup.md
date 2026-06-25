# Dream Runtime Settings Follow-up

## 背景

这份文档记录本次 settings 清理后暂时保留的 3 个 Dream 相关配置。它们目前都还没有完整接入业务行为，但语义和后续 Dream 功能整理有关，因此先不删除。

## 保留项

| 配置项 | 当前配置页含义 | 当前实际状态 | 后续整理方向 |
| --- | --- | --- | --- |
| `DREAM_MORNING_BRIEF_ENABLED` | 控制 Dream 完成后是否提供 Morning Brief。 | Morning Brief 服务和接口已经存在，但开关没有被读取；接口当前总是可用。 | 重做 Dream 时决定 Morning Brief 是固定只读报告，还是可关闭能力。如果可关闭，应在 route 或 service 层接入这个开关。 |
| `DREAM_MIN_SIGNAL_SCORE` | 控制 Dream Signal 的最低强度分数。 | `computeSignalScore` 会计算并写入 `strength`，但过滤逻辑没有使用这个阈值。 | 重做信号管线时决定是否用 `strength >= DREAM_MIN_SIGNAL_SCORE` 过滤低质量信号，或者改成更明确的评分策略。 |
| `DREAM_MAX_LOOKBACK_DAYS` | 限制 Dream 最多回看多少天的数据。 | 目前只在 admin runtime 摘要中展示，没有限制手动 `lookback_hours` 或 job 的 `from/to`。 | 重做 Dream 调度和手动运行入口时，用它 clamp 最大回看范围，避免一次扫太多历史。 |

## 本轮已删除

- `REFLECTION_OWNER_ONLY`：Reflection 路由已经统一要求 admin auth，没有业务代码读取这个开关。
- `DREAM_AUTO_APPLY`：Dream 当前只生成 pending proposal，没有自动应用逻辑；保留这个开关会误导为 Dream 已支持自动写入。

## 后续原则

- Dream 相关配置需要和实际能力一一对应，不能只在配置页展示。
- 如果某个开关只是“未来可能会做”，先放文档，不放进 runtime settings。
- 对会影响数据写入、提案应用、历史扫描范围的配置，需要配套测试覆盖。
