# Flows

这里讲“调用逻辑”。先看这份，再去读具体代码会轻松很多。

## 用户发一条消息

```text
用户 / 网页 / Telegram / 微信
↓
渠道层统一成 ChatInput
↓
chat.service.ts
↓
安全检查
↓
写入 User / Conversation / Message
↓
读取 persona
↓
检索相关长期记忆
↓
读取最近对话
↓
选择聊天投影
↓
编译 prompt
↓
调用模型
↓
如果模型要用工具，就执行工具再让模型继续回复
↓
清理输出
↓
保存陆思源回复
↓
返回给用户
```

## Prompt 是怎么来的

以前容易理解成：

```text
完整人设 + 记忆 + 对话 = prompt
```

现在更准确是：

```text
完整人设
↓
runtime/core 提供每轮固定核心
↓
persona-projection 判断本轮聊天场景
↓
persona-projection 挑选本轮需要的人设切片
↓
chat_profile 决定当前场景怎么说话
↓
runtime default_state 提供默认状态种子
↓
记忆和最近对话提供连续性
↓
prompt-builder 生成最终 prompt
```

重点：完整人设仍然完整保存，但日常聊天不会直接全量塞给模型。现在的切片选择不是随机抽样，而是看聊天投影、关键词和切片优先级。以后如果接向量检索，也应该在切片层接入。

## 记忆是怎么进入聊天的

```text
Memory 表
↓
如果语义检索关闭：按重要度和更新时间取一批
如果语义检索开启：embedding + pgvector 找相关记忆
↓
memory-budget 限制数量和总字数
↓
进入 prompt
```

记忆读取和记忆写入是两件事。

- 读取：聊天时自动发生。
- 写入：手动添加，或由 Reflection / Dream 生成提案后审核应用。

## Reflection 是怎么更新记忆的

```text
手动或定时触发 Reflection
↓
读取历史消息和现有记忆
↓
模型生成报告
↓
生成 MemoryProposal
↓
owner 审核
↓
apply 后写入 Memory
```

Reflection 的定位是“复盘员”，不是聊天时的即时大脑。

admin 的“Reflection”页面可以手动触发这一流程，并直接查看报告、提案、风险项和成长日志。

## Dream Cycle 是怎么更新记忆的

```text
手动或定时触发 Dream
↓
收集最近消息、记忆、工具调用、Reflection 报告
↓
DailyNote：整理当天发生了什么
↓
DreamSignal：提取值得关注的信号
↓
DreamDiary：写内在日记
↓
Deep Sleep：生成 MemoryProposal
↓
owner 审核后写入 Memory
```

Dream 的定位是“闲时整理”，不是事实来源。DreamDiary 不能直接当成真实记忆。

admin 的“Dream”页面可以手动触发这一流程，并查看作业状态、Morning Brief、Deep Sleep、Daily Note、Dream Signal 和 Dream Diary。

## 工具调用是怎么走的

```text
聊天 prompt 里告诉模型可用工具
↓
模型提出 tool_call
↓
tool-executor 检查工具、权限、风险
↓
执行工具
↓
工具结果回到模型上下文
↓
模型生成最终回复
```

工具分低风险、中风险、高风险，也可能 owner only。不是所有用户都能让陆思源执行所有工具。

## 小红书回复 Skill 是怎么走的

```text
owner 在小红书工作台粘贴帖子 URL
↓
chrome-devtools-mcp 自动连接当前 Chrome
↓
chrome-devtools-mcp 查找同一帖子页面
↓
已有页面则复用；没有才新开，并保持至少 15 秒间隔
↓
随机等待 3–5 秒让页面稳定，再定向读取 DOM
↓
保存标题、文案、作者、配图 Alt 占位和当前已加载评论
↓
页面留在 Chrome，不刷新、不滚动、不展开、不关闭
↓
owner 可以修正导入内容
↓
小红书工作台 / admin Skills 测试
↓
读取 xiaohongshu_reply skill 状态
↓
读取小红书帖子和评论上下文
↓
检索少量同平台、同场景的相似表达经验
↓
如果 skill 关闭：停止生成
↓
LLM 按 prompt 判断评论类型、风险、是否需要回复、回复口吻
↓
skip：建议不回复
↓
review：生成草稿但需要 owner 审核
↓
ready：生成风险较低、可人工采用的草稿
↓
保存 XiaohongshuReplyDraft
↓
owner 可以修改并保存草稿正文
↓
owner 记录最终发布回复，或明确决定不回复
↓
保留思源原稿和 owner 最终决定
↓
LLM 提炼表达经验，程序保存并建立向量索引
↓
以后生成相似回复时参与检索
```

这条流程不自动发送。真实最终回复仍由 owner 手动记录，或者由后续同步结果写入；表达学习只根据最终决定更新。

## Runtime Lite 当前怎么接入

当前聊天链路已经接入第一版数据库 RuntimeState：

- `chat_profiles/`：稳定聊天投影。
- `runtime/default_state.md`：默认状态种子。
- `persona-projection.ts`：Prompt Compiler 雏形。
- `RuntimeState`：保存全局心情、精力、压力、当前目标、最近关注和正在做的事。
- `RuntimeEvent`：保存聊天、复盘、梦境、自启动检查这些“发生过的事”。
- `RuntimeStateEvent`：只保存真正写入 RuntimeState 的状态变化记录。
- `PersonIdentity` / `IdentityLink`：把渠道账号绑定到现实身份，绑定后共享关系状态。
- `IdentityLinkProposal`：系统怀疑两个渠道账号可能是同一个人，但等待 admin 审核。
- `RelationshipState`：保存陆思源和每个现实身份之间的熟悉度、信任度、亲近感和关系张力。
- `RelationshipStateEvent`：保存关系状态变化记录。
- 更新策略：`rules` 是规则校准；`llm` 是 LLM 提议 statePatch，再由程序校验。它只在允许改长期状态的入口生效。

当前流程是：

```text
用户消息
↓
读取 RuntimeState
↓
读取 RelationshipState
↓
编译 prompt 并生成回复
↓
保存回复
↓
写 RuntimeEvent：记录这轮聊天发生了什么
↓
写 RelationshipStateEvent：记录这轮聊天里的关系信号
↓
如果关系信号达到阈值，或 admin 手动复盘：更新这个现实身份的 RelationshipState
↓
如果消息或显示名像已有身份，写 IdentityLinkProposal，等待 admin 审核
↓
如果不是 owner：不改 RuntimeState，等待复盘或梦境整理
↓
如果是 owner 且允许自动校准：按 rules / llm 更新 RuntimeState
↓
写 RuntimeStateEvent
```

写 RuntimeStateEvent 时会顺手记录来源。单轮 owner 对话会记录对应的聊天事件和消息；Reflection / Dream 这种整理型入口会记录它们实际看过的多条消息；autonomy tick 如果因为连续聊天变累，会记录最近一批聊天事件。

admin 里点开某次 RuntimeStateEvent 后，会按这些来源 ID 读取对应的 RuntimeEvent 和 Message，直接显示状态变化背后的材料。

Reflection 完成后也会写 RuntimeEvent，并在允许自动校准时更新 RuntimeState。Dream Cycle 完成后同理。autonomy tick 会根据时间流逝和聊天密度判断：长时间没人聊会更想说话，连续聊天太多会变累。

如果策略是 `llm`，LLM 只负责提议；程序会限制可写字段、文本长度、数值范围和单次变化幅度。下一步才是把 RelationshipState 接入更深的 Reflection 总结，以及更细的长期目标、自我叙事拆分。
