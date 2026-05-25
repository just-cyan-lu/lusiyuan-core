# TODO: 微信接入（公众号 / 企业微信官方 API）

## 背景

v0.2 原计划通过 OpenClaw Weixin 插件桥接微信，但这个方案太重：
需要先装 OpenClaw 本体，再装插件，再写桥接逻辑。

改为直接对接微信官方 API，更轻量、更稳定。

## 两个方向

### 方向 A：微信公众号

- 申请微信公众号（订阅号或服务号）
- 在公众号后台配置服务器 URL，指向 Core API
- 微信会把用户消息以 XML POST 到你的服务器
- Core API 解析消息，调用 chatService，返回回复

适合：对外公开，任何微信用户都能关注后聊天。

### 方向 B：企业微信

- 申请企业微信，创建自建应用
- 配置消息接收 URL
- 企业微信会把消息推送到 Core API
- 适合内部使用或小范围测试

适合：内部使用，权限更可控。

## 技术要点

- 微信消息是 XML 格式，需要解析（可用 `fast-xml-parser`）
- 需要做微信签名验证（`token` + `timestamp` + `nonce` 的 SHA1）
- 回复也是 XML 格式
- 需要公网 HTTPS 域名（本地开发可用 ngrok / frp 临时暴露）
- 消息有 5 秒超时限制，需要异步处理或客服消息接口

## 现有基础

v0.2 已经做好了：
- `POST /v1/channels/weixin/incoming` 接口（带 secret 鉴权）
- `chatService.chat()` 支持 `channel: "weixin"`
- `ChannelEvent` 记录原始事件

接入时只需要新增一个微信官方消息格式的 adapter，转成现有的 `NormalizedIncomingMessage` 即可。

## 参考

- 微信公众号开发文档：https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html
- 企业微信开发文档：https://developer.work.weixin.qq.com/document/path/90238
