# animal-island-ui Usage In Admin

这份文档是给后续 session / 其他 agent 继续优化陆思源 admin 页面用的。它记录本项目已经怎样接入 `animal-island-ui`，哪些上游文档可参考，以及在本 admin 中应该怎么用、怎么取舍。

## 先看哪里

- 本文档：讲“本项目实际怎么用”。
- `web/src/components/admin/ADMIN_STYLE_GUIDE.md`：讲 admin 的视觉原则、控件尺寸、交互动效边界。
- `web/node_modules/animal-island-ui/AI_USAGE.md`：上游给 AI 的组件 props 参考。
- `web/node_modules/animal-island-ui/dist/types/index.d.ts`：本项目当前安装版本的最终导出类型，优先级最高。

注意：当前安装的是 `animal-island-ui@1.0.16`，但 npm 包里的 `AI_USAGE.md` 标题仍是 v0.9.5，且和实际导出有少量差异。写代码时以 `dist/types/index.d.ts` 和 TypeScript build 为准，`AI_USAGE.md` 只作为组件用法参考。

## 当前接入状态

依赖在 `web/package.json`：

```json
"animal-island-ui": "^1.0.16"
```

全局样式在 `web/src/main.tsx` 引入：

```tsx
import "animal-island-ui/style";
```

TypeScript 子路径样式声明在 `web/src/vite-env.d.ts`：

```ts
declare module "animal-island-ui/style";
```

admin 外壳在 `web/src/components/admin/AdminShell.tsx` 使用：

```tsx
import { Card, Cursor, Icon, Input, Time, Title } from "animal-island-ui";

<Cursor forceAll className="admin-island-shell">
  ...
</Cursor>
```

已直接使用组件：

- `AdminShell.tsx`：`Cursor`、`Card`、`Icon`、`Input`、`Time`、`Title`
- `DashboardPage.tsx`：`Button`、`Card`、`Icon`、`Title`
- `MemoryAdminPage.tsx`：`Icon`

本项目还在 `web/src/index.css` 补了一层 admin 适配样式：

- CSS tokens：`--ls-bg`、`--ls-ink`、`--ls-panel`、`--ls-border`、`--ls-mint` 等。
- 控件尺寸：`--admin-control-height-sm`、`--admin-control-height`、`--admin-control-height-lg`。
- Cursor shim：`animal-island-ui@1.0.16` 的 `Cursor` 组件可用，但 root style 没完整带出 Cursor CSS，所以本项目用 `.animal-cursor--force` / `.animal-cursor--scoped` 补齐。
- 原生按钮 tap feedback：`.admin-island-shell button:not(...)` 统一提供 hover 上浮、active 下压、点击圆形扩散。
- 通用 admin 类：`.field-input`、`.admin-chip`、`.admin-island-row`、`.admin-island-soft-panel`、`.admin-stacked-tab-button`。

## 当前可用导出

以 `web/node_modules/animal-island-ui/dist/types/index.d.ts` 为准，当前包导出：

```tsx
import {
  Button,
  Input,
  Switch,
  Modal,
  Card,
  Footer,
  Collapse,
  Cursor,
  Time,
  Phone,
  Divider,
  Typewriter,
  Icon,
  ICON_LIST,
  Select,
  Tabs,
  Checkbox,
  Radio,
  Tooltip,
  Form,
  FormItem,
  useForm,
  Title,
  CodeBlock,
  Loading,
  Table,
  Wallet,
} from "animal-island-ui";
```

如果上游文档提到 `WeddingInvitation` 这类当前类型里没有的组件，不要在本项目里直接使用。

## 本 admin 的使用原则

admin 是个人项目后台，可以有玩具感，但不能牺牲可读性。页面优化时按这个优先级：

1. 信息清楚：列表、筛选、详情、危险操作先能看懂。
2. 保留个人色彩：暖色、圆角、轻 3D、点阵 pattern、可爱的图标。
3. 复用现有 admin primitives：不要为同一类详情、状态、按钮再造一套样式。
4. 动效克制：按钮按压、Icon bounce、表单 focus、必要的 loading 足够了。

不要把密集管理页做成 landing page，也不要塞大面积装饰图。这里是长期使用的后台，应该是“可爱的工具台”，不是纯展示页。

## 推荐页面骨架

普通 admin 页面外层使用：

```tsx
export function ExampleAdminPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="text-xs font-semibold text-[#8a6f5a]">Section Label</div>
        <h2 className="mt-2 text-3xl font-semibold text-[#172033]">页面标题</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
          说明这个页面解决什么问题，不写使用教程。
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        ...
      </section>
    </div>
  );
}
```

如果页面是重点入口或总览页，可以使用 `Card pattern`：

```tsx
import { Card, Icon, Title } from "animal-island-ui";

<Card className="overflow-hidden p-6 md:p-8" pattern="app-teal">
  <span className="admin-chip admin-chip-mint">
    <Icon name="icon-map" size={18} />
    Control Room
  </span>

  <div className="mt-6 hidden sm:block">
    <Title size="large" color="app-yellow">
      陆思源核心系统管理台
    </Title>
  </div>

  <h2 className="block text-2xl font-black text-[#794f27] sm:hidden">
    陆思源核心系统管理台
  </h2>
</Card>
```

移动端长中文标题不要直接用大号 `Title` ribbon；参考 `DashboardPage.tsx`，桌面用 `Title`，移动端用普通 `h2`。

## Card / Panel

`Card` 适合信息卡、状态卡、页面主卡和控制区。常用 props：

```tsx
<Card className="p-5" pattern="app-yellow">
  ...
</Card>

<Card type="dashed" className="p-5">
  空状态或草稿区
</Card>
```

可用色值来自 `CardColor`：

- `default`
- `app-pink`
- `purple`
- `app-blue`
- `app-yellow`
- `app-orange`
- `app-teal`
- `app-green`
- `app-red`
- `lime-green`
- `yellow-green`
- `brown`
- `warm-peach-pink`

本项目常用：

- 核心/总览：`app-teal`
- 运行态：`app-yellow`
- 关系/聊天：`app-pink`
- 对话/梦境：`app-blue`
- Skills/平台：`app-orange` / `yellow-green`
- 配置：`brown`

不要把页面 section 套成一层卡，再在里面塞很多卡形成“卡片套卡片”。列表页和详情页优先用全宽 section + 内部 row。

## Button

常规主按钮优先用库的 `Button`：

```tsx
import { Button, Icon } from "animal-island-ui";

<Button
  type="primary"
  size="large"
  icon={<Icon name="icon-variant" size={20} />}
  loading={loading}
  onClick={reload}
>
  刷新状态
</Button>
```

常用 props：

- `type`: `primary` / `default` / `dashed` / `text` / `link`
- `size`: `small` / `middle` / `large`
- `danger`
- `ghost`
- `block`
- `loading`
- `disabled`
- `icon`
- `htmlType`: `button` / `submit` / `reset`

密集管理页里也可以继续用原生 `<button>`，因为 `.admin-island-shell` 已经统一了普通按钮高度、按压和点击扩散。但要注意：

- 普通按钮默认不折行，长文案会被压缩或截断。
- 带标题 + 小字说明的入口用 `.admin-stacked-tab-button`，不要用普通按钮。
- 纯图标按钮用 `.admin-icon-button`，自己固定 `h-* w-*`。
- 危险操作可以用按压反馈，但不要配欢快 splash 或过多装饰。

## Input / 表单

简单输入框优先用库的 `Input shadow`：

```tsx
import { Input } from "animal-island-ui";

<Input
  value={adminToken}
  onChange={(event) => setAdminToken(event.target.value)}
  onClear={() => setAdminToken("")}
  placeholder="Bearer token，本地保存"
  type="password"
  size="middle"
  shadow
  allowClear
/>
```

密集表单继续用 `.field-input`，比如编辑关系、配置中心、多行文本：

```tsx
<input className="field-input" value={value} onChange={...} />
<textarea className="field-input min-h-20 resize-y leading-6" value={value} onChange={...} />
```

`.field-input` 已经和当前 admin 的圆角、边框、focus 光晕对齐；不要在单页里手写另一套输入框尺寸。

## Icon

库只有 10 个内置图标，类型是 `IconName`：

- `icon-miles`
- `icon-camera`
- `icon-chat`
- `icon-critterpedia`
- `icon-design`
- `icon-diy`
- `icon-helicopter`
- `icon-map`
- `icon-shopping`
- `icon-variant`

用法：

```tsx
import { Icon, type IconName } from "animal-island-ui";

<Icon name="icon-chat" size={22} bounce />
```

`bounce` 适合导航、状态卡和轻量装饰。不要在同一个局部把 `Icon bounce`、强 hover、强 loading、强点击粒子全部叠起来。

## Cursor

全局 admin cursor 在 `AdminShell.tsx`：

```tsx
<Cursor forceAll className="admin-island-shell">
  ...
</Cursor>
```

注意事项：

- 不要在页面内部再嵌套 `Cursor`。
- 不要从 `animal-island-ui` 内部深路径 import cursor CSS。
- Cursor 样式兼容代码在 `web/src/index.css`，如果升级库后 cursor 异常，先检查这里。

## Time

`Time` 是侧栏的 Island Clock：

```tsx
<div className="admin-sidebar-time mt-3">
  <Time />
</div>
```

`Time` 没有 format、timezone、value 这类配置，使用浏览器本地时间。它默认尺寸偏大，放在侧栏时必须套 `.admin-sidebar-time`。

## Title

`Title` 是强视觉 ribbon，适合总览页主标题、品牌处标题：

```tsx
<Title size="small" color="app-teal">
  Lusiyuan Core
</Title>
```

不要用 `Title` 做表格标题、卡片小标题、列表标题。密集后台里小标题直接用 `h3` / 字重 / chip 更清楚。

## Tabs / Checkbox / Radio / Select / Switch

这些组件当前还没有大面积落到 admin 页面，但可以逐步替换旧控件。

推荐使用场景：

- `Tabs`：页面内部二级视图，例如“记忆库 / 提案审核”。如果 tab 带小字说明，当前项目已有 `.admin-stacked-tab-button`，优先保持现状。
- `Checkbox` / `Radio`：筛选项、批量操作选项，库自带 splash 爆开动画。
- `Switch`：配置项启用/关闭，尤其是立即生效的数据库配置。
- `Select`：枚举筛选。注意它是 controlled only，必须传 `value` 和 `onChange`。

`Select` 示例：

```tsx
const [status, setStatus] = useState("all");

<Select
  value={status}
  onChange={setStatus}
  options={[
    { key: "all", label: "全部" },
    { key: "enabled", label: "已启用" },
    { key: "disabled", label: "已关闭" },
  ]}
/>
```

如果某页已经有高密度筛选条，先保证对齐和空间，再决定是否替换为库组件。不要为了“用了组件库”牺牲信息密度。

## Table / 列表

`animal-island-ui` 有 `Table`，但本项目很多 admin 列表有复杂行操作、详情展开和响应式布局，目前仍大量使用原生 grid/table。

新列表建议：

- 数据很规整、列固定、操作少：可以考虑 `Table`。
- 需要多行摘要、chips、操作按钮、移动端重排：继续用原生 `grid` / `table`，套 `admin-island-row`、统一边框和 hover。
- 不要把长摘要硬塞进单行 truncate；管理台主要内容要能读清楚。

关系页当前例子见 `RelationshipStatePage.tsx`：

- `/admin/relationships` 只放列表。
- `/admin/relationships/:id` 放详情、编辑和关系变更。
- 列表列对齐，主要内容完整换行。
- 变更记录按类型筛选和分组。

## Modal / Tooltip / Collapse

可以用，但要克制：

- `Modal`：确认复杂操作、展示较短详情。动态内容建议 `typewriter={false}`。
- `Tooltip`：图标按钮或不熟悉控件的解释。不要用 Tooltip 承载必须阅读的信息。
- `Collapse`：FAQ 风格的单块折叠。它不是 accordion 组；需要多个就渲染多个。

复杂详情页优先复用：

- `AdminDetailPrimitives.tsx`
- `RuntimeEventDetail.tsx`
- `StateChangeDetail.tsx`

这符合项目规则：`RuntimeEventDetail` 解释“发生了什么、有没有资格影响长期状态”，`StateChangeDetail` 解释“最终写入后，状态实际改了什么”，两者共享 admin 详情展示语言。

## Loading / Phone / Wallet / Footer / Divider

谨慎使用：

- `Loading`：全屏阻塞才用，不适合局部列表刷新。
- `Phone`：固定尺寸偏展示，不适合密集 admin 主体。
- `Wallet`：可用于资源/积分类小徽章，目前 admin 暂无核心场景。
- `Footer` / `Divider`：偏装饰，后台页面一般不需要明显收尾。

## 本项目自定义类速查

定义在 `web/src/index.css`：

- `.admin-island-shell`：admin 外壳背景、全局颜色上下文。
- `.admin-island-sidebar`：侧栏背景。
- `.admin-island-main-header`：顶部 header。
- `.admin-sidebar-nav`：桌面侧栏可滚动，移动端横向滚动。
- `.field-input`：admin 原生 input/select/textarea 的统一样式。
- `.admin-chip`：小胶囊标签基础样式。
- `.admin-chip-mint` / `.admin-chip-yellow` / `.admin-chip-pink`：常用状态色。
- `.admin-island-row`：列表行、信息行、轻量容器。
- `.admin-island-soft-panel`：空状态、提示区。
- `.admin-stacked-tab-button`：带标题和描述的二级入口按钮。
- `.admin-icon-button`：纯图标按钮约定类。

页面里如果要新增通用样式，优先扩展这里，不要在单个页面复制一套按钮/输入框动效。

## 颜色和尺寸

优先使用 `web/src/index.css` 的变量：

```css
--ls-bg: #f8f8f0;
--ls-ink: #725d42;
--ls-ink-strong: #794f27;
--ls-ink-soft: #9f927d;
--ls-ink-muted: #8a7b66;
--ls-ink-faint: #b19a82;
--ls-code-text: #5c4630;
--ls-panel: rgb(247, 243, 223);
--ls-panel-soft: #fff9e8;
--ls-border: #e8dcc8;
--ls-border-strong: #c4b89e;
--ls-mint: #19c8b9;
--ls-mint-soft: #e6f9f6;
--ls-mint-light: #82d5bb;
--ls-mint-text: #17766e;
--ls-yellow: #f7cd67;
--ls-yellow-soft: #fff4c7;
--ls-yellow-text: #7a5a12;
--ls-eyebrow-text: #8a6f5a;
--ls-warning-bg: #fff6f1;
--ls-warning-border: #ead4c8;
--ls-warning-text: #8d6048;
--ls-warning-bg-hover: #ffefe7;
--ls-success-bg: #eef8f2;
--ls-success-border: #b9d8c7;
--ls-success-text: #3f7b5d;
--ls-success-bg-hover: #e2f3ea;
--ls-info-border: #e4d8b6;
--ls-info-text: #7d6a34;
--ls-info-bg-hover: #fff4d6;
--ls-panel-cold: #f3f7fb;
--ls-panel-cold-deep: #e4ebf3;
--ls-panel-cold-light: #dbeaf4;
--ls-border-cold: #c9d6e5;
--ls-border-cold-soft: #a9bfd7;
--ls-link: #52769d;
--ls-link-soft: #6f8fb8;
--ls-success-text-strong: #476451;
--ls-success-text-soft: #6aa47e;
--ls-success-border-soft: #75a184;
--ls-success-bg-soft: #b9d4c1;
--ls-success-border-light: #9fc7ae;
--ls-warning-text-strong: #9a6048;
--ls-warning-border-strong: #d7a28e;
--ls-accent-coral: #d86a50;
--ls-section-mint-text: #285d50;
--ls-section-lime: #d1da49;
--ls-section-lime-text: #3d5a1a;
--ls-section-purple: #b77dee;
--ls-section-warm-peach: #e18c6f;
--ls-section-yellow-green: #ecdf52;
--ls-section-brown: #9a835a;
--ls-ink-cold: #475569;
--ls-pink: #f8a6b2;
--ls-pink-soft: #fde4e8;
--ls-pink-text: #a85565;
--ls-blue: #889df0;
--ls-green: #8ac68a;
--ls-orange: #e59266;
--ls-red: #e05a5a;
--ls-disabled-bg: #ece8dc;
--ls-disabled-text: #c4b89e;
--ls-3d-shadow: #d4c9b4;
--ls-3d-shadow-strong: #bdaea0;
--ls-shadow: 0 8px 24px rgba(61, 52, 40, 0.12);
```

控件尺寸：

```css
--admin-control-height-sm: 36px;
--admin-control-height: 45px;
--admin-control-height-lg: 48px;
--admin-control-padding-x: 16px;
--admin-control-radius: 999px;
```

不要引入新的随机按钮高度。普通按钮 45px，小筛选 36px，重要主按钮 48px。

## 后续优化 checklist

改 admin 页面前先过一遍：

- 页面职责是否和已有页面/组件重叠？
- 列表页是否只展示列表，详情是否进入单独详情区或详情页？
- 主要内容是否完整可读，是否被 truncate 过度截断？
- 按钮、输入框高度是否符合统一规范？
- 是否优先复用了 `StatusPill`、`AdminDetailPrimitives`、`StateChangeDetail` 等已有组件？
- 如果用了 `animal-island-ui` 新组件，props 是否存在于 `dist/types/index.d.ts`？
- 移动端是否不会横向滚动？
- 是否跑过 `pnpm web:build`？

视觉检查建议：

```bash
pnpm web:build
```

如果改了后端类型或共享 API：

```bash
pnpm build
pnpm test
```

除非用户允许，不要为了视觉检查随手启动新的 dev server；如果启动了，结束前要明确关闭。

