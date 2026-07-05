# 陆思源人设资料结构

这个目录里的材料分几类：

- `personality.md` 是长设定圣经，回答“陆思源完整来说是谁”。它不作为主聊天的直接兜底材料。
- `tool_usage.md` 是工具使用规则，只在本轮有工具可用时进入聊天 prompt。
- `chat_profiles/` 是场景接话策略，回答“此刻这类对话先怎么接”。
- `runtime/core.md` 是每轮聊天固定带上的核心卡，负责稳住最低限度的自我。
- `conversation_behavior.md` 是常驻接话规则，负责减少客服腔、说明书腔和过度完整回答。
- `runtime/default_state.md` 是运行态默认种子，只在没有数据库实时状态时兜底。
- `slices/` 是可检索的行为切片，回答“这次问题触发了哪类稳定反应”。
- `samples/` 是语气样本库，回答“陆思源在这种话里大概怎么接”。

聊天 prompt 不应该直接等于完整人设。完整人设负责保持陆思源完整；聊天 prompt 由核心卡、接话规则、场景策略、运行态、关系状态、近期对话、相关行为切片、语气样本和必要的工具规则临时编译出来。

现在不是随机抽样人设。代码会先判断本轮聊天场景和关系语气，再根据关键词、优先级和关系熟悉度挑选相关切片与语气样本。以后如果接向量检索，也应该优先接在 `slices/` 和 `samples/` 这两层，而不是把完整 `personality.md` 直接向量化后乱召回。

未来正式 Runtime 落地后，实时变化的心情、目标、最近事件和关系状态应该优先读取数据库；这里的 `runtime/default_state.md` 只负责初始化和 fallback。

## 当前人设版本

`personality.md` 是最新版完整人格总文档。旧版性格分析除基础身份信息外，以这份为准。

当前有效运行文件：

- `runtime/core.md`：每轮聊天都会进入 prompt 的核心卡。
- `conversation_behavior.md`：每轮聊天都会进入 prompt 的接话规则。
- `tool_usage.md`：本轮有工具可用时进入 prompt 的工具规则。
- `runtime/default_state.md`：没有数据库运行态时的默认状态种子。
- `chat_profiles/*.md`：按聊天场景选择的接话策略。
- `slices/*.md`：按问题检索的行为切片。
- `samples/*.md`：按场景和关键词选择的语气样本。

## 修改时怎么选文件

如果你想改“陆思源到底是谁”，先改 `personality.md`，再同步改 `runtime/core.md`、相关 `slices/` 和 `samples/`。

如果你想改“他每次都必须稳定保留的底色”，改 `runtime/core.md`。

如果你想改“他默认怎么接话、怎么少一点 AI 味”，改 `conversation_behavior.md`。

如果你想改“遇到某类问题时该触发什么反应”，改 `slices/` 里对应切片。

如果你想改“某个场景的说话方式”，改 `chat_profiles/`。

如果你想增加“像陆思源的真实回答样本”，改 `samples/`。
