# Admin Style Guide

这份规范用于陆思源 admin 平台。目标是保留后台的可读性和操作效率，同时明确带有温暖、圆润、轻游戏感的个人色彩。

具体接入和组件使用方式见 `web/src/components/admin/ANIMAL_ISLAND_UI_USAGE.md`。这份文件更适合作为后续 session / 其他 agent 的交接手册；本文只保留视觉和交互规范。

## 风格原则

- 主视觉使用 animal-island-ui：奶油米白背景、暖棕文字、薄荷绿主色、彩色浅底 pattern 卡片。
- 功能页可以可爱，但不能牺牲信息密度。列表、筛选、详情和危险操作必须清楚。
- 页面优先复用共享 admin primitive，不为相同职责重复做 UI。
- 视觉层次靠边框、浅 pattern、字重和间距，不靠大面积冷色阴影。

## 页面结构

- 外层使用 `AdminShell`，不要在页面里重新做全局导航或全局背景。
- 页面主内容默认使用 `mx-auto max-w-7xl space-y-5`。
- 顶部说明卡可用 `Card pattern="app-teal"` 或 `pattern="app-yellow"`。
- 详情信息优先使用 `DetailInfoLine` 和 `RawJsonDetails`，让状态变更详情保持统一展示语言。

## 组件选择

- 常规按钮优先用 `animal-island-ui` 的 `Button`。
- 强行动作使用 `Button type="primary"`；危险动作使用 `Button type="primary" danger`。
- 输入框优先用 `Input shadow`。原生输入继续使用 `.field-input`，避免单页手写尺寸。
- 小状态使用 `StatusPill`，不要散落手写颜色。
- 表格型数据后续优先考虑 `Table`，但复杂行操作可先保留原生表格并套 admin 样式。
- 状态标签优先用 `Tag`，颜色与 `Card` 共享色板；不要用新的手写 badge。
- 全局操作反馈优先用 `Notification`（保存成功、归档、导入导出等）。
- 固定范围进度展示用 `Progress`；临时/不确定进度继续用文本 loading。

## 控件尺寸

CSS 变量定义在 `web/src/index.css`：

- `--admin-control-height-sm: 36px`
- `--admin-control-height: 45px`
- `--admin-control-height-lg: 48px`
- `--admin-control-padding-x: 16px`
- `--admin-control-radius: 999px`

普通页面按钮默认高度 45px，对齐 animal-island-ui 的 `Button size="middle"`；不折行，文字过长时截断。重要主按钮可用 48px。小筛选按钮可用 36px，但不要再引入新的随机高度。

带标题 + 小字说明的入口不要套普通按钮规范；统一使用 `.admin-stacked-tab-button`。它是 82px 起的卡片按钮，左侧图标、右侧标题和最多两行说明，适合“记忆库 / 提案审核”这种二级入口。

纯图标按钮不要套普通按钮规范；统一加 `.admin-icon-button`，再用固定 `h-* w-*` 控制为正方形，适合发送、关闭、折叠这类只有图标的操作。

`.field-input` 的普通 input/select 固定 40px；textarea 不固定高度，只保留同款圆角、边框和 focus。

## 交互

- Admin 外壳使用 `Cursor forceAll`，让整个后台都带 animal-island-ui 的自定义鼠标图标。
- animal-island-ui 没有全局点击粒子组件；它的点击语言主要是 Button 的下压和 Checkbox/Radio 的 splash。
- 本 admin 对原生按钮补了统一 tap feedback：hover 轻微上浮，active 下压，点击时有轻微圆形扩散。
- 不要在单页里再写新的 button active 动画；需要特殊按钮时先扩展共享样式。

## 动效 / 特效目录

以下清单来自当前使用的 `animal-island-ui@1.2.0` 源码。新增页面优先复用这些效果，不随手发明新的动效体系。

### 已在 admin 使用

- `Cursor forceAll`：全局自定义手指光标。注意 `animal-island-ui@1.0.16` 的 root 样式未实际带出 Cursor CSS；本项目在 `index.css` 放了兼容 shim，避免从库内部深路径 import。
- `Button` 按压：primary 按钮使用 3D 厚阴影，hover 上浮，active 下压，阴影从 `0 5px` / `0 6px` 回落到 `0 1px`。
- 原生 admin 按钮 tap feedback：`.admin-island-shell` 下的普通按钮统一 hover 上浮、active 下压，并使用 `admin-click-pop` 做轻圆形扩散。
- `Card pattern`：彩色浅底点阵纹理，用于页面主卡、信息卡和控制区。
- `Icon bounce`：`<Icon bounce />` 在 hover 时缩放并轻微旋转，适合导航、状态卡、轻量装饰。
- `Time` HUD：进入时 `ac-fade-up`，冒号 blink；在侧栏中必须用 `.admin-sidebar-time` 压缩尺寸。

### 推荐继续使用

- `Tag`：capsule 标签，hover/active 有轻微上浮和阴影。适合状态、分类、轻量筛选标签。`onClick` 会让它变成可键盘访问的按钮。
- `Notification`：命令式 toast，success/info/warning/error 四色，默认顶部居中 4.5s 自动关闭，支持同 key 原地更新。
- `Progress`：水平条纹进度条，fill 宽度过渡 + 条纹无限滚动。小空间用 `size="small"`。
- `Checkbox` / `Radio` splash：选中时圆形 splash 爆开，周围用 box-shadow 生成六向小圆点，同时勾选路径有 stroke-dashoffset 绘制效果。
- `Input shadow`：显式 `shadow` 后有 3D 输入框厚度；hover 边框/阴影变深，focus 使用黄色光晕。
- `Switch`：handle 横向滑动，track 使用 inset shadow；loading 状态有小 spinner。
- `Select`：打开时箭头旋转、dropdown fade-in；选项 hover 显示 `select-cursor.svg` 从左侧滑入；选中项有黄色 pillBar。
- `Tabs`：active 点位 scale，active shadow 可选；当前 tab 的叶子图标 `leafWiggle` 摇摆，内容区 fade-up。
- `Table`：行分隔使用 dashed 横线；row hover 是薄荷色斜纹，并用圆角 clip-path；loading overlay 带 SVG spin/dash。
- `Collapse`：展开使用 CSS Grid `0fr -> 1fr`，图标旋转，叶子装饰旋转。
- `Modal`：mask fade-in，主体 zoom-in；内容容器使用 SVG blob clip-path；默认 body 可 typewriter。
- `Tooltip`：默认版使用 opacity/transform 过渡；`variant="island"` 使用有机气泡、tail 和 drop-shadow，支持 hover/focus/click。

### 谨慎使用

- `Drawer`：`pushBackground` 会让整个页面主体下沉 + 变暗，视觉重量大。适合需要从边缘推出的详情/筛选面板；普通内联详情不需要。
- `Loading`：全屏岛屿 loading，当前实现包含 bundled GSAP/MotionPathPlugin 动画，关闭时有 radial mask 收尾。适合全屏阻塞，不适合小局部加载。
- `Phone`：有 home screen 背景 `grasswave`、冒号 blink、app icon bounce。适合展示/玩具化视图，不适合密集管理页主体。
- `Wallet`：钱袋 hover bounce 和胶囊数字样式。适合积分/计数/资源类徽章。
- `Title` Ribbon：燕尾 clip-path、折角和轻 3D 透视是强视觉信号。移动端长中文标题不要直接用大号 Ribbon。
- `Footer` / `Divider`：主要是装饰素材和虚线分隔，没有复杂动效。只在页面需要明显段落收尾时使用。

### 使用边界

- 列表、日志、详情页避免过量动画；优先用 hover、focus、loading 三类必要反馈。
- 同一个局部不要叠加超过两种强动效，例如 Button press + Icon bounce 已经足够。
- 危险操作可以有按压反馈，但不要使用欢快 splash，以免削弱风险感。
- 长文本按钮不要折行；使用统一按钮高度和 `white-space: nowrap`，必要时缩短文案。

## 移动端

- 侧栏在移动端变横向滚动导航，桌面端固定左侧并允许纵向滚动。
- Ribbon 标题只适合中大屏，移动端长中文标题用普通粗体标题。
- 页面不能产生横向滚动；固定宽度工具条要有 `max-width: 100%` 或换行策略。

## 颜色

优先使用现有变量：

- 主背景：`--ls-bg`
- 主文字：`--ls-ink` / `--ls-ink-strong`
- 次级文字：`--ls-ink-soft`
- 面板：`--ls-panel`
- 边框：`--ls-border` / `--ls-border-strong`
- 主色：`--ls-mint`

可选 accent 色来自 animal-island-ui 的 Card/Title 色板：`app-teal`、`app-yellow`、`app-pink`、`app-blue`、`app-orange`、`lime-green`。
