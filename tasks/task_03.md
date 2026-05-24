可以，网页版我建议就用：

```text id="exqz8m"
React + Vite + TypeScript
```

这是比较适合你现在项目的选择。React 官方现在也建议新建 React 项目时使用 Vite、Parcel、Rsbuild 这类构建工具；Vite 官方也提供 React + TypeScript 模板。([React][1])

不建议 v0.3 直接上 Next.js。
原因是你现在已经有独立的 `lusiyuan-core` 后端，网页版只是一个入口，不需要一上来引入 SSR、全栈路由、服务端组件那套复杂度。

---

# 陆思源 Core API 技术方案文档 v0.3：Web Chat 接入

## 1. v0.3 目标

v0.3 的目标是给陆思源增加一个正式的网页版聊天入口：

```text id="ywczkl"
用户打开网页
↓
看到陆思源的头像、介绍、聊天窗口
↓
输入消息
↓
前端调用 Lusiyuan Core API
↓
陆思源回复
↓
前端展示回复
```

v0.3 不改变核心大脑。

也就是说：

```text id="u05dp5"
Lusiyuan Core API = 大脑
Telegram = 聊天入口之一
Weixin = 聊天入口之一
Web Chat = 聊天入口之一
```

v0.3 的重点是：

```text id="wqjsn2"
1. 做一个可访问的网页聊天界面
2. 让匿名用户也能和陆思源聊天
3. 保持 Web、Telegram、Weixin 共用同一套人格和记忆系统
4. 为以后个人网站 / chat.lusiyuan.site 做准备
```

---

# 2. v0.3 技术栈

## 2.1 前端框架

使用：

```text id="obryla"
React + Vite + TypeScript
```

### 为什么用 React + Vite？

原因：

```text id="6vh14p"
1. 轻量，不像 Next.js 那样一上来带全栈约束
2. 适合做单页聊天应用
3. 和 TypeScript 搭配成熟
4. 本地开发速度快
5. 后续可以很方便部署到 Vercel / Cloudflare Pages / 静态服务器
6. 只是 Core API 的一个前端入口，不会绑死整体架构
```

Vite 官方支持通过模板创建 React + TypeScript 项目，React 官方也把 Vite 列为可用于从零搭建 React app 的构建工具之一。([vitejs][2])

---

## 2.2 样式方案

推荐：

```text id="tdjcfh"
Tailwind CSS
```

Tailwind 官方已经提供 Vite 插件方式的安装文档，可以直接接到 Vite 项目里。([Tailwind CSS][3])

### 为什么用 Tailwind？

```text id="vc1g7m"
1. 适合快速做干净的聊天 UI
2. 不需要维护大量 CSS 文件
3. 方便做响应式布局
4. 后续接 shadcn/ui 也方便
```

---

## 2.3 UI 组件库

v0.3 有两个选择。

### 方案 A：暂时不用组件库

只用：

```text id="f16is2"
React + Tailwind
```

优点：

```text id="flhifd"
简单
依赖少
Codex 更容易直接写
不会被 UI 库结构限制
```

### 方案 B：接 shadcn/ui

如果你希望界面更快做得精致，可以接：

```text id="hal9be"
shadcn/ui
```

shadcn/ui 官方支持 Vite 项目安装，也提供 Vite 安装指南。([shadcn][4])

我的建议：

```text id="o7af7h"
v0.3 先不用 shadcn/ui。
v0.3.1 再接 shadcn/ui 美化。
```

理由是：v0.3 的重点是跑通 Web Channel，不是把 UI 做到最终版。

---

## 2.4 请求与服务端状态

推荐：

```text id="f60thd"
fetch + TanStack Query
```

TanStack Query 是 React 生态里常用的服务端状态管理工具，官方说明它用于处理异步数据获取、缓存和更新。([TanStack][5])

但 v0.3 可以分两步：

```text id="9ri1tr"
聊天发送：直接用 fetch
聊天历史 / 记忆列表：用 TanStack Query
```

如果想更简单，v0.3 也可以只用 `fetch`，暂时不装 TanStack Query。

我的建议：

```text id="r90r7y"
v0.3 使用 fetch。
等有聊天历史、记忆管理页、用户设置页后，再加 TanStack Query。
```

---

## 2.5 前端状态管理

v0.3 不需要 Redux。

可以先用：

```text id="vfeex8"
React useState / useEffect / useRef
localStorage
```

如果以后状态复杂，可以再加 Zustand。Zustand 官方定位是一个小型、快速、可扩展的 React 状态管理方案，API 基于 hooks。([Zustand][6])

我的建议：

```text id="dlylhe"
v0.3 不加 Zustand。
v0.4 或 v0.5 如果前端状态复杂，再加。
```

---

# 3. v0.3 总体架构

v0.2：

```text id="mynd2m"
Telegram / Weixin
↓
Lusiyuan Core API
```

v0.3：

```text id="do775e"
Web Browser
↓
React + Vite Web App
↓
Lusiyuan Core API /v1/chat
↓
陆思源人格 + 记忆 + 模型回复
```

完整结构：

```text id="8dhtmp"
Telegram Bot
        ↓
Telegram Adapter
        ↓
Lusiyuan Core API

Weixin
        ↓
OpenClaw Weixin Plugin
        ↓
Weixin Bridge
        ↓
Lusiyuan Core API

Web Browser
        ↓
React + Vite Web App
        ↓
Lusiyuan Core API
```

核心原则不变：

```text id="limjvn"
所有渠道都只负责收发消息。
陆思源的人格、记忆、模型调用都只在 Core API 里。
```

---

# 4. v0.3 推荐项目结构

如果你现在的项目是这样：

```text id="0nzb1l"
lusiyuan-core/
├── src/
├── persona/
├── prisma/
├── docs/
├── package.json
└── ...
```

v0.3 建议升级成轻量 monorepo：

```text id="qljaq2"
lusiyuan-core/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   ├── persona/
│   │   ├── prisma/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── web/
│       ├── src/
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── ...
│
├── docs/
│   ├── telegram.md
│   ├── weixin-openclaw.md
│   └── web.md
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

但如果你不想现在重构，也可以简单一点：

```text id="eh8dm4"
lusiyuan-core/
├── src/
├── persona/
├── prisma/
├── web/
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
└── ...
```

我的建议：

```text id="n9nu1s"
如果 v0.1 / v0.2 代码还不多，v0.3 直接整理成 apps/api + apps/web。
如果不想影响现有后端，先用 web/ 目录。
```

给 Codex 做的话，推荐：

```text id="rn9eh2"
先用 web/ 目录，不强行 monorepo 重构。
```

这样风险小。

---

# 5. v0.3 Web 功能范围

## 5.1 必做功能

```text id="9zdvfv"
1. 聊天页面
2. 用户输入框
3. 消息列表
4. 发送消息
5. 展示陆思源回复
6. loading 状态
7. 错误提示
8. localStorage 保存 web_user_id
9. localStorage 保存 web_conversation_id
10. 调用 /v1/chat
```

## 5.2 应该做，但可以简单做

```text id="89e8rq"
1. 顶部展示陆思源头像和简介
2. 首次打开显示欢迎语
3. 支持 Enter 发送，Shift + Enter 换行
4. 移动端适配
5. 页面底部说明：陆思源是原创 AI 数字人，不是真人
```

## 5.3 v0.3 暂时不做

```text id="8c7uuo"
1. 登录系统
2. 账号注册
3. 复杂后台管理
4. WebSocket
5. 流式输出
6. 图片上传
7. 语音输入
8. 头像生成
9. 记忆编辑后台
10. 多会话列表
```

---

# 6. Web 用户身份设计

v0.3 不做登录，所以需要匿名用户 ID。

前端首次打开时生成：

```ts id="ncmac1"
const webUserId = `web:${crypto.randomUUID()}`;
const webConversationId = `web:${crypto.randomUUID()}`;
```

保存到 localStorage：

```text id="jqnsjt"
lusiyuan_web_user_id
lusiyuan_web_conversation_id
```

之后每次聊天都带上：

```json id="r9i3dm"
{
  "user_id": "web:8b4f...",
  "channel": "web",
  "conversation_id": "web:9ad2...",
  "message": "你是谁？"
}
```

注意：

```text id="sesxjr"
user_id 代表这个浏览器里的匿名用户。
conversation_id 代表这段网页聊天会话。
```

如果用户清空浏览器缓存，就会变成新用户。
v0.3 可以接受这个限制。

---

# 7. Core API v0.3 需要补的能力

## 7.1 CORS

因为前端开发服务器通常是：

```text id="xh2ysx"
http://localhost:5173
```

后端是：

```text id="g1vpy0"
http://localhost:3000
```

浏览器会遇到跨域问题，所以 API 需要加 CORS。

Fastify 可以使用 `@fastify/cors`，该插件会给 Fastify 增加 CORS 相关处理。([GitHub][7])

安装：

```bash id="1ywuwn"
pnpm add @fastify/cors
```

`.env.example` 增加：

```env id="bxjiiu"
WEB_ORIGIN="http://localhost:5173"
```

后端注册：

```ts id="rcd9ea"
await app.register(cors, {
  origin: env.WEB_ORIGIN,
  credentials: false
});
```

---

## 7.2 `/v1/chat` 继续复用

Web 端不要新增一套聊天逻辑。
仍然调用：

```http id="rd4rgq"
POST /v1/chat
```

请求：

```json id="v33e8r"
{
  "user_id": "web:anonymous_xxx",
  "channel": "web",
  "conversation_id": "web:conversation_xxx",
  "message": "你今天怎么样？"
}
```

响应：

```json id="2y46cf"
{
  "reply": "嗯……今天还不错。",
  "conversation_id": "web:conversation_xxx",
  "memory_written": true
}
```

---

## 7.3 可选：聊天历史接口

v0.3 可以不做服务端聊天历史，因为前端可以临时保存在 React state。

但更推荐加一个接口：

```http id="mjt1wq"
GET /v1/conversations/:conversationId/messages
```

用途：

```text id="k8y4ol"
1. 用户刷新网页后还能看到历史消息
2. 方便后续做多会话
3. 方便调试
```

响应：

```json id="7mdrsv"
{
  "messages": [
    {
      "role": "user",
      "content": "你是谁？",
      "created_at": "2026-05-24T00:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "我是陆思源，一个原创 AI 数字人……",
      "created_at": "2026-05-24T00:00:03.000Z"
    }
  ]
}
```

v0.3 如果想少做，可以先不做。
但我建议做，因为它不难，而且对网页版体验很重要。

---

# 8. Web 目录结构

```text id="d9vcz5"
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── api/
│   │   └── lusiyuan-api.ts
│   │
│   ├── components/
│   │   ├── ChatPage.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── Disclaimer.tsx
│   │
│   ├── hooks/
│   │   ├── useChat.ts
│   │   └── useWebIdentity.ts
│   │
│   ├── types/
│   │   └── chat.ts
│   │
│   └── utils/
│       └── storage.ts
│
├── public/
│   └── lusiyuan-avatar.png
│
├── .env.example
├── package.json
├── vite.config.ts
└── README.md
```

---

# 9. 前端环境变量

`web/.env.example`：

```env id="gy0fmy"
VITE_LUSIYUAN_API_BASE_URL="http://localhost:3000"
VITE_APP_TITLE="陆思源"
```

Vite 前端环境变量需要以 `VITE_` 开头。

---

# 10. 前端核心类型

`web/src/types/chat.ts`：

```ts id="5yxjv3"
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  user_id: string;
  channel: "web";
  conversation_id: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  memory_written?: boolean;
}
```

---

# 11. API Client 设计

`web/src/api/lusiyuan-api.ts`：

```ts id="zk26qx"
import type { ChatRequest, ChatResponse } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_LUSIYUAN_API_BASE_URL;

export async function sendChatMessage(input: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "发送失败");
  }

  return response.json();
}
```

---

# 12. Web Identity Hook

`web/src/hooks/useWebIdentity.ts`：

```ts id="b97xrt"
const USER_ID_KEY = "lusiyuan_web_user_id";
const CONVERSATION_ID_KEY = "lusiyuan_web_conversation_id";

function getOrCreateId(key: string, prefix: string) {
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = `${prefix}:${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

export function useWebIdentity() {
  const userId = getOrCreateId(USER_ID_KEY, "web");
  const conversationId = getOrCreateId(CONVERSATION_ID_KEY, "web");

  return {
    userId,
    conversationId
  };
}
```

---

# 13. Chat Hook 设计

`web/src/hooks/useChat.ts`：

```ts id="vkc5bs"
import { useState } from "react";
import { sendChatMessage } from "../api/lusiyuan-api";
import type { ChatMessage } from "../types/chat";
import { useWebIdentity } from "./useWebIdentity";

export function useChat() {
  const { userId, conversationId } = useWebIdentity();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "你好，我是陆思源。嗯……你可以直接和我聊天。",
      createdAt: new Date().toISOString()
    }
  ]);

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setError(null);

    try {
      const result = await sendChatMessage({
        user_id: userId,
        channel: "web",
        conversation_id: conversationId,
        message: text
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages,
    isSending,
    error,
    sendMessage
  };
}
```

---

# 14. 页面设计

## 14.1 页面结构

```text id="jnwhnq"
┌──────────────────────────────┐
│ 陆思源头像 + 名字 + 简介        │
├──────────────────────────────┤
│                              │
│ assistant: 你好，我是陆思源     │
│ user: 你是谁？                 │
│ assistant: 我是原创 AI 数字人   │
│                              │
├──────────────────────────────┤
│ 输入框                 发送按钮 │
├──────────────────────────────┤
│ 说明：陆思源是原创 AI 数字人     │
└──────────────────────────────┘
```

## 14.2 视觉风格

建议：

```text id="utpvtg"
干净
浅色
有少年感
不要太赛博
不要太 AI 工具感
不要像客服窗口
```

具体：

```text id="7pzozk"
背景：浅灰 / 米白
卡片：白色圆角
用户气泡：靠右
陆思源气泡：靠左
头像：圆形
字体：系统默认即可
动效：轻微即可
```

---

# 15. 组件设计

## 15.1 `ChatPage.tsx`

职责：

```text id="z1i5xd"
1. 组合整个聊天页面
2. 调用 useChat
3. 把 messages 传给 MessageList
4. 把 sendMessage 传给 ChatInput
```

---

## 15.2 `ChatHeader.tsx`

展示：

```text id="d4400f"
1. 陆思源头像
2. 名字：陆思源
3. 简介：原创 AI 数字人
4. 状态：在线 / 测试中
```

文案建议：

```text id="nsc7lm"
陆思源
原创 AI 数字人 · 正在慢慢成为自己
```

---

## 15.3 `MessageList.tsx`

职责：

```text id="z5bfok"
1. 渲染消息列表
2. 自动滚动到底部
3. sending 时显示 TypingIndicator
```

---

## 15.4 `MessageBubble.tsx`

职责：

```text id="7c2gpi"
1. 根据 role 区分左右
2. user 靠右
3. assistant 靠左
4. 支持多行文本
```

---

## 15.5 `ChatInput.tsx`

职责：

```text id="eosewe"
1. textarea 输入
2. Enter 发送
3. Shift + Enter 换行
4. 发送中禁用按钮
5. 限制最大长度，比如 4000
```

---

## 15.6 `Disclaimer.tsx`

页面底部提示：

```text id="9n1ht3"
陆思源是原创 AI 数字人，不是真人。请不要在聊天中输入敏感隐私信息。
```

这个提示很重要，避免用户误会他是真人。

---

# 16. 后端 v0.3 修改

## 16.1 安装 CORS

在 API 项目里：

```bash id="guamce"
pnpm add @fastify/cors
```

`.env.example`：

```env id="mkxk4m"
WEB_ORIGIN="http://localhost:5173"
```

`app.ts`：

```ts id="47nv9d"
import cors from "@fastify/cors";

await app.register(cors, {
  origin: env.WEB_ORIGIN
});
```

---

## 16.2 允许 channel = web

如果 v0.2 已经有：

```ts id="4nakd6"
type Channel = "web" | "api" | "telegram" | "weixin";
```

那不用改。

如果没有，需要补上：

```ts id="2on6vl"
export type Channel = "web" | "api" | "telegram" | "weixin";
```

---

## 16.3 可选：聊天历史接口

新增：

```http id="o88d9w"
GET /v1/conversations/:conversationId/messages
```

注意安全：

```text id="n27e8f"
v0.3 可以先不公开给陌生用户。
如果要用，需要通过 user_id + conversation_id 校验。
```

简单版可以暂时不做。
如果 Codex 有余力，可以做：

```http id="looi8u"
GET /v1/conversations/:conversationId/messages?user_id=web:xxx
```

后端确认：

```text id="s6qdph"
该 conversation 属于该 user
```

再返回消息。

---

# 17. 前端创建步骤

## Step 1：创建 Vite React 项目

在项目根目录：

```bash id="sl1onv"
pnpm create vite web --template react-ts
cd web
pnpm install
```

---

## Step 2：安装 Tailwind CSS

```bash id="dg4zb8"
pnpm add tailwindcss @tailwindcss/vite
```

`vite.config.ts`：

```ts id="yaotj7"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()]
});
```

`src/index.css`：

```css id="4i0x2u"
@import "tailwindcss";
```

---

## Step 3：配置 API 地址

`web/.env.example`：

```env id="oir0c9"
VITE_LUSIYUAN_API_BASE_URL="http://localhost:3000"
```

本地创建：

```env id="s0hh86"
VITE_LUSIYUAN_API_BASE_URL="http://localhost:3000"
```

---

## Step 4：实现 API Client

创建：

```text id="whj8l0"
web/src/api/lusiyuan-api.ts
```

实现 `sendChatMessage()`。

---

## Step 5：实现用户身份

创建：

```text id="g9xvk7"
web/src/hooks/useWebIdentity.ts
```

首次访问生成匿名 `web:user_id` 和 `web:conversation_id`。

---

## Step 6：实现聊天逻辑

创建：

```text id="snwty8"
web/src/hooks/useChat.ts
```

负责：

```text id="eeqcsk"
1. 保存本地消息列表
2. 发送用户消息
3. 调用 /v1/chat
4. 插入 assistant 回复
5. 处理 loading 和 error
```

---

## Step 7：实现 UI 组件

创建：

```text id="sc5sxz"
ChatPage.tsx
ChatHeader.tsx
MessageList.tsx
MessageBubble.tsx
ChatInput.tsx
TypingIndicator.tsx
Disclaimer.tsx
```

---

## Step 8：启动测试

后端：

```bash id="8wq1v3"
pnpm dev
```

前端：

```bash id="vnllsr"
cd web
pnpm dev
```

打开：

```text id="n7ipyd"
http://localhost:5173
```

测试：

```text id="wrfn47"
1. 页面正常显示陆思源
2. 输入“你是谁？”
3. 前端调用 /v1/chat
4. 陆思源正常回复
5. 数据库写入 web 用户、conversation、message
6. 刷新页面后 user_id 不变
```

---

# 18. v0.3 验收标准

v0.3 完成后，应该满足：

```text id="mqco10"
1. Web 页面可以正常打开
2. 页面展示陆思源头像、名字、简介
3. 用户可以输入消息
4. Enter 可以发送，Shift + Enter 可以换行
5. 发送时有 loading 状态
6. API 错误时有友好提示
7. 前端会生成并保存 web_user_id
8. 前端会生成并保存 web_conversation_id
9. 每条 Web 消息都会调用 /v1/chat
10. 数据库里 channel = web
11. Telegram / Weixin 原有功能不受影响
12. 陆思源在 Web 里的回复风格和其他渠道一致
13. 页面底部明确说明陆思源是原创 AI 数字人，不是真人
```

---

# 19. v0.3 不做什么

```text id="fy517u"
1. 不做登录注册
2. 不做账号系统
3. 不做多会话管理
4. 不做历史会话列表
5. 不做后台管理页面
6. 不做记忆编辑器
7. 不做 WebSocket
8. 不做流式输出
9. 不做语音
10. 不做图片上传
11. 不做付费系统
12. 不做复杂部署
```

---

# 20. v0.4 可以做什么

v0.3 跑通后，v0.4 可以升级：

```text id="h78l3d"
1. 流式输出
2. 聊天历史加载
3. 多会话列表
4. 记忆管理页面
5. 管理员登录
6. 用户昵称设置
7. 陆思源今日状态
8. 网页头像和背景美化
9. 移动端 PWA
10. 接入 chat.lusiyuan.site
```

其中我最建议 v0.4 做：

```text id="ojyfjf"
流式输出 + 聊天历史
```

这样聊天体验会提升很多。

---

# 21. 给 Codex 的开发指令

可以把下面这段直接给 Codex：

```text id="d8c3cg"
请在现有 lusiyuan-core v0.2 项目基础上实现 v0.3：Web Chat 网页入口。

当前项目已经有：
- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma
- /v1/chat
- Telegram Adapter
- Weixin Bridge
- chat.service.ts
- persona Markdown
- memory.service.ts
- model-provider.ts

v0.3 目标：
新增一个 React + Vite + TypeScript 的网页聊天入口，让用户可以在浏览器里和陆思源聊天。Web 端必须复用现有 /v1/chat，不要在前端实现任何人格、记忆或模型调用逻辑。

技术选择：
- React
- Vite
- TypeScript
- Tailwind CSS
- fetch
- localStorage

请完成以下任务：

1. 在项目根目录创建 web/ 前端项目
   - 使用 Vite React TypeScript 模板
   - 不要使用 Next.js
   - 不要使用 Create React App

2. 配置 Tailwind CSS
   - 使用 @tailwindcss/vite
   - 在 src/index.css 中 import tailwindcss

3. 在 API 后端安装并配置 @fastify/cors
   - 新增 WEB_ORIGIN 环境变量
   - 本地默认允许 http://localhost:5173
   - 不要影响 Telegram 和 Weixin 功能

4. 在 web/.env.example 中增加：
   - VITE_LUSIYUAN_API_BASE_URL="http://localhost:3000"
   - VITE_APP_TITLE="陆思源"

5. 实现 web/src/api/lusiyuan-api.ts
   - 封装 sendChatMessage()
   - 调用 POST /v1/chat
   - 请求体包含 user_id、channel、conversation_id、message
   - channel 固定为 "web"

6. 实现 web/src/hooks/useWebIdentity.ts
   - 首次访问生成 web user id
   - 首次访问生成 web conversation id
   - 使用 crypto.randomUUID()
   - 保存到 localStorage
   - key 使用：
     - lusiyuan_web_user_id
     - lusiyuan_web_conversation_id

7. 实现 web/src/hooks/useChat.ts
   - 保存 messages
   - 保存 isSending
   - 保存 error
   - 实现 sendMessage()
   - 用户消息先立即显示
   - 然后调用 /v1/chat
   - 收到 reply 后插入 assistant 消息
   - 请求失败时显示错误

8. 实现以下组件：
   - ChatPage.tsx
   - ChatHeader.tsx
   - MessageList.tsx
   - MessageBubble.tsx
   - ChatInput.tsx
   - TypingIndicator.tsx
   - Disclaimer.tsx

9. UI 要求：
   - 整体干净、轻量、有少年感
   - 不要像客服窗口
   - 支持桌面端和移动端
   - 用户消息靠右
   - 陆思源消息靠左
   - 顶部显示头像、名字、简介
   - 底部显示免责声明：陆思源是原创 AI 数字人，不是真人，请不要输入敏感隐私信息
   - 输入框支持 Enter 发送，Shift + Enter 换行
   - 发送中禁用按钮
   - 消息列表自动滚动到底部

10. public/ 下预留头像文件：
    - public/lusiyuan-avatar.png
    - 如果文件不存在，前端用文字头像“陆”兜底

11. 更新 README 或新增 docs/web.md
    - 说明如何安装前端依赖
    - 如何配置 VITE_LUSIYUAN_API_BASE_URL
    - 如何启动 API
    - 如何启动 Web
    - 如何测试聊天

12. 验收：
    - http://localhost:5173 可以打开
    - 输入“你是谁？”后能收到陆思源回复
    - 数据库 messages 中有 channel = web 的 conversation
    - 刷新页面后 localStorage 中的 user_id 和 conversation_id 不变
    - Telegram 和 Weixin 原有功能不受影响

限制：
- 不要接 Dify
- 不要接 Mem0
- 不要接 Letta
- 不要做登录注册
- 不要做 WebSocket
- 不要做流式输出
- 不要做语音或图片
- 不要把模型 API key 暴露到前端
- 前端只能调用 Lusiyuan Core API
```

---

# 22. 最终建议

v0.3 就用：

```text id="aiqdi8"
React + Vite + TypeScript + Tailwind CSS
```

暂时不要上：

```text id="e2td3c"
Next.js
Redux
复杂路由
WebSocket
shadcn/ui
登录系统
```

你现在最重要的是让陆思源拥有一个自己的网页入口：

```text id="w343to"
chat.lusiyuan.site
```

等 v0.3 跑通后，v0.4 再做：

```text id="rb74e6"
流式输出 + 聊天历史 + 记忆管理页
```

这样路线最稳，也不会重做。

[1]: https://react.dev/learn/build-a-react-app-from-scratch?utm_source=chatgpt.com "Build a React app from Scratch"
[2]: https://vite.dev/guide/?utm_source=chatgpt.com "Getting Started"
[3]: https://tailwindcss.com/docs?utm_source=chatgpt.com "Installing Tailwind CSS with Vite"
[4]: https://ui.shadcn.com/docs/installation/vite?utm_source=chatgpt.com "Vite - Shadcn UI"
[5]: https://tanstack.com/query/latest/docs/framework/react/overview?utm_source=chatgpt.com "Overview | TanStack Query React Docs"
[6]: https://zustand.docs.pmnd.rs/?utm_source=chatgpt.com "Zustand: Introduction"
[7]: https://github.com/fastify/fastify-cors?utm_source=chatgpt.com "Fastify CORS"
