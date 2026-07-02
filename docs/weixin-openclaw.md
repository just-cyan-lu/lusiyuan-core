# Weixin / 微信接入文档（OpenClaw Bridge）

微信不通过 npm 直接接入，而是通过 **OpenClaw Weixin 插件** + **HTTP Bridge** 的方式接入 Lusiyuan Core API。

## 1. 前置条件

- 已安装 [OpenClaw](https://docs.openclaw.ai) 并可以正常运行
- 微信账号已登录到 OpenClaw

## 2. 安装 OpenClaw Weixin 插件

### 快速安装

```bash
npx -y @tencent-weixin/openclaw-weixin-cli@latest install
```

### 手动安装（如快速安装失败）

```bash
openclaw plugins install "@tencent-weixin/openclaw-weixin"
openclaw config set plugins.entries.openclaw-weixin.enabled true
openclaw gateway restart
```

安装完成后重启 OpenClaw Gateway：

```bash
openclaw gateway restart
```

## 3. 配置 Core API 环境变量

在 `.env` 中填入：

```env
WEIXIN_ENABLED=true
WEIXIN_BRIDGE_SECRET="your-secret-here"
```

`WEIXIN_BRIDGE_SECRET` 是你自己设置的密钥，用于校验请求来源，防止外部伪造微信消息。

## 4. Core API Incoming Endpoint

Core API 提供以下接口供 OpenClaw Bridge 调用：

```
POST /v1/channels/weixin/incoming
```

**请求 Header：**

```
Content-Type: application/json
X-Lusiyuan-Channel-Secret: your-secret-here
```

**请求 Body：**

稳定 id 模式：

```json
{
  "external_user_id": "wx_user_001",
  "external_conversation_id": "wx_chat_001",
  "external_message_id": "wx_msg_001",
  "display_name": "用户昵称",
  "text": "你是谁？",
  "raw": {}
}
```

只有微信联系人名字时，也可以使用名字模式：

```json
{
  "sender_name": "用户昵称",
  "conversation_name": "用户昵称",
  "client_message_id": "wx_msg_001",
  "text": "你是谁？",
  "raw": {}
}
```

名字模式会把用户写成 `weixin:name:<用户昵称>`，并自动进入关系/身份系统，后续可以在 Admin 里合并身份。

**响应：**

```json
{
  "reply": "我是陆思源，一个原创 AI 数字人……"
}
```

## 5. 测试 curl

```bash
curl -X POST http://localhost:64100/v1/channels/weixin/incoming \
  -H "Content-Type: application/json" \
  -H "X-Lusiyuan-Channel-Secret: your-secret-here" \
  -d '{
    "external_user_id": "wx_user_001",
    "external_conversation_id": "wx_chat_001",
    "external_message_id": "wx_msg_001",
    "display_name": "测试用户",
    "text": "你是谁？",
    "raw": {}
  }'
```

## 6. OpenClaw Bridge 逻辑

OpenClaw 侧需要把微信消息转发到 Core API。
基本流程：

```
收到微信消息
  ↓
提取稳定 id 字段，或提取 sender_name、conversation_name、client_message_id、text
  ↓
POST 到 http://your-server:64100/v1/channels/weixin/incoming（带 secret header）
  ↓
拿到 reply
  ↓
发回微信
```

具体 OpenClaw 侧的脚本写法参考 OpenClaw 官方文档的 Skill / Tool 写法。

## 7. 常见问题

**Q: 返回 401 Unauthorized**
- 检查请求 Header 中 `X-Lusiyuan-Channel-Secret` 是否与 `.env` 中的 `WEIXIN_BRIDGE_SECRET` 一致

**Q: 返回 400 Bad Request**
- 检查请求 Body 中是否包含 `text`，并且至少有 `external_user_id` 或 `sender_name` 其中一个

**Q: 不想用 OpenClaw，能直接调吗？**
- 可以，任何可以发 HTTP POST 请求的工具都可以调这个接口，只要带上正确的 secret。
