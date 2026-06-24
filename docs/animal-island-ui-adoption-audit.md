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

- **背景**：`Panel` 在 5 个文件里重复实现：
  - `ConfigCenterPage.tsx:873`（复杂版）
  - `DashboardPage.tsx:325`（极简版）
  - `PlatformsPage.tsx:1069`（极简版）
  - `ToolsAdminPage.tsx:931`（极简版）
  - `OpsPage.tsx:1607`（`PanelHeader`，仅头部）
- **做法**：把 `ConfigCenterPage` 里的复杂 `Panel` 抽到 `web/src/components/admin/AdminDetailPrimitives.tsx`，统一签名 `{ title, subtitle?, icon?, pattern?, children, actions? }`；其他 4 处替换为统一组件。
- **验收**：
  - `grep -nE 'function Panel\b' web/src/components/admin/*.tsx` 命中只剩 0（除 primitives 文件中的统一实现）
  - 视觉上各页面 Panel 风格统一

### 🟡 P1 - 视觉与体验升级

#### 3. `title=` → UI 库 `Tooltip variant="island"`

- **背景**：`title=` 原生属性延迟 ~1.5s、样式丑、不支持多行，UI 库 `Tooltip` 支持 `variant="island"` 直接套动森气泡。
- **替换点**：
  - `AdminShell.tsx:279`（apiBaseUrl 提示）
  - `ConfigCenterPage.tsx:717, 859, 929, 1045, 1127, 1147, 1184`
  - `DashboardPage.tsx:376`
- **做法**：写一个 `<HintTip>` 包装组件，传入 `title` 后挂到目标元素上。优先做 hover 触发，避免页面初载时弹窗。
- **验收**：
  - `grep -nE 'title=\{' web/src/components/admin/*.tsx` 命中下降到 0（除原生 `<a>` `<abbr>` 等语义场景）
  - 鼠标 hover 后 0.3s 内显示

#### 4. 原生 `<input class="field-input">` → UI 库 `Input`（按需）

- **背景**：约 30+ 处 `<input class="field-input">`，UI 库 `Input` 提供 `allowClear`、`prefix/suffix`、`status` 错误态。
- **做法**：**只对需要 `allowClear` 或 `prefix` 的输入框替换**；纯文本框保留 `.field-input`，避免大面积 UI 改动引入回归。
- **当前重点替换**：
  - `ExpressionLearningPage` 搜索框（已用 Input）
  - `MemoryProposalsPage.tsx:379` 等带清除语义的输入
  - 后续页面新写输入框直接用 Input
- **验收**：
  - 新页面 / 新组件用 Input 而不是 `.field-input`
  - allowClear 按钮的样式与 admin 一致（可能需要 `.admin-input` 适配）

#### 5. `<details>` (RawJsonDetails) → UI 库 `Collapse`

- **背景**：`AdminDetailPrimitives.tsx:RawJsonDetails` 用 `<details>/<summary>` 折叠 JSON；UI 库 `Collapse` 有 Grid 展开动画 + 叶子装饰。
- **做法**：可选，**JSON 折叠场景保留 `<details>` 也合理**（无 JS 行为、屏幕阅读器友好、稳定可靠）。本项标 P1 但不强推，由后续开发决定。
- **替换点**：
  - `AdminDetailPrimitives.tsx:RawJsonDetails`（JSON 折叠）
  - `ConfigCenterPage.tsx:912, 1001`（配置组折叠）

#### 6. 自实现 `admin-switch-button` → UI 库 `Switch`

- **背景**：`ConfigCenterPage.tsx:934, 1194` 用 `<button role="switch">` 自实现开关；UI 库 `Switch` 有 handle 滑动 + loading 状态。
- **做法**：**先观察** `ToggleGrid`（多 key 开关网格）是否需要保留；UI 库 `Switch` 是一次一个开关，不适合 grid 布局。建议只对单 key 场景替换 `admin-switch-button`，grid 场景保留并加注释。
- **验收**：
  - `grep -nE 'admin-switch-button' web/src/` 命中下降（grid 场景除外）
  - 替换后 handle 动画正常

#### 7. 自实现 checkbox → UI 库 `Checkbox`

- **背景**：`RuntimeStatePage.tsx:678` 一处 `<input type="checkbox">`。
- **做法**：替换为 UI 库 `Checkbox`，享受 splash 动效。低优先级（只 1 处）。

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
- [ ] 2. 统一 `Panel` 组件（5 处自实现合并到 AdminDetailPrimitives）
- [ ] 3. `title=` → UI 库 `Tooltip`（8+ 处）
- [ ] 4. 按需替换 `<input>` → UI 库 `Input`（仅新组件 + allowClear/prefix 场景）
- [ ] 5. `<details>` → UI 库 `Collapse`（可选，JSON 折叠场景）
- [ ] 6. `admin-switch-button` → UI 库 `Switch`（单 key 场景）
- [ ] 7. 自实现 checkbox → UI 库 `Checkbox`（1 处）
