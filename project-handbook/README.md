# Project Handbook

这个文件夹是“项目地图”，不是历史文档库。

它给两类人看：

- 给你看：快速知道项目现在有哪些部分、各自做什么、从哪里入口。
- 给 Codex 看：下次改代码前先读这里，再去读具体代码，避免全局乱翻。

`docs/` 里放更细的版本设计和专题说明；`tasks/` 里放历史任务和未来设想。这里放的是当前项目的简明总览。

## 文件怎么读

建议顺序：

1. `project-map.md`：项目有哪些模块，每个模块在哪里。
2. `flows.md`：一条消息、一次工具调用、一次记忆更新是怎么走的。
3. `data-map.md`：数据库里主要表分别代表什么。
4. `runtime-lite-design.md`：正式版 Runtime Lite 设计，当前还没有完全实现。
5. `runtime-feature-archive.md`：最近落地的运行态、关系状态、身份合并、admin 控制等功能归档。

## 更新规则

以后只要改了项目结构，就同步更新这里：

- 新增或删除一个功能模块：更新 `project-map.md`。
- 改了调用链路：更新 `flows.md`。
- 改了 Prisma 表或重要字段：更新 `data-map.md`。
- 改了陆思源运行体、persona、状态系统：更新 `runtime-lite-design.md`。
- 改了已落地的运行态、关系状态、身份合并、admin 控制：更新 `runtime-feature-archive.md`。
- 如果只是修 bug、改 UI 样式、小范围重命名，通常不用更新这里。

这个手册要保持短。它不是复制代码，而是告诉人“现在该去哪里看代码”。
