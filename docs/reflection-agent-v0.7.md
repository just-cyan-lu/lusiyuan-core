# Reflection Agent — v0.7 技术设计文档

## 概述

反思代理（Reflection Agent）是一个离线分析系统，定期或按需读取历史对话，通过模型分析生成**记忆提案**。所有提案需要 owner 审核后才能写入长期记忆，系统本身不会自动修改任何数据。

核心设计原则：**提案制，不自动写入**。

---

## 架构

```
触发（手动 / CLI / 定时）
    ↓
ReflectionJob（DB，status: pending）
    ↓
ReflectionContextBuilder → 读取消息 + 记忆 + 人格
    ↓
runReflectionAnalysis → modelProvider.chatJson()
    ↓
ReflectionPolicy → 过滤低置信度 / 违禁内容 / 高风险提案
    ↓
ReflectionReport + MemoryProposal[] + ReflectionRiskFlag[] + GrowthLogProposal[]（DB）
    ↓
owner 通过 HTTP 接口 或 CLI 审核提案
    ↓
ReflectionProposalService.applyProposal() → 写入 Memory 表
```

---

## 数据库表

| 表名 | 用途 |
|------|------|
| `ReflectionJob` | 每次反思任务的执行记录 |
| `ReflectionReport` | 模型输出的分析报告（1:1 对应 Job） |
| `MemoryProposal` | 记忆提案（create / update / supersede / archive） |
| `ReflectionRiskFlag` | 风险标记（边界侵蚀、身份混淆等） |
| `GrowthLogProposal` | 成长日志提案（待 owner 确认后写入） |

---

## 提案类型

| 类型 | 说明 |
|------|------|
| `create_memory` | 新增一条记忆 |
| `update_memory` | 更新现有记忆的内容 |
| `supersede_memory` | 用新内容替换旧记忆（旧条目标记 superseded） |
| `archive_memory` | 将过时的记忆归档 |

---

## 风险标记类型

| 类型 | 说明 |
|------|------|
| `boundary_erosion` | 陆思源被诱导表现得越来越像真人 |
| `identity_confusion` | 用户或对话造成了身份混淆 |
| `emotional_dependency` | 用户表现出对 AI 的情感依赖 |
| `sensitive_topic` | 出现敏感话题 |
| `data_quality` | 记忆中有低质量或矛盾的数据 |

---

## 反思范围（Scope）

| Scope | 说明 |
|-------|------|
| `conversation` | 单个对话 |
| `user` | 某个用户的所有对话 |
| `global_project` | 全局（不限用户） |
| `daily` | 最近 24 小时 |

---

## 策略过滤（ReflectionPolicy）

提案在写入 DB 前经过以下过滤：

1. **违禁内容检测**：包含"装真人"、"假装真人"、"编造身份"等关键词的提案自动拦截
2. **高风险边界提案**：`scope=boundary` 且 `riskLevel=high` 的提案默认拦截

低置信度、数量过多和成长记录是否采纳，都不再由运行时配置提前丢弃，交给 admin 审核界面判断。

---

## 运行时配置

Reflection 不再提供运行时配置；手动请求参数决定复盘范围，生成结果统一进入待审核队列。

---

## 未实现 / 不做了

| 项目 | 状态 | 说明 |
|------|------|------|
| 审核 UI（图形界面） | ⏭ 跳过 | 属于前端仓库（lusiyuan-web）的工作，目前审核只能通过 HTTP API 或 CLI |
| MCP 接入（v0.7 计划） | ⏭ 推迟 | v0.75 做了 Dream Cycle，MCP 未实现，占位符保留在 `src/mcp/` |
