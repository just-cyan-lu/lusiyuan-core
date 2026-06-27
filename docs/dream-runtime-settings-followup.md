# Dream Runtime Settings Follow-up

## 背景

这份文档记录 settings 审查中 Dream 配置的清理结果。原先暂时保留的 Dream 问题项已经在本轮处理完，不再作为 runtime settings 暴露。

## 已处理项

| 配置项 | 当前配置页含义 | 当前实际状态 | 后续整理方向 |
| --- | --- | --- | --- |
| `DREAM_MORNING_BRIEF_ENABLED` | 控制 Dream 完成后是否提供 Morning Brief。 | 已删除。Morning Brief 作为 Job 只读摘要保留，接口总是可用。 | 如果未来有权限系统或产品上确实需要隐藏，再重新设计。 |
| `DREAM_MIN_SIGNAL_SCORE` | 控制 Dream Signal 的最低强度分数。 | 已删除。`strength` 仍写入信号，但不通过配置阈值提前丢弃。 | 后续如果要做质量分层，应做成可审计规则，而不是静态配置。 |
| `DREAM_MAX_LOOKBACK_DAYS` | 限制 Dream 最多回看多少天的数据。 | 已删除。Dream 改为从上一次成功运行到本次运行的连续区间。 | 如需防止首次运行太大，应在 Dream 任务页做明确的首次初始化流程。 |

## 本轮已删除

- `REFLECTION_OWNER_ONLY`：Reflection 路由已经统一要求 admin auth，没有业务代码读取这个开关。
- `DREAM_AUTO_APPLY`：Dream 当前只生成 pending proposal，没有自动应用逻辑；保留这个开关会误导为 Dream 已支持自动写入。
- `DREAM_AUTO_RUN`：Dream 只保留总开关；`DREAM_ENABLED=true` 时按 `DREAM_CRON` 自动运行，不再需要第二个自动运行开关。
- `DREAM_TIMEZONE`：使用服务器本地时间解释 `DREAM_CRON`。
- `DREAM_DEFAULT_LOOKBACK_HOURS`、`DREAM_MAX_LOOKBACK_DAYS`、`DREAM_MIN_SOURCE_EVENTS`、`DREAM_MAX_MESSAGES`、`DREAM_MAX_TOOL_CALLS`、`DREAM_MAX_REFLECTION_REPORTS`、`DREAM_MAX_MEMORY_PROPOSALS`：连续区间完整读取后不再需要。
- `DREAM_MIN_CONFIDENCE`、`DREAM_MIN_EVIDENCE_COUNT`、`DREAM_MAX_PROPOSALS_PER_RUN`、`DREAM_DIARY_MAX_CHARS`、`DREAM_DIARY_VISIBILITY`：避免通过配置提前丢弃或截断 Dream 训练材料。
- `DREAM_REDACT_PRIVATE_DATA`：Dream 产物只在 admin 查看，暂时不做手机号、邮箱等隐私脱敏，也不因为疑似隐私内容丢弃 signal/proposal。
- `DREAM_LIGHT_ENABLED`、`DREAM_REM_ENABLED`、`DREAM_DEEP_ENABLED`、`DREAM_DIARY_ENABLED`、`DREAM_ALLOW_MEMORY_PROPOSALS`、`DREAM_ALLOW_GROWTH_LOG_PROPOSALS`：删除细分开关，`DREAM_ENABLED=true` 时固定完整运行 Dream 并生成日记、记忆提案、成长记录提案、风险项。
- `DREAM_LOCK_TTL_MINUTES`：删除配置项。Dream 运行锁不再由设置页控制；如果已有 Dream 正在运行，本次触发直接返回 `running` 并跳过，等待下一次触发。

## 后续原则

- Dream 相关配置需要和实际能力一一对应，不能只在配置页展示。
- 如果某个开关只是“未来可能会做”，先放文档，不放进 runtime settings。
- 对会影响数据写入、提案应用、历史扫描范围的配置，需要配套测试覆盖。
