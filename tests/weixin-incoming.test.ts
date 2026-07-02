import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWeixinIncomingBody } from "../src/channels/weixin/weixin.route.js";

test("normalizes name-only Weixin incoming messages", () => {
  const input = normalizeWeixinIncomingBody({
    sender_name: " 张   三 ",
    conversation_name: " 张   三 ",
    text: "你在吗？",
    client_message_id: "wx-msg-1",
    captured_at: "2026-07-02T21:30:00+08:00",
    raw: { source: "collector" },
  });

  assert.equal(input.user_id, "weixin:name:张 三");
  assert.equal(input.conversation_id, "weixin:name:张 三");
  assert.equal(input.external_message_id, "wx-msg-1");
  assert.equal(input.display_name, "张 三");
  assert.deepEqual(input.raw_event, {
    source: "collector",
    sender_name: "张 三",
    conversation_name: "张 三",
    captured_at: "2026-07-02T21:30:00+08:00",
    client_message_id: "wx-msg-1",
  });
});

test("normalizes stable-id Weixin incoming messages", () => {
  const input = normalizeWeixinIncomingBody({
    external_user_id: "wx_user_abc",
    external_conversation_id: "wx_chat_abc",
    external_message_id: "wx_msg_real",
    client_message_id: "wx_msg_client",
    display_name: "张三",
    text: "你好",
  });

  assert.equal(input.user_id, "weixin:wx_user_abc");
  assert.equal(input.conversation_id, "weixin:wx_chat_abc");
  assert.equal(input.external_message_id, "wx_msg_real");
  assert.equal(input.display_name, "张三");
});

test("falls back to sender name for Weixin conversation id", () => {
  const input = normalizeWeixinIncomingBody({
    sender_name: "林夏",
    text: "晚上好",
  });

  assert.equal(input.user_id, "weixin:name:林夏");
  assert.equal(input.conversation_id, "weixin:name:林夏");
  assert.equal(input.display_name, "林夏");
});

test("requires either Weixin external user id or sender name", () => {
  assert.throws(
    () => normalizeWeixinIncomingBody({ text: "你好" }),
    /external_user_id or sender_name is required/
  );
});
