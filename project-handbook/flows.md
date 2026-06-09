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
persona-projection 选择本轮需要的切片
↓
chat_profile 决定当前场景怎么说话
↓
runtime default_state 提供默认状态种子
↓
记忆和最近对话提供连续性
↓
prompt-builder 生成最终 prompt
```

重点：完整人设仍然完整保存，但日常聊天不会直接全量塞给模型。

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

## Dream Cycle 是怎么更新记忆的

```text
手动或定时触发 Dream
↓
收集最近消息、记忆、工具调用、草稿、Reflection 报告
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

## 草稿是怎么产生的

```text
模型调用 create_draft 工具
↓
Draft 表保存内容
↓
不会自动发送
↓
owner 后续查看、修改、批准或丢弃
```

草稿适合内容创作和回复预案，不适合自动代表陆思源对外行动。

## Runtime Lite 将来怎么接入

当前聊天链路还没有真正的数据库 RuntimeState。已经有的是：

- `chat_profiles/`：稳定聊天投影。
- `runtime/default_state.md`：默认状态种子。
- `persona-projection.ts`：Prompt Compiler 雏形。

正式 Runtime Lite 接入后，流程会变成：

```text
用户消息
↓
RuntimeEvent 入库
↓
Perception 识别事件
↓
程序校验并更新 RuntimeState / RelationshipState
↓
再进入当前 prompt 编译和聊天回复
```

也就是说，LLM 不直接改状态；它只提议，程序决定是否接受。
