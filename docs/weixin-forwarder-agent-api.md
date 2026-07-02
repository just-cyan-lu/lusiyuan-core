# 微信转发 Agent 调用文档

这份文档给“微信消息转发程序/agent”使用，只说明怎么把微信消息发给陆思源，以及怎么拿回复。

## 接口地址

```http
POST http://localhost:64100/v1/channels/weixin/incoming
```

## Header

```http
Content-Type: application/json
X-Lusiyuan-Channel-Secret: <WEIXIN_BRIDGE_SECRET>
```

`X-Lusiyuan-Channel-Secret` 必须和陆思源服务端配置的 `WEIXIN_BRIDGE_SECRET` 一致。

当前WEIXIN_BRIDGE_SECRET：xiaohuangji2026lusiyuan

## 请求 Body

如果微信侧只有联系人名字，用这个格式：

```json
{
  "sender_name": "张三",
  "conversation_name": "张三",
  "text": "你在吗？",
  "client_message_id": "wx-msg-unique-id",
  "captured_at": "2026-07-02T21:30:00+08:00",
  "raw": {}
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `sender_name` | 是 | 微信联系人名字。没有用户 id 时按名字识别这个人。 |
| `conversation_name` | 否 | 会话名字。单聊可等于 `sender_name`；群聊填群名。 |
| `text` | 是 | 微信用户发来的文字。 |
| `client_message_id` | 强烈建议 | 转发程序生成的消息唯一 id，用来防重复回复。 |
| `captured_at` | 否 | 转发程序截取到消息的时间，建议 ISO 字符串。 |
| `raw` | 否 | 原始微信事件，方便排查。没有就传 `{}`。 |

如果你能拿到稳定用户 id，也可以用这个格式：

```json
{
  "external_user_id": "wx_user_abc",
  "external_conversation_id": "wx_chat_abc",
  "display_name": "张三",
  "text": "你在吗？",
  "client_message_id": "wx_msg_001",
  "raw": {}
}
```

## 响应

成功时：

```json
{
  "reply": "在的，怎么啦？",
  "replies": ["在的，怎么啦？"],
  "reply_parts": [],
  "turn_id": "task-id"
}
```

转发程序可以直接把 `reply` 发回微信。

如果想按分条回复发送，可以按 `replies` 数组顺序逐条发送。

## 重复消息

如果同一条 `client_message_id` 已经处理过，会返回：

```json
{
  "reply": "",
  "duplicated": true
}
```

收到 `duplicated: true` 时，不要再发微信回复。

## 任务被停止

如果这次回复任务被手动停止，会返回：

```json
{
  "reply": "",
  "cancelled": true
}
```

收到 `cancelled: true` 时，不要发微信回复。

## 常见错误

`401 Unauthorized`：

- Header 里的 `X-Lusiyuan-Channel-Secret` 不对。
- 服务端没有配置 `WEIXIN_BRIDGE_SECRET`。

`503 Weixin channel is disabled`：

- 服务端没有开启 `WEIXIN_ENABLED`。

`400 Bad Request`：

- 缺少 `text`。
- 同时缺少 `sender_name` 和 `external_user_id`。

## curl 示例

```bash
curl -X POST http://localhost:64100/v1/channels/weixin/incoming \
  -H "Content-Type: application/json" \
  -H "X-Lusiyuan-Channel-Secret: your-secret-here" \
  -d '{
    "sender_name": "张三",
    "conversation_name": "张三",
    "text": "你在吗？",
    "client_message_id": "wx-msg-001",
    "captured_at": "2026-07-02T21:30:00+08:00",
    "raw": {}
  }'
```
