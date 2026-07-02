# Weixin Incoming Message API

这份文档只描述“外部微信采集程序把收到的微信消息传给思源”的接口。

目标场景：

- 外部程序已经能截取微信消息。
- 微信消息里没有稳定用户 id，只有联系人名字。
- 思源需要按名字识别用户、记录聊天、生成回复。
- 外部程序拿到思源的回复后，再调用自己的微信发送接口把消息发回去。

## 接口

```http
POST /v1/channels/weixin/incoming
```

本地默认地址：

```text
http://localhost:64100/v1/channels/weixin/incoming
```

## Header

```http
Content-Type: application/json
X-Lusiyuan-Channel-Secret: <WEIXIN_BRIDGE_SECRET>
```

`X-Lusiyuan-Channel-Secret` 必须和 `.env` 里的 `WEIXIN_BRIDGE_SECRET` 一致。

## 请求 Body

第一版只需要支持文字消息。

```json
{
  "sender_name": "张三",
  "conversation_name": "张三",
  "text": "你在吗？",
  "captured_at": "2026-07-02T21:30:00+08:00",
  "client_message_id": "optional-stable-message-id",
  "raw": {}
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `sender_name` | 是 | 微信联系人名字。没有微信 id 时，思源按这个名字识别用户。 |
| `conversation_name` | 否 | 会话名字。单聊默认等于 `sender_name`；群聊可以填群名。 |
| `text` | 是 | 用户发来的文字内容。 |
| `captured_at` | 否 | 外部程序截取消息的时间，建议 ISO 8601。只用于记录和排查，不作为强唯一依据。 |
| `client_message_id` | 否 | 外部程序生成的消息唯一 id。强烈建议传；没有它时无法可靠防重复。 |
| `raw` | 否 | 原始微信事件，方便以后排查。可以先传 `{}`。 |

## 名字到用户的映射规则

由于微信侧没有稳定 id，第一版按名字生成内部外部用户 id：

```text
external_user_id = name:<normalized_sender_name>
```

例如：

```text
sender_name = 张三
external_user_id = name:张三
最终写入 app_users.externalId = weixin:name:张三
```

`conversation_name` 同理：

```text
external_conversation_id = name:<normalized_conversation_name>
最终写入 chat_conversations.externalConversationId = weixin:name:张三
```

`normalized_*` 建议先只做：

- 去掉首尾空格。
- 多个连续空白合并成一个空格。
- 不做拼音、不做昵称猜测、不做模糊匹配。

注意：

- 如果两个微信联系人同名，会被当成同一个人。
- 如果微信联系人改名，会被当成新用户。
- 以后可以在 Admin 里合并身份，或者让外部程序维护一份“名字 -> 稳定 id”的映射。

## 推荐的兼容 Body

如果外部程序以后能拿到更稳定的 id，可以直接传 `external_user_id` 和 `external_conversation_id`。

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

兼容规则：

- 如果传了 `external_user_id`，优先使用它。
- 如果没传 `external_user_id`，用 `sender_name` 生成。
- 如果传了 `external_conversation_id`，优先使用它。
- 如果没传 `external_conversation_id`，用 `conversation_name` 或 `sender_name` 生成。
- `display_name` 可以用 `sender_name` 自动填充。

## 消息去重

最好由外部程序传 `client_message_id`。

推荐生成方式：

```text
client_message_id = sha256(sender_name + conversation_name + text + captured_at)
```

更好的方式是外部程序自己维护递增序号或截取到的真实消息标识。

如果没有 `client_message_id`：

- 思源仍然可以处理消息。
- 但同一条微信消息如果被外部程序重复 POST，思源可能会重复回复。

接口实现时应把：

```text
external_message_id = client_message_id
```

传给内部聊天逻辑。

## 响应

同步返回思源生成的回复。

```json
{
  "reply": "在的，怎么啦？",
  "replies": ["在的，怎么啦？"],
  "reply_parts": [
    {
      "turn_id": "task-id",
      "sequence": 0,
      "kind": "final",
      "content": "在的，怎么啦？",
      "delay_ms": 0,
      "transcript": true
    }
  ],
  "turn_id": "task-id"
}
```

外部微信程序可以按两种方式发送回复：

- 简单模式：只取 `reply`，一次性发回微信。
- 分条模式：按 `reply_parts` 或 `replies` 顺序逐条发回微信。

如果检测到重复消息：

```json
{
  "reply": "",
  "duplicated": true
}
```

外部程序收到 `duplicated: true` 时不要再发微信回复。

如果任务被停止：

```json
{
  "reply": "",
  "cancelled": true
}
```

## 示例

名字模式：

```bash
curl -X POST http://localhost:64100/v1/channels/weixin/incoming \
  -H "Content-Type: application/json" \
  -H "X-Lusiyuan-Channel-Secret: your-secret-here" \
  -d '{
    "sender_name": "张三",
    "conversation_name": "张三",
    "text": "你在吗？",
    "captured_at": "2026-07-02T21:30:00+08:00",
    "client_message_id": "name-zhangsan-20260702-213000",
    "raw": {}
  }'
```

稳定 id 模式：

```bash
curl -X POST http://localhost:64100/v1/channels/weixin/incoming \
  -H "Content-Type: application/json" \
  -H "X-Lusiyuan-Channel-Secret: your-secret-here" \
  -d '{
    "external_user_id": "wx_user_abc",
    "external_conversation_id": "wx_chat_abc",
    "display_name": "张三",
    "text": "你在吗？",
    "client_message_id": "wx_msg_001",
    "raw": {}
  }'
```

## 当前代码差异

当前代码已经支持：

```http
POST /v1/channels/weixin/incoming
```

支持两种模式：

- 名字模式：只传 `sender_name` + `text`，适合目前只有微信联系人名字的采集程序。
- 稳定 id 模式：传 `external_user_id`、`external_conversation_id`、`display_name`，适合 OpenClaw 或以后能拿到稳定 id 的微信桥接。

当前实现会做这些事：

- 没有 `external_user_id` 时按 `sender_name` 生成 `weixin:name:<名字>`。
- 没有 `external_conversation_id` 时按 `conversation_name` 或 `sender_name` 生成 `weixin:name:<名字>`。
- 接受 `client_message_id`，并映射到内部 `external_message_id`，用于防重复。
- 把 `captured_at`、`sender_name`、`conversation_name`、`client_message_id` 放进 `raw_event`，方便排查。
- 进入现有聊天流程后，会自动创建 `User`、`PersonIdentity` 和 `IdentityLink`，所以微信用户会出现在关系/身份页面里，后续可以参与身份合并。

启用条件：

- 设置页里的 `WEIXIN_ENABLED` 要开启。
- `.env` 或设置页“渠道连接”里的 `WEIXIN_BRIDGE_SECRET` 要配置，并和请求 Header `X-Lusiyuan-Channel-Secret` 一致。
