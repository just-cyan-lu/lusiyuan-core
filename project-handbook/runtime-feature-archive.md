# Runtime Feature Archive

这份文档记录最近做进项目里的“持续性主体”相关功能。

它不是完整技术文档，也不是历史流水账。它的作用是：以后你长期使用、测试效果、提出修改时，可以先用这里定位“当时是怎么做的、入口在哪里、应该改哪一块”。

## 1. RuntimeState：陆思源整体现在怎么样

**做了什么**

数据库里有一份全局 `RuntimeState`，保存陆思源当前的心情、精力、压力、社交电量、当前目标、当前关注、正在做的事和最近事件。

**为什么这样做**

这些东西会实时变化，不能只写在 md 人设里。md 适合稳定设定，数据库适合保存“现在的陆思源”。

**怎么变化**

普通聊天默认只记录事件，不直接改全局状态。

真正能改 `RuntimeState` 的入口是：

- owner 对话
- Reflection 复盘
- Dream Cycle 梦境整理
- autonomy tick 自启动检查
- admin 手动修改

**以后要改看哪里**

- `src/runtime/runtime-state.service.ts`
- `src/runtime/runtime-autonomy-scheduler.ts`
- `web/src/components/admin/RuntimeStatePage.tsx`
- `project-handbook/runtime-lite-design.md`

## 2. RuntimeEvent：发生过什么

**做了什么**

聊天、Reflection、Dream、自启动检查都会写 `RuntimeEvent`。它记录这次发生了什么、来源、重要度、情绪/精力/压力/社交信号，以及这次事件是否允许影响长期状态。

**为什么这样做**

陆思源要像一个持续存在的主体，就不能只看当前消息。`RuntimeEvent` 是他最近经历的事件池，后续复盘、梦境、自启动都可以从这里读材料。

**怎么变化**

普通聊天会写事件，但不会直接改全局状态。复盘、梦境或自启动再决定哪些事件真的值得影响状态。

**以后要改看哪里**

- `src/runtime/runtime-state.service.ts`
- `src/core/chat.service.ts`
- `src/reflection/`
- `src/dream/`

## 3. RuntimeStateEvent：状态真正什么时候变了

**做了什么**

`RuntimeStateEvent` 只记录“长期运行态真的被写入”的变化。它和 `RuntimeEvent` 不一样。

**区别**

- `RuntimeEvent`：发生了什么。
- `RuntimeStateEvent`：状态什么时候、为什么真的变了。
- `sourceRuntimeEventIds` / `sourceMessageIds`：这次变化明确来自哪些运行事件和消息；如果一次复盘或梦境用了很多条消息，这里会保存多条来源。

**为什么这样做**

这样可以避免“聊一句就把心情改掉”。聊天先成为事件，只有被允许的入口才会把事件整理成状态变化。

**以后要改看哪里**

- `src/runtime/runtime-state.service.ts`
- `web/src/components/admin/RuntimeStatePage.tsx`

## 4. Autonomy Tick：没人聊天时也会自我检查

**做了什么**

系统有一个自启动检查入口。它会看最近聊天密度和距离上次聊天的时间。

现在的方向是：

- 一直聊天：社交电量可能下降，更容易累。
- 长时间没人聊天：可能更想说话，或者把关注转向自己的事情。

**为什么这样做**

这让陆思源不是只有被调用时才存在。他可以在没有用户消息的时候，根据最近状态做一次轻量整理。

**怎么触发**

- admin 页面可以手动触发。
- 在 Admin 运行配置里开启“运行态自启动”后可以定时运行，保存后立即重排任务。

**以后要改看哪里**

- `src/runtime/runtime-autonomy-scheduler.ts`
- `src/runtime/runtime-state.service.ts`
- `web/src/components/admin/RuntimeStatePage.tsx`

## 5. RelationshipState：陆思源和某个现实身份的关系

**做了什么**

每个现实身份有一份 `RelationshipState`，记录熟悉度、信任度、亲近感、关系张力、互动风格、关系摘要和最近信号。

**为什么这样做**

这和全局 `RuntimeState` 不一样。`RuntimeState` 是“陆思源整体现在怎么样”，`RelationshipState` 是“陆思源和这个人现在是什么关系”。

所以普通用户的聊天不应该乱改陆思源整体心情，但可以影响“和这个人的关系”。

**现在怎么变化**

默认是复盘式更新：

1. 聊天后先写一条 `chat_relationship_signal`。
2. 这条信号只表示“这轮互动里出现了什么关系迹象”，不直接改最终关系。
3. 未复盘信号达到阈值后，程序会自动做一次关系复盘。
4. admin 也可以在关系页手动点“复盘”。
5. 复盘后才真正写 `relationship_review_update`，更新 `RelationshipState`。

**为什么不用每轮聊天直接改**

因为人和人的关系不应该被某一句话马上拉高或拉低。现在的设计是：聊天产生证据，复盘决定关系变化。

**可切换模式**

Admin 运行配置里：

- `RELATIONSHIP_UPDATE_MODE=review`：默认模式，先记录信号再复盘。
- `RELATIONSHIP_UPDATE_MODE=immediate`：旧模式，每轮聊天直接小幅更新。
- `RELATIONSHIP_REVIEW_MIN_SIGNALS=4`：默认 4 条信号触发一次自动复盘。

**以后要改看哪里**

- `src/runtime/relationship-state.service.ts`
- `src/routes/admin.route.ts`
- `web/src/components/admin/RelationshipStatePage.tsx`
- `tests/relationship-state.test.ts`

## 6. PersonIdentity：跨渠道同一个现实用户

**做了什么**

项目区分 `User` 和 `PersonIdentity`。

- `User`：一个渠道账号，比如 `telegram:123`、`weixin:abc`、`web:uuid`。
- `PersonIdentity`：现实层面的同一个人。
- `IdentityLink`：把一个渠道账号绑定到一个现实身份。

新用户默认会生成一个只包含自己的 `PersonIdentity`。

**为什么这样做**

同一个人可能在不同渠道找陆思源聊天。如果不合并，关系状态会分散；如果自动合并，又容易误判。所以现在只允许 admin 确认后合并。

**以后要改看哪里**

- `src/runtime/relationship-state.service.ts`
- `prisma/schema.prisma`
- `web/src/components/admin/RelationshipStatePage.tsx`

## 7. IdentityLinkProposal：系统只怀疑，不自动确认

**做了什么**

如果用户明确说“我是某某”，或者显示名和已有身份相似，系统会写一条 `IdentityLinkProposal`。

这只是怀疑，不会自动合并身份，也不会自动共享关系状态。

**admin 做什么**

admin 可以：

- 通过：确认是同一个现实用户，合并到同一个 `PersonIdentity`，关系状态也同步到这个身份上。
- 忽略：保留为不同用户。

**为什么这样做**

现实身份判断风险比较高。系统可以辅助发现线索，但最终确认权留给 admin。

**以后要改看哪里**

- `src/runtime/relationship-state.service.ts`
- `web/src/components/admin/RelationshipStatePage.tsx`

## 8. Admin 可视化和控制

**做了什么**

admin 里已经有几块和持续性主体相关的页面：

- 运行态页面：看心情、精力、压力、社交电量、当前目标、最近事件，也能手动调整和触发自启动检查。
- 运行事件解释：运行态页里的运行事件可以点开，看这件事是什么、有没有资格影响长期状态，以及最近是否找到对应状态写入。
- 关系页面：看每个现实身份的关系状态、关系事件、身份怀疑，能手动复盘、绑定渠道账号、修改和重置关系。
- 对话追溯页面：按现实身份查看渠道账号、会话和消息；它只看原始证据，不做关系修改。
- Reflection / Dream 工作台：手动触发复盘或梦境循环，查看报告、作业状态、Morning Brief、Deep Sleep、Daily Note、Signal 和内在日记。
- 状态变化解释：运行态和关系页里的变更记录可以点开，看这次为什么写入、变化前后差异、程序准备写入的内容和原始记录。
- 来源材料追溯：运行态的状态变化还能继续看到它引用过的运行事件和消息内容，用来判断这次变化是不是真的有依据。
- Skill 管理：查看 skill 卡牌、进入小红书回复详情、编辑 prompt 规范。
- 配置中心：日常运行配置保存到数据库并立即生效；连接密钥保留在 `.env`；页面也展示配置变更记录和开发期清库入口。

这里有两个重要分工：运行事件解释只看“发生了什么、能不能影响状态”；状态变化解释只看“最终写入后，状态实际改了什么”。关系页面负责修改和复盘关系；对话追溯页面只负责查看消息证据。不要把这些页面做成重复功能。

**为什么这样做**

这些状态需要长期试用，不可能只靠看数据库。admin 是你观察“他最近怎么样、和谁关系怎么样、为什么变成这样”的控制台。

**以后要改看哪里**

- `web/src/components/admin/RuntimeStatePage.tsx`
- `web/src/components/admin/RuntimeStateSourceMaterials.tsx`
- `web/src/components/admin/RuntimeEventDetail.tsx`
- `web/src/components/admin/RelationshipStatePage.tsx`
- `web/src/components/admin/ConversationHistoryPage.tsx`
- `web/src/components/admin/OpsPage.tsx`
- `web/src/components/admin/StateChangeDetail.tsx`
- `web/src/components/admin/AdminDetailPrimitives.tsx`
- `web/src/components/admin/ConfigCenterPage.tsx`
- `web/src/components/admin/SkillsAdminPage.tsx`
- `src/routes/admin.route.ts`

## 9. 清空数据库测试数据

**做了什么**

配置中心有“清空数据库业务数据”的功能。它需要 Admin Token、`.env` 里的 `ADMIN_DATABASE_CLEAR_PASSWORD`，还要输入确认文字。

**会清什么**

会清聊天、用户、记忆、运行态、关系状态、Dream/Reflection 产物、工具日志和页面快照。

**不会清什么**

不会清 `SystemSetting`、`SystemSettingEvent`、`SkillConfig`、`.env`、persona、人设资料、项目手册和 Prisma migration 记录。

**为什么这样做**

现在还在长期测试阶段，容易产生垃圾数据。这个功能方便重置业务数据，但不破坏项目代码和配置。

**以后要改看哪里**

- `src/routes/admin.route.ts`
- `web/src/components/admin/ConfigCenterPage.tsx`
- `.env.example`

## 10. Prisma migration 压缩

**做了什么**

开发期把旧的一堆 migration 压成了一个新的 init migration。

**为什么这样做**

当前项目还没正式上线，数据库可以重置。压缩后，新环境只需要从当前 schema 初始化，不用背一堆早期试错记录。

**以后要注意**

一旦正式有不能丢的数据，就不要随便重写 migration 历史了。那时 migration 就是真正的数据库演进记录。

**以后要改看哪里**

- `prisma/schema.prisma`
- `prisma/migrations/`

## 11. Memory Center：记忆库和记忆提案审核

**做了什么**

admin 里有一个“记忆管理”入口，分成两页：

- 记忆库：查看已经生效的长期记忆，支持筛选、搜索、热力图、新增、编辑和归档。
- 提案审核：查看 Reflection / Dream 生成的 `MemoryProposal`，支持筛选、批准、拒绝、应用、全局应用、撤回和批量处理。

**为什么这样做**

长期测试时，最容易影响陆思源表现的是“他到底记住了什么”。如果记忆提案堆在数据库里不审核，系统会停在半自动状态；如果错误记忆进入长期记忆，他后续聊天会被污染。

**现在怎么用**

提案审核页可以按状态、风险、提案类型、范围和关键词筛选。

常用流程：

1. 先看“待审核”。
2. 优先处理低风险、用户范围的提案。
3. 对确定有用的提案，可以“批准并应用”。
4. 不确定的提案可以“仅批准”，以后再应用。
5. 错误或不值得保存的提案可以拒绝，并写拒绝原因。
6. 提案应用后，可以点“查看已应用记忆”跳到记忆库确认实际写入结果。

批量按钮只作用于当前筛选结果：

- “批准当前待审”：把当前筛选下的 pending 提案批量批准，但不写入记忆。
- “应用当前已批准”：把当前筛选下的 approved 提案批量应用到各自用户记忆。

**要注意**

“全局应用”会写成全局记忆，会影响所有用户，应该更谨慎。普通用户偏好、关系细节、个人事实一般不应该全局应用。

**以后要改看哪里**

- `web/src/components/admin/MemoryAdminPage.tsx`
- `web/src/components/admin/MemoryLibraryPage.tsx`
- `web/src/components/admin/MemoryProposalsPage.tsx`
- `web/src/api/lusiyuan-api.ts`
- `src/routes/admin.route.ts`
- `src/routes/reflection.route.ts`
- `src/reflection/reflection-proposal.service.ts`

## 12. Skill 管理：小红书回复工作流

**做了什么**

admin 里有一个“Skills”入口，用来查看系统里有哪些正式能力、它们现在是开着还是关着，以及关闭后调用方应该怎么处理。

当前已有的是 `xiaohongshu_reply`：

- 它是小红书专用评论回复 skill。
- 它用 LLM 判断评论类型、是否需要回复、风险和回复口吻。
- 它只生成草稿，不自动发送。
- prompt 规范可以在 admin 里编辑。
- 小红书平台页有帖子、评论、草稿工作台，可以手动选择某条评论生成草稿，再直接修改草稿正文。
- 小红书平台页现在是一份账号镜像，评论按顶层评论和子回复显示，也会区分思源原草稿和真实作者回复。
- 帖子不再手动新增：粘贴 URL 后通过 `chrome-devtools-mcp` 读取已登录 Chrome 当前加载的帖子和评论。
- 同一帖子优先复用现有页面；连续新开页面至少间隔 15 秒，读取前随机等待 3–5 秒让页面稳定。
- 读取后保留页面，不自动刷新、滚动或关闭，也不通过随机滚动伪装真人；owner 手动导入时只有限展开当前已加载区域中的“展开 N 条回复”。
- 评论从属关系和“作者”身份由 DOM 结构确定，不交给 LLM 猜；保存结构是“顶层评论 + replies[] + 具体回复目标”。
- 导入后的标题、文案、作者、类型、评论和图片 Alt 可以在 admin 修正。
- owner 记录“已发布”或“不回复”后，会生成一条通用表达经验；后续草稿会召回少量相似经验。

**为什么这样做**

小红书回复不是普通聊天，也不是通用草稿。它需要看帖子语境、完整评论线程和账号边界，然后判断要不要回复。如果只是无意义表情或为了礼貌来回刷存在感，应该倾向跳过。

**关闭时怎么处理**

- `SkillConfig.accessMode=off`：小红书工作台不能生成回复草稿。
- 平台页读取 skill 状态；关闭时只显示不可用，不绕过 skill 另写一套生成逻辑。

**规则怎么保存**

小红书 Skill 的开关和具体 prompt 配置统一保存在数据库 `SkillConfig` 里；如果没有保存过，系统使用代码默认值。小红书帖子、评论线程和草稿分别保存在 `XiaohongshuPost`、`XiaohongshuComment` 和 `XiaohongshuReplyDraft`。真实作者回复就是评论线程中带 `isAuthor` 的节点，不再用独立表重复保存。

表达学习是独立的通用模块，不写进小红书 Skill，也不混进 Memory。它保留原稿和最终决定，用 LLM 提炼可修正的经验，再通过向量检索给未来相似回复参考。当前已有 URL 读取和同步 API，但后台定时自动同步还没有接入。

**以后要改看哪里**

- `src/skills/`
- `src/expression-learning/`
- `src/platforms/xiaohongshu/`
- `src/routes/admin.route.ts`
- `web/src/components/admin/SkillsAdminPage.tsx`
- `web/src/components/admin/ExpressionLearningPage.tsx`
- `web/src/components/admin/PlatformsPage.tsx`
- `prisma/schema.prisma` 的 `SkillConfig` / `XiaohongshuPost` / `XiaohongshuComment` / `XiaohongshuReplyDraft` / `ExpressionLearningExample`

## 13. 数据库实时配置

**做了什么**

- 日常开关、权限、限制、Dream/Reflection 规则、定时频率、模型渠道和平台读取参数从 `.env` 迁到 `SystemSetting`。
- Admin 保存后立即更新当前进程，并在 `SystemSettingEvent` 留下变化记录。
- 模型、定时器、Chrome MCP 和 Telegram 都有各自的即时重载处理。
- API Key、Base URL、Admin Token、清库密码、数据库地址和 owner 身份继续留在 `.env`。
- 小红书 Skill 开关归回 `SkillConfig`，不在通用配置里重复保存。
- 清空测试数据保留系统设置、设置历史和 Skill 配置。

**为什么这样做**

以前 Admin 修改 `.env` 后还要重启，而且页面上的“已保存”不等于程序已经使用。现在页面提示成功时，新运行配置已经生效；秘密仍留在环境变量，避免把安全边界搬进业务数据库。

**以后要改看哪里**

- `project-handbook/configuration.md`
- `src/config/`
- `src/utils/env.ts`
- `web/src/components/admin/ConfigCenterPage.tsx`
- `prisma/schema.prisma` 的 `SystemSetting` / `SystemSettingEvent`

## 以后测试时怎么描述问题

如果你长期用下来感觉不对，可以直接按这些说法提：

- “关系复盘太容易升温”
- “关系张力降得太快”
- “owner 对话不应该这么影响 RuntimeState”
- “长时间没人聊天时，他应该更想说话”
- “一直聊天后，他应该更累”
- “身份怀疑太敏感或太迟钝”
- “admin 页面看不出这次状态为什么变”
- “记忆提案太多，不知道先审哪些”
- “某条记忆应用后找不到”
- “全局记忆和用户记忆的区别还不够清楚”
- “小红书回复太像模板”
- “某类评论应该不回复”
- “私信合作应该更严格转 owner 审核”

我下次会先读这份归档，再去对应代码里改。
