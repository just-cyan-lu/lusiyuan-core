# animal-island-ui 接入系统盘点与改造计划

> 状态：P0 全部完成；P1 任务 5/6 完成；P2 P2.1 试点完成；P3 盘点完成
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
| Input | ✅ 全量 | 2026-06-25 完成 33 处 input + 1 处 FilterInput wrapper（10 个 commit，详见下方任务 4 提交清单）。textarea 17 处保留（UI 库 Input API 不支持 textarea）。 |
| Select | ✅ 全量 | 所有 admin 页（2026-06-25 8 文件 34 处全量迁移） |
| Time | ✅ | AdminShell 侧栏 |
| Title | ✅ | AdminShell、Dashboard |
| Cursor | ✅ | AdminShell 外壳 |
| Checkbox | ❌ | 1 处自实现 |
| Switch | ✅ | RuntimeStatePage（任务 7 修正，commit 441fdad）+ ConfigCenterPage 22 个运行配置 boolean 字段（任务 6，commit aa521a0）|
| Radio | ❌ | 0 处 |
| Tooltip | ❌ | 全部用 `title=` 属性 |
| Modal | ❌ | 0 处（暂无可用场景） |
| Tabs | ❌ | 自实现 `admin-stacked-tab-button`（有意保留，理由见下） |
| Collapse | ❌ | 用原生 `<details>/<summary>` |
| Form / FormItem / useForm | 🔬 试点 | ExpressionLearningPage TeachingForm 顶部 4 字段（platform/scene/scope/status）2026-06-25 试点完成（commit 即将），剩下 5 字段保留 useState。详见任务 8 节。 |
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

#### 4. 原生 `<input class="field-input">` → UI 库 `Input`

- **状态**：✅ **2026-06-25 完成**（33 处 input + 1 处 FilterInput wrapper 内部 input，共 10 个 commit）
- **背景**：doc 估 ~30+ 处，**实际 `grep` 50 处** `.field-input` 用法 = 33 个 `<input>` + 17 个 `<textarea>`。UI 库 `Input` 提供 `allowClear`、`prefix/suffix`、`status` 错误态。
- **做法调整**：原 doc 估"按需替换 allowClear/prefix 场景"，**User 在 2026-06-25 决定全量替换 33 处 input**，理由：admin 视觉统一优先，全量后所有 input 行为（focus / hover / disabled / allowClear）一致。textarea 17 处保留，UI 库 Input API 不支持 textarea。
- **做法落地**：
  - 新增 `web/src/components/admin/AdminFormPrimitives.tsx` 中的 `AdminInput` primitive：内部 `<Input size="middle" shadow>` + 外层 `<div className="admin-input">`，默认强制 `aria-label`（TypeScript 必填）。
  - 新增 `.admin-input` CSS wrapper（`web/src/index.css`）：覆盖 UI 库 Input 默认胶囊形（border-radius 50px / height 40px / box-shadow `0 3px #d4c9b4`），对齐 admin `.field-input`（1.1rem / 45px / `0 2px 0 #d4c9b4` / cream bg `#f7f3df` / font-weight 600）。
  - 调用方模式：`<Field label="..."><AdminInput value={...} onChange={...} aria-label="..." /></Field>`，保留可见 label 由 `<Field>` 提供，`aria-label` 走 a11y。
- **提交清单**（10 个 commit + 1 个 type fix + 1 个 pre-existing fix）：

  | # | commit | 文件 | 替换数 |
  |---|---|---|---|
  | 1 | `e49db11` | `AdminFormPrimitives.tsx` + `index.css` | 新建 AdminInput primitive + `.admin-input` wrapper |
  | 2 | `09bdcb2` | ConfigCenterPage | 4（清空密码 / 确认文本 + 运行配置 string/number + env secret/string/number） |
  | 3 | `e120ff3` | MemoryLibraryPage | 8（编辑表单 + User ID/Importance/Confidence/Tags/Entities/Source/Channel/Conversation ID） |
  | - | `2cfe065` | `AdminFormPrimitives.tsx` | fix TS：AdminInput 显式排除 onChange 解决 TS7006 类型推断失败 |
  | - | `c8178f6` | ExpressionLearningPage + RuntimeStatePage | fix pre-existing TS7006 两处 |
  | 4 | `451c375` | ToolsAdminPage | 9（filter 5 + ToolConfigField 1 + ConfigField env 1 + Step 9 顺手 1） |
  | 5 | `0f30ae9` | OpsPage | 7（Reflection 5 + Dream 2） |
  | 6 | `f4c078d` | PlatformsPage | 2（post.alt 编辑器 + LabeledInput wrapper） |
  | 7 | `38ed387` | SkillsAdminPage | 2（小红书 maxReplyChars + LabeledInput wrapper） |
  | 8 | `060fc62` | RelationshipStatePage | 3（搜索 + 绑定渠道 + 关系标签，type="range" 滑块保留） |
  | 9 | `51f8de1` | RuntimeStatePage + MemoryProposalsPage | 1 + 1（RuntimeStateForm moodLabel + MemoryProposalsPage 搜索框） |
  | 10 | `a03cbf5` | MemoryLibraryPage | FilterInput wrapper 内部 input 改 AdminInput（4 处调用） |

  **合计 33 处 input 替换** + 2 处 type fix = **13 个 commit**

- **验收**：
  - ✅ `grep -nE '<input\b' src/components/admin/` 命中只剩 2 处（type="range" 滑块，RuntimeState + RelationshipState）
  - ✅ `grep -nE 'className=".*field-input' src/components/admin/` 命中只剩 textarea + docs 历史参考
  - ✅ `tsc -b --force` 0 error
  - ✅ `pnpm build` 0 error
  - ✅ 每个 admin 页面浏览器验证 AdminInput 视觉一致（17.6px radius / 45px height / `0 2px 0 #d4c9b4` shadow / `#f7f3df` bg）
- **踩坑记录**：
  - InputProps.onChange 继承 React.InputHTMLAttributes 后再 override 类型为 ChangeEventHandler，两者交集产生 onChange: FormEventHandler & ChangeEventHandler，参数类型不可调和，导致调用方 `(event) => event.target.value` 时 TS 无法推断 event 类型 → AdminInputProps 用 Omit 排除并显式声明 ChangeEventHandler<HTMLInputElement>（commit 2cfe065）
  - type="range" 滑块不替换（UI 库 Input 视觉是文本框，不适合 thumb 滑动）
  - MemoryLibraryPage FilterInput wrapper 自带视觉（`mt-1 h-10 w-full rounded-lg ...`），Step 10 顺手用 AdminInput 重写内部 input

#### 5. `<details>` (RawJsonDetails) → UI 库 `Collapse`

- **状态**：⏸ **2026-06-25 决定不替换（试错后撤回）**
- **背景**：`AdminDetailPrimitives.tsx:RawJsonDetails` 用 `<details>/<summary>` 折叠 JSON；UI 库 `Collapse` 是 FAQ Q&A 卡片组件（青色 `+`/`−` 圆按钮 + 叶子 svg + CSS Grid 0fr→1fr 展开动画）。
- **试错过程**：临时替换 `RawJsonDetails` 为 UI 库 `Collapse` 后在 `/admin/runtime` 看实际效果：青色 `+` 圆按钮 + 叶子 svg 跟 admin 米黄/棕色主题反差明显，标题被 UI 库 `--animal-text-color` 覆盖为非棕色，视觉上变成"两个 UI 库风格硬拼"。功能 100% 正常（aria、键盘、动画都对），但**视觉一致性输了**。撤回。
- **不替换理由**：
  - admin 的 `<details>` 是"分组/详情折叠"语义（配置组、工具卡片、JSON 折叠），不是 Q&A；UI 库 `Collapse` 是 FAQ 卡片组件，语义错配
  - HTML 原生 `<details>` 已经做好（零依赖、键盘可达、`aria-expanded` 自带），换 UI 库收益小、视觉损失大
  - audit doc 原文已经标"不强推"
- **盘点**:admin 内 `<details>` 共 9 处 — `AdminDetailPrimitives.tsx` 1 处 + `ConfigCenterPage.tsx` 2 处(配置组) + `ToolsAdminPage.tsx` 4 处(工具卡片) + `PlatformsPage.tsx` 2 处(帖子编辑/原文预览)。全部保留原生 `<details>`。

#### 6. 自实现 `admin-switch-button` → UI 库 `Switch`（单 key 场景）

- **状态**：✅ **2026-06-25 完成**（commit aa521a0）
- **背景**：`ConfigCenterPage.tsx:921-937` 用 `<button role="switch">` 自实现"运行配置"区 boolean 字段开关，22 个 boolean field（Dream 11 个 + 模型 + Reflection + Chrome MCP 等）。
- **做法**：
  - import 加 `Switch` from `animal-island-ui`
  - 替换：`<button role="switch">` → `<Switch checked={enabled} disabled={disabled} onChange={(next) => onCommit(field, next ? "true" : "false")} aria-label={field.label} />`
  - 保留：外层"已开启/已关闭"文字（UI 库 Switch 无可见 label，自带的 `<span>` 保留语义）、绿/灰底色卡片（border + bg）、`h-10 w-full` 满宽布局
  - 转换：`onChange(event)` 字符串反转 → `onChange(next: boolean)` 直接透传 boolean（`onCommit` 内部仍把 boolean 序列化为 "true"/"false" 写 DB）
- **验收**：
  - ✅ `grep -nE 'admin-switch-button|<button[^>]*role="switch"' web/src/components/admin/ -r` 命中 0
  - ✅ 浏览器 `/admin/settings` 展开 Dream 分组看到运行时开关，保存配置后出现 toast "已即时应用 1 项运行配置" + 最近配置变更联动更新
  - ✅ `tsc -b --force` 0 error / `pnpm build` 0 error
- **保留**：`ToggleGrid`（line 1182-1214，多 key 状态网格）按 audit "不替换" 表保留 —— 用 `StatusPill` 是因为 Switch 是单 boolean 组件，不适合 grid 网格里多 key 并列显示

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

- **状态**：🔬 **2026-06-25 试点完成（4 字段验证，结论：AdminInput + AdminSelect 工作良好，但 5+ 字段表单需谨慎评估）**
- **场景**：等 ConfigCenterPage 那种"几十个字段+校验"出现时再上；目前手写 useState 还能 hold。
- **触发条件**：未来有表单字段 > 10 个 + 需要前端校验的页面出现时引入。
- **试点过程**：ExpressionLearningPage 的 `TeachingForm`（共 9 字段：platform/scene/scope/status/contextText/draftText/finalText/outcome/ownerNote），先把顶部 4 字段（platform/scene/scope/status）从 useState 迁到 `Form.useForm()` + `Form.Item` + `initialValues`，剩下 5 字段（contextText/draftText/finalText/outcome/ownerNote）保留 useState（因为它们有 `outcome === "skipped"` 互斥逻辑，强行塞进 Form/useForm 反而割裂）。
- **结论**：
  - `Form.useForm()` + `Form.Item` + `initialValues` 工作良好，`getFieldsValue()` 在 submit 时读出值传给 API 正常
  - `AdminSelect` 需要把 `value`/`onChange` 改成可选（Form.Item 会注入），已在 `AdminFormPrimitives.tsx` 调整为 optional
  - 裸 `<input>` 配合 `Form.Item` 会触发 React "uncontrolled → controlled" 警告（Form 异步注入 `initialValues`，首次渲染 value=undefined，二次渲染 value=实际值），**改用 `AdminInput`（UI 库 Input 内部 useState fallback）后警告消失**
  - 表单字段超过 5 个时仍可保留 useState（如本试点的 5 字段），Form/useForm 不必包揽全部；Form/useForm 主要价值是 **`validateFields` + `rules` 校验**，如果不需要校验，迁移收益有限
  - "嵌套 label 违法 HTML" 问题在 Form/useForm 模式下消失（Form.Item 渲染 label，AdminInput/AdminSelect 自身不渲染 label，外层是 `<form>` 元素）
- **踩坑记录**：
  - `AdminSelect` 必填 `value`/`onChange` → Form.Item 注入时 TS 报错；改为 optional（AdminFormPrimitives.tsx 改动）
  - 裸 `<input className="field-input h-10" />` 配 `Form.Item name` 触发 controlled→uncontrolled 警告；改用 `AdminInput` 后通过（UI 库 Input 内部 `useState(defaultValue ?? "")` 处理）
  - `<Form layout="vertical">` 渲染为 `<form>` 元素（不是 div），会作为 block 元素参与 space-y 间距。本试点因为外层是 `space-y-5` Card 没问题；如果塞进 flex/grid 容器需要用 `<div>` 包一层或外层 `display: contents`（但 Form 不支持 component prop 改 div，得用 CSS class 强行覆盖或外层手动 div 包裹）
- **结论决策**：Form/useForm 暂不推广到其他表单。保留试点代码（4 字段）作为"模式参考"，等真正出现"10+ 字段 + 校验"需求时再扩展。

#### 9. `Table`

- **场景**：未来"管理工具调用日志"那种密集表格可以用 `Table`；当前 row-based 列表风格不冲突，**不需要替换现有列表**。
- **触发条件**：需要展示行操作（删除/编辑/查看）且字段 > 5 列时引入。

#### 10. `Modal`

- **场景**：未来"危险操作二次确认"弹窗可以用 `Modal`。
- **触发条件**：第一次需要"破坏性操作二次确认"时引入。
- **当前可能触发点**：`ConfigCenterPage` "清空数据库业务数据"按钮目前用 `<button disabled>` + 同卡片内"清空密码"和"确认文字"两个 `<input>` 实现二次校验，**已经是强校验模式**(按钮在输入正确前 disabled,不是 Modal 弹窗)。改 Modal 收益小,保留。

### 🔵 P3 - 已盘点不替换（候选登记）

#### 11. `Checkbox` / `Radio` 盘点

- **状态**：✅ **2026-06-25 盘点完成（admin 内 0 处使用）**
- **背景**：UI 库 `Checkbox` 和 `Radio` 都未在 admin 使用；之前任务 7 已将单 boolean toggle 统一为 UI 库 `Switch`（语义更准确）。
- **grep 结果**：
  - `Checkbox`：`grep -rnE '<input[^>]*type="checkbox"' web/src/` 仅 CSS 选择器命中（`index.css:77, 113, 526`），**组件实例 0 处**。
  - `Radio`：`grep -rnE '<input[^>]*type="radio"' web/src/` 仅 CSS 选择器命中，**组件实例 0 处**。
- **结论**：admin 完全没有 checkbox / radio 需求（单 boolean 走 Switch，多选走 AdminSelect 多选 instance，多选组暂无需求）。不引入这两个组件。

#### 12. `Loading` 替代 `LoadingHint`（不替换）

- **状态**：⏸ **2026-06-25 盘点完成，决定不替换**
- **背景**：`ConfigCenterPage.tsx:1225` 自实现 `LoadingHint({ loading })`，admin 内 8 处调用（line 708, 762, 798, 810, 838, 846, 854, 880）。UI 库 `Loading` 是全屏岛屿动画（SVG 鱼 + 叶子 + 水波 + gsap 圆形 mask 揭开 + CSS var `--mask-r` 半径动画）。
- **不替换理由**：
  - **语义错配**：`LoadingHint` 是**卡片内 inline placeholder**（一行文字 `"正在读取配置..."` 或 `"暂无配置数据。"`），用于配置卡/事件卡在数据未到位时占位；UI 库 `Loading` 是**全屏页面级 transition**，asset 巨大（SVG 446×540 + gsap 动画 + MotionPathPlugin），适合应用启动 / 路由切换 / 大操作等待，不适合 8 处 inline 占位。
  - 强行替换 = 把 8 个小卡片塞进全屏动画，体验崩坏。
  - `LoadingHint` 实现 7 行，零依赖，admin 视觉一致。
- **保留**：`LoadingHint` 在 `ConfigCenterPage.tsx:1225` 继续使用。

#### 13. `Divider` 替代 `border-t` / `<hr>`（不替换）

- **状态**：⏸ **2026-06-25 盘点完成，决定不替换**
- **背景**：UI 库 `Divider` 是固定 12px 高 + 棕色 SVG 木纹分隔线（`animal-divider-ZBhpE { background: url(divider-line-brown.svg) center/contain no-repeat }`）。admin 内分隔实际是 `border-t` / `border-t-2` Tailwind 类，14+ 处分布在 `ToolsAdminPage / PlatformsPage / ConfigCenterPage / SkillsAdminPage / ExpressionLearningPage / RelationshipStatePage` 等。
- **不替换理由**：
  - **语义错配**：`border-t` 是**卡片内分组视觉**（与 padding、bg、圆角组合形成"section"边界），需要精准控制间距、颜色和层级；`<Divider>` 是**整行水平分隔**（12px 固定高度），相当于把每个 `border-t` 替换成一个完整 row。
  - 替换后布局塌陷：原来 1px 边线变成 12px gap + SVG，破坏网格布局。
  - `<hr>` admin 内 0 处使用（grep 命中仅 CSS 选择器）。
- **保留**：admin 内 `border-t` 系列继续使用 Tailwind utility。

#### 14. 自实现 widget 总览（持续维护）

- **状态**：🔄 **2026-06-25 初始登记**
- **目的**：把"项目自实现 vs UI 库已有"的判断持续记录在 doc，避免每次重新盘点。
- **当前自实现 + UI 库已有对照表**：

| 项目自实现 | 位置 | UI 库对应 | 替换结论 |
|---|---|---|---|
| `LoadingHint` | `ConfigCenterPage.tsx:1225` | `Loading` | ❌ 不替换（任务 12） |
| `border-t` 14+ 处 | 多文件 | `Divider` | ❌ 不替换（任务 13） |
| `ToggleGrid` | `ConfigCenterPage.tsx:1182` | `Switch` 多 key grid | ❌ 不替换（多 key 不适合 Switch） |
| `SectionPanel` | `AdminDetailPrimitives.tsx:28` | `Card` | ✅ 已合并部分场景（任务 2）；Dashboard 的 icon-variant / Ops 的 PanelHeader 保留 |
| `StatusPill` | `StatusPill.tsx` | 无 | ❌ 保留（业务实体） |
| `PlaceholderPage` | `PlaceholderPage.tsx` | 无 | ❌ 保留（占位页骨架） |
| `admin-stacked-tab-button` | `index.css:422+` | `Tabs` | ❌ 保留（admin 卡片式 vs UI 库水平 tabs） |

- **后续**：每完成一个改造项或发现新的自实现 widget，往此表登记一行。

### 🟢 不替换（项目自实现保留）

| 项目组件 | 位置 | 保留理由 |
|---|---|---|
| `AdminShell` | `web/src/components/admin/AdminShell.tsx` | 侧栏 + 顶部外壳，UI 库无对应物 |
| `AdminDetailPrimitives` (DetailInfoLine, RawJsonDetails) | `web/src/components/admin/AdminDetailPrimitives.tsx` | 详情行 + JSON 折叠（除非走 P1 第 5 项） |
| `AdminFormPrimitives` (AdminSelect / AdminInput) | `web/src/components/admin/AdminFormPrimitives.tsx` | admin 全局共享的下拉 + 输入框 wrapper（强制 ariaLabel / `.admin-select-below/.admin-select-host` / `.admin-input`），2026-06-25 新建 |
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
- [x] **2026-06-25 任务 4 完成**：全量替换 33 处 input → UI 库 `Input`（详见上方任务 4 提交清单，13 个 commit，AdminInput 共享 primitive + `.admin-input` CSS wrapper，textarea 17 处保留）
- [x] **2026-06-25 任务 6 完成**：ConfigCenterPage 自实现 `admin-switch-button` → UI 库 `Switch`（22 个运行配置 boolean 字段统一替换，commit aa521a0；保留 ToggleGrid 多 key 网格用 StatusPill）
- [x] **2026-06-25 任务 5 决定不替换**：试错后撤回。HTML 原生 `<details>` 在 admin 内 9 处全保留（`AdminDetailPrimitives.tsx` 1 + `ConfigCenterPage.tsx` 2 + `ToolsAdminPage.tsx` 4 + `PlatformsPage.tsx` 2），UI 库 `Collapse` 是 FAQ 卡片，视觉风格不匹配
- [x] **2026-06-25 任务 11 完成（盘点）**：`Checkbox` / `Radio` 组件 admin 内 0 处使用，不引入
- [x] **2026-06-25 任务 12 决定不替换**：`LoadingHint`（8 处 inline 占位）保留，UI 库 `Loading` 是全屏岛屿动画，语义错配
- [x] **2026-06-25 任务 13 决定不替换**：`border-t` 14+ 处保留，UI 库 `Divider` 是 12px 固定行高 SVG 木纹，语义错配
- [x] **2026-06-25 任务 14 初始登记**：自实现 widget 总览表已建，后续每完成改造项登记一行
- [x] **2026-06-25 P2.1 试点完成**：ExpressionLearningPage TeachingForm 顶部 4 字段（platform/scene/scope/status）迁到 `Form.useForm()` + `Form.Item` + `initialValues`，剩下 5 字段保留 useState。`AdminSelect` `value/onChange` 改为 optional（AdminFormPrimitives.tsx）。**结论**：Form/useForm 工作良好但收益有限（缺校验需求时迁移成本 > 收益），等出现"10+ 字段 + rules 校验"真实需求时再扩展。详见任务 8 节。

## 剩余任务排序（按 ROI）

**P0 / P1 / 已完成**（共 7 个改造项 + 3 个盘点项）：全部 done。

**P2 触发型**（共 3 个）：等出现真实需求。

| 优先级 | 任务 | 触发条件 | 预计改动量 | 备注 |
|---|---|---|---|---|
| P2.1 | `Form` / `useForm`（任务 8） | 出现 10+ 字段 + 校验表单 | 大（需引入校验框架） | **2026-06-25 试点完成**：4 字段验证通过（platform/scene/scope/status），结论 = 等真校验需求再扩展；详见任务 8 节 |
| P2.2 | `Table`（任务 9） | ToolsAdminPage "调用日志"需要列视图 | 中（适配 `columns[]` API + 列渲染） | 列表形态已稳定，触发点不明确 |
| P2.3 | `Modal`（任务 10） | 第一次需要"破坏性操作二次确认"弹窗 | 小（1-2 处即可） | 当前 ConfigCenterPage "清空数据库" 用 inline 强校验（按钮 disabled 等输入），改 Modal 收益小 |

**结论**：P2 三项**当前都没触发条件**。建议做法：

1. **停止继续找替换点**（除非出现新 UI 库组件或新 admin 场景）
2. **保持 audit doc 作为"未来参考"**：新增 admin 页面时先看本 doc "不替换"表 + UI 库组件表，决定是否用 UI 库组件
3. **每完成 1 个新功能** → 检查是否新增了自实现 widget → 在任务 14 总览表登记一行

**下个合理切入点**（当 admin 出现新需求时）：

- 如果新增"用户管理 / 权限管理"页面 → 极可能需要 `Table`（行操作 + 多列）
- 如果新增"批量操作 / 删除"功能 → 极可能需要 `Modal`（二次确认）
- 如果新增"配置向导"页面 → 极可能需要 `Form` / `useForm`（多步骤 + 校验）
