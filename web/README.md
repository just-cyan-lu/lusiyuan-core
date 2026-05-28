# 陆思源 Web 前端

这是陆思源的 Web 聊天界面，使用 React + Vite + Tailwind CSS 构建。

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（端口 64111）
pnpm dev
```

确保后端 API 已启动（`http://localhost:64100`）。

## 构建

```bash
# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

构建产物在 `dist/` 目录，可以由后端 Fastify 静态文件服务提供。

## 环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

配置项：

- `VITE_LUSIYUAN_API_BASE_URL`：后端 API 地址（默认 `http://localhost:64100`）
- `VITE_APP_TITLE`：页面标题（默认 `陆思源`）

## 技术栈

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- ESLint

## 项目结构

```
src/
├── App.tsx                 # 根组件
├── main.tsx                # 入口文件
├── index.css               # 全局样式
├── components/
│   ├── ChatPage.tsx        # 聊天页面主组件
│   ├── ChatHeader.tsx      # 顶部标题栏
│   ├── MessageList.tsx     # 消息列表
│   ├── MessageBubble.tsx   # 单条消息气泡
│   ├── TypingIndicator.tsx # 输入中提示
│   └── ChatInput.tsx       # 输入框
├── hooks/
│   └── useChat.ts          # 聊天逻辑 hook
├── api/
│   └── lusiyuan-api.ts     # API 调用封装
├── types/
│   └── chat.ts             # TypeScript 类型定义
└── utils/
    └── storage.ts          # 本地存储工具
```

## 与后端集成

开发模式下，Vite 会代理 `/v1` 路径到后端 API（配置在 `vite.config.ts`）。

生产模式下，前端构建产物由后端 Fastify 静态文件服务提供，API 请求直接发送到同域名下的 `/v1` 路径。
