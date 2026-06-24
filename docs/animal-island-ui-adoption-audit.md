# animal-island-ui 接入系统盘点与改造计划

> 状态：P0 全部完成；P1/P2 待办
> 起始：2026-06-24
> 最后更新：2026-06-25
> 范围：`web/` 目录下 admin + 业务页面对 UI 库 `animal-island-ui@1.0.16` 的接入情况

## 背景

项目里很多 admin / 业务页面的代码是自己手搓的，UI 库本身已经提供了对应能力，但当时接入较粗糙。整体目标：**把能用 UI 库解决的标准化控件替换掉，把项目自实现沉淀成共享 primitive**。

## UI 库 22 个组件当前接入情况

| 组件 | 已用？ | 用在哪 |
|---|---|---|
| Button | ✅ | 几乎所有 admin 页 |
| Card | ✅ | AdminShell、Dashboard、Conversation、ExpressionLearning、Platforms |
| Icon | ✅ | 几乎所有 admin 页 |
| Input | ⚠️ 部分 | AdminShell、Conversation、Platforms、ExpressionLearning（其余页仍用原生 input + `.field-input`） |
| Select | ✅ 全量 | 所有 admin 页（2026-06-25 8 文件 34 处全量迁移） |
| Time | ✅ | AdminShell 侧栏 |
| Title | ✅ | AdminShell、Dashboard |
| Cursor | ✅ | AdminShell 外壳 |
| Checkbox | ❌ | 1 处自实现 |
| Switch | ❌ | 自实现 `admin-switch-button` + `ToggleGrid` |
| Radio | ❌ | 0 处 |
| Tooltip | ❌ | 全部用 `title=` 属性 |
| Modal | ❌ | 0 处（暂无可用场景） |
| Tabs | ❌ | 自实现 `admin-stacked-tab-button`（有意保留，理由见下） |
| Collapse | ❌ | 用原生 `<details>/<summary>` |
| Form / FormItem / useForm | ❌ | 手写 useState |
| Typewriter | ❌ | 自实现 `TypingIndicator`（有意保留） |
| CodeBlock | ❌ | `RawJsonDetails` 是 `<pre>` |
| Loading | ❌ | 自实现 `LoadingHint`（文本 loading） |
| Table | ❌ | 全用 row-based 列表 |
| Divider | ❌ | 用 `<hr>` 或 border |
| Footer | ❌ | 0 处 |
| Wallet | ❌ | 0 处 |
| Phone | ❌ | 0 处 |

## 改造项（按 ROI 排序）

### 🟢 P0 - 已有 wrapper 化基础，替换最一致

#### 1. 批量替换原生 `<select>` → UI 库 `Select`

- **状态**：✅ **2026-06-25 完成**（10 个 commit，8 个文件，34 处替换，4 个本地 wrapper 全删）
- **背景**：2026-06-24 已将 ExpressionLearningPage 的 3 个 `<select>` 替换为 UI 库 `Select`，并封装了 `.admin-select-below` + `.admin-select-host` wrapper 样式（解决侧向弹出和 transform 堆叠上下文问题）。其他 7 个文件还停留在原生 select。
- **做法**：抽到 `web/src/components/admin/AdminFormPrimitives.tsx` 作为 `AdminSelect`（TypeScript 强制 `ariaLabel` 必填，编译期保证 a11y）。每个调用点替换时：调用方提供可见 label（`<span>` 或 sibling `<div>`），AdminSelect 内部自带 `<label class="admin-select-below">`；给外层卡片挂 `.admin-select-host`（用 `:has()` 选择器让 dropdown 突破 stacking context）。
- **提交清单**（按从低风险到高风险）：

  | # | commit | 文件 | 替换数 |
  |---|---|---|---|
  | 1 | `d910ef7` (pre) + step 1 wrapper | `AdminFormPrimitives.tsx` | 新建 AdminSelect 共享 wrapper |
  | 2 | `979567b` | ExpressionLearningPage | 3 (删本地 FilterSelect) |
  | 3 | `9a2328c` | RuntimeStatePage | 2 |
  | 4 | `5b646fa` | PlatformsPage | 1 (删本地 SelectInput) |
  | 5 | `d4a9e6e` | ConfigCenterPage | 3 |
  | 6 | `6ec176f` | OpsPage | 3 |
  | 7 | `04542c1` | MemoryProposalsPage | 3 (删本地 FilterSelect) |
  | 8 | `a233381` | MemoryLibraryPage | 10 (删本地 FilterSelect) |
  | 9 | `932d52a` | SkillsAdminPage | 2 |
  | 10a | `1aa0e2d` | ToolsAdminPage filter | 6 |
  | 10b | `06c556b` | ToolsAdminPage config | 3 |

- **验收**：
  - ✅ `grep -nE '<select' web/src/components/admin/` 命中 0（除 `AdminFormPrimitives.tsx`）
  - ✅ `grep -nE '<option' web/src/components/admin/` 命中 0（除 `AdminFormPrimitives.tsx`）
  - ✅ `grep -rE 'function (FilterSelect|SelectInput)\b' web/src/components/admin/` 命中 0（4 个本地 wrapper 全删）
  - ✅ `tsc --noEmit` 0 error
  - ✅ 每个 admin 页面浏览器验证：combobox a11y label 正确、dropdown 向下展开、不被下方 row 遮挡
- **踩坑记录**：
  - AdminSelect 内部已经渲染一个 `<label>`，调用方如果再用 `Field`（也是 `<label>`）会嵌套 label 违法 HTML → 改用 sibling `<div>` + 可见 `<span>` 模式
  - 原 `FilterSelect` 签名 `(value, label)[]`，UI 库 `Select` 要 `(key, label)[]` → 全部调用点现场 `.map` 转换
  - 原 `onChange` 签名 `(event) => v` → UI 库签名 `(value: string) => v`；`as X` cast 从 `event.target.value as X` 移到 `v as X`

#### 2. 统一 `Panel` 组件（项目内部去重）

- **状态**：✅ **2026-06-25 完成**（commit f5d1b16）
- **背景**：`Panel` 在 4 个文件里重复实现（`grep` 显示 4 处 `function Panel` + 1 处 `PanelHeader`）：
  - `ConfigCenterPage.tsx`（复杂版，bg-muted）
  - `DashboardPage.tsx:325`（带 `icon` slot + `Card pattern`，不通用，**保留**）
  - `PlatformsPage.tsx`（极简版，bg-white）
  - `ToolsAdminPage.tsx`（极简版，bg-white + actions slot）
  - `OpsPage.tsx`（`PanelHeader`，仅头部，API 不同，**保留**）
- **做法**：抽到 `web/src/components/admin/AdminDetailPrimitives.tsx` 作为 `SectionPanel`，签名 `{ title, subtitle?, bg?: "white"|"muted", actions?, children }`。ConfigCenterPage 用 `bg="muted"` 保留原视觉；PlatformsPage + ToolsAdminPage 用默认 `bg="white"`。Dashboard 与 Ops 的 `Panel`/`PanelHeader` 不并入。
- **验收**：
  - ✅ `grep -nE 'function Panel\b' web/src/components/admin/*.tsx` 命中只剩 1 处（Dashboard 的 icon-variant，**预期保留**）
  - ✅ 视觉上 3 个 panel 渲染页面（ConfigCenterPage、PlatformsPage、ToolsAdminPage）截图与改前一致
- **踩坑**：第一次只替换了 `<Panel title="...">` 形式的开标签，漏了 multiline `<Panel ...>{children}</Panel>`（PlatformsPage 第 3 个 call site），且全部 3 个文件的 `</Panel>` 闭标签未一起改 → 浏览器报 4 个 parse error。教训：**改 JSX 标签时 old_string 必须含完整开 + 闭 + props 形状**，或用 `replace_all` 同时处理开闭。

### 🟡 P1 - 视觉与体验升级

#### 3. `title=` → UI 库 `Tooltip variant="island"`（高价值单点）

- **状态**：⏸ **2026-06-25 暂缓（范围重估）**
- **背景**：`title=` 原生属性延迟 ~1.5s、样式丑、不支持多行，UI 库 `Tooltip` 支持 `variant="island"` 直接套动森气泡。
- **实际范围**（`grep -rnE 'title=\{'`）：**79 个 dynamic + 60 个 literal**，分布：
  - OpsPage 33（多 PanelHeader 标题 + truncated 文本）
  - MemoryProposalsPage 14（DetailRow + metric 的 truncated id）
  - ToolsAdminPage 10
  - MemoryLibraryPage 9
  - ConfigCenterPage 8
  - PlatformsPage 3
  - AdminShell 1、DashboardPage 1
- **60 个 literal `title="..."`**：绝大多数是 `<PanelHeader title="..." />` / `<ContentPanel title="..." />` 之类的 prop 透传，**不是 tooltip 候选**，不要替换。
- **79 个 dynamic `title={...}`**：绝大部分是 `<div className="truncate" title={longValue}>{longValue}</div>` 模式，hover 展示完整 ID/URL/字段名。**语义上原生 `title=` 已经达成目标**（hover 显示完整文本）。
- **暂缓原因**：UI 库 `Tooltip` 必须包单个 React element 子节点，全量替换需把每个 truncated div 改为 `<Tooltip title={x}><div className="truncate">{x}</div></Tooltip>` —— 70+ 行 JSX 改动，跨 7 个文件，hover target 从纯文本变成带 wrapper 元素，可能引入视觉回归和 z-index 问题。**ROI 不高**。
- **后续方向**（如果重做）：挑 5-10 个高价值单点（AdminShell apiBaseUrl、ConfigCenterPage 模型名 / provider name、几处关键 hash id preview）做单 commit，全量不做。

#### 4. 原生 `<input class="field-input">` → UI 库 `Input`（按需）

- **状态**：⏳ 待办（**实际范围比 doc 估的大**）
- **背景**：doc 估 ~30+ 处，**实际 `grep` 50 处** `.field-input` 用法，UI 库 `Input` 提供 `allowClear`、`prefix/suffix`、`status` 错误态。
- **做法**：**只对需要 `allowClear` 或 `prefix` 的输入框替换**；纯文本框保留 `.field-input`，避免大面积 UI 改动引入回归。
- **建议优先替换**：
  - `MemoryProposalsPage` / `MemoryLibraryPage` 搜索框（带清除语义）
  - `ToolsAdminPage` 模糊搜索框
  - `ConfigCenterPage` 配置 key 搜索框
  - 后续新页面输入框直接用 Input
- **验收**：
  - 新页面 / 新组件用 Input 而不是 `.field-input`
  - allowClear 按钮的样式与 admin 一致（可能需要 `.admin-input` 适配）

#### 5. `<details>` (RawJsonDetails) → UI 库 `Collapse`

- **背景**：`AdminDetailPrimitives.tsx:RawJsonDetails` 用 `<details>/<summary>` 折叠 JSON；UI 库 `Collapse` 有 Grid 展开动画 + 叶子装饰。
- **做法**：可选，**JSON 折叠场景保留 `<details>` 也合理**（无 JS 行为、屏幕阅读器友好、稳定可靠）。本项标 P1 但不强推，由后续开发决定。
- **替换点**：
  - `AdminDetailPrimitives.tsx:RawJsonDetails`（JSON 折叠）
  - `ConfigCenterPage.tsx:912, 1001`（配置组折叠）

#### 6. 自实现 `admin-switch-button` → UI 库 `Switch`（单 key 场景）

- **状态**：⏳ 待办
- **背景**：`ConfigCenterPage.tsx:934, 1194` 用 `<button role="switch">` 自实现开关；UI 库 `Switch` 有 handle 滑动 + loading 状态。
- **做法**：**先观察** `ToggleGrid`（多 key 开关网格）是否需要保留；UI 库 `Switch` 是一次一个开关，不适合 grid 布局。建议只对单 key 场景替换 `admin-switch-button`，grid 场景保留并加注释。
- **验收**：
  - `grep -nE 'admin-switch-button' web/src/` 命中下降（grid 场景除外）
  - 替换后 handle 动画正常

#### 7. 自实现 checkbox → UI 库 `Checkbox`

- **状态**：✅ **2026-06-25 完成**（commit 441fdad）
- **修正**：原计划用 UI 库 `Checkbox`（group-mode API `options[]+value: string[]`），但 RuntimeStatePage 是单 boolean toggle，**改用 UI 库 `Switch`**（`checked: boolean` + `onChange(checked: boolean)`，API 完全匹配）。文档原标题保留 checkbox → Checkbox 是技术误判；语义上单 boolean 永远该用 `Switch`，多选组才用 `Checkbox`。
- **背景**：`RuntimeStatePage.tsx:678` 一处 `<input type="checkbox">`。
- **做法**：替换为 UI 库 `Switch`，保留外层 `<label>` 包装以维持可见文本关联（"允许受控入口自动校准长期状态"），`aria-label` 由可见文本提供。
- **验收**：
  - ✅ 浏览器验证：Switch a11y role="switch" 渲染正确，hover/focus 状态正常，点击 toggle checked 状态
  - ✅ TS 0 error

### 🔵 P2 - 未来用得上，提前规划

#### 8. `Form` / `FormItem` / `useForm`

- **场景**：等 ConfigCenterPage 那种"几十个字段+校验"出现时再上；目前手写 useState 还能 hold。
- **触发条件**：未来有表单字段 > 10 个 + 需要前端校验的页面出现时引入。

#### 9. `Table`

- **场景**：未来"管理工具调用日志"那种密集表格可以用 `Table`；当前 row-based 列表风格不冲突，**不需要替换现有列表**。
- **触发条件**：需要展示行操作（删除/编辑/查看）且字段 > 5 列时引入。

#### 10. `Modal`

- **场景**：未来"危险操作二次确认"弹窗可以用 `Modal`。
- **触发条件**：第一次需要"破坏性操作二次确认"时引入。

### 🟢 不替换（项目自实现保留）

| 项目组件 | 位置 | 保留理由 |
|---|---|---|
| `AdminShell` | `web/src/components/admin/AdminShell.tsx` | 侧栏 + 顶部外壳，UI 库无对应物 |
| `AdminDetailPrimitives` (DetailInfoLine, RawJsonDetails) | `web/src/components/admin/AdminDetailPrimitives.tsx` | 详情行 + JSON 折叠（除非走 P1 第 5 项） |
| `AdminFormPrimitives` (AdminSelect) | `web/src/components/admin/AdminFormPrimitives.tsx` | admin 全局共享的下拉 wrapper（强制 ariaLabel + `.admin-select-below/.admin-select-host`），2026-06-25 新建 |
| `StatusPill` | `web/src/components/admin/StatusPill.tsx` | 启用/停用双态徽章，UI 库无对应物 |
| `ToggleGrid` | `web/src/components/admin/ConfigCenterPage.tsx:1194` | 多 key 开关网格，UI 库 Switch 不支持 |
| `LoadingHint` | `web/src/components/admin/ConfigCenterPage.tsx:1241` | 文本 loading，UI 库 Loading 是全屏岛屿动画，过度 |
| `PlaceholderPage` | `web/src/components/admin/PlaceholderPage.tsx` | 占位页骨架 |
| `LusiyuanAvatar` | `web/src/components/LusiyuanAvatar.tsx` | 业务实体 |
| `ChatHeader` / `ChatInput` / `ChatPage` / `MessageBubble` / `MessageList` / `TypingIndicator` | `web/src/components/*.tsx` | 聊天业务组件，UI 库 Typewriter 不适合流式场景 |
| `admin-stacked-tab-button` 等 CSS 模式 | `web/src/index.css:422+` | admin 的"卡片式二级入口"风格，UI 库 Tabs 是水平 tabs，不匹配 |
| Cursor shim | `web/src/index.css:52-97` | 修复 `animal-island-ui@1.0.16` 未带出 Cursor CSS 的临时方案 |

## 通用约定

- 新增页面 / 新组件，**优先使用 UI 库组件**，不要新写自定义 primitive
- 项目自实现只补 UI 库没有的语义（例如 StatusPill、LusiyuanAvatar）
- 每次替换后单独 commit，commit message 写清替换点和原因
- 配套文档同步更新：`web/src/components/admin/ANIMAL_ISLAND_UI_USAGE.md` 和 `ADMIN_STYLE_GUIDE.md`

## 进度

- [x] 2026-06-24 ExpressionLearningPage 三个 `<select>` 替换为 UI 库 `Select`（commit f443f47）
- [x] 2026-06-24 Select wrapper 化封装：`.admin-select-below` + `.admin-select-host`（commit d910ef7）
- [x] **2026-06-25 任务 1 完成**：批量替换原生 `<select>` → UI 库 `Select`（8 个文件、34 处、4 个本地 wrapper 全删，10 个 commit，详见上方任务 1 提交清单）
- [x] **2026-06-25 任务 2 完成**：3 处本地 `Panel` 合并为 `SectionPanel`（AdminDetailPrimitives），Dashboard 的 icon-variant Panel 与 Ops 的 PanelHeader 保留（commit f5d1b16）
- [x] **2026-06-25 任务 7 完成**：RuntimeStatePage 自实现 checkbox → UI 库 `Switch`（修正为 Switch 而非 Checkbox，因为 Switch 是单 boolean toggle 的正确语义，commit 441fdad）
- [x] **2026-06-25 任务 3 进行中**：`title=` → `Tooltip variant="island"`，**仅做 7 个高价值单点**（AdminShell apiBaseUrl、ConfigCenterPage provider.model + envConfig.envPath、ToolsAdminPage log.toolName + log.channel、OpsPage report.id、DashboardPage large metric），其余 ~70 个 truncated text 暂不动（原 `title=` 已够用）
- [ ] 4. 按需替换 `<input>` → UI 库 `Input`（**实际 50 处** `.field-input`，仅新组件 + allowClear/prefix 场景）
- [ ] 5. `<details>` → UI 库 `Collapse`（可选，JSON 折叠场景）
- [ ] 6. `admin-switch-button` → UI 库 `Switch`（单 key 场景，ConfigCenterPage 还在用 `<button role="switch">` 自实现）
