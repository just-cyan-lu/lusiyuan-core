import test from "node:test";
import assert from "node:assert/strict";
import {
  detectChatToolIntents,
  selectToolsForChat,
  toolProgressContent,
} from "../src/tools/tool-router.js";
import type { ToolDefinition, ToolExecutionContext } from "../src/tools/tool.types.js";

const context: ToolExecutionContext = {
  userId: "user-1",
  channel: "web",
  isOwner: false,
};

function tool(name: string, ownerOnly = false): ToolDefinition {
  return {
    name,
    description: name,
    riskLevel: "low",
    ownerOnly,
    enabled: true,
    handler: async () => ({}),
  };
}

test("does not select tools for normal chat", () => {
  assert.deepEqual(detectChatToolIntents("今天有点累，想随便聊聊"), []);
  assert.deepEqual(
    selectToolsForChat({
      message: "今天有点累，想随便聊聊",
      tools: [tool("search_memories"), tool("web_search"), tool("read_page")],
      context,
    }),
    []
  );
});

test("selects memory search for explicit recall questions", () => {
  const selected = selectToolsForChat({
    message: "你还记得我们上次聊过什么吗？",
    tools: [tool("search_memories"), tool("web_search"), tool("read_page")],
    context,
  });

  assert.deepEqual(selected.map((item) => item.name), ["search_memories"]);
});

test("selects page reading for URLs", () => {
  const selected = selectToolsForChat({
    message: "帮我看看这个链接 https://example.com/a",
    tools: [tool("search_memories"), tool("web_search"), tool("read_page")],
    context,
  });

  assert.deepEqual(selected.map((item) => item.name), ["read_page"]);
});

test("selects web search for search-like requests", () => {
  const selected = selectToolsForChat({
    message: "搜一下今天有什么新消息",
    tools: [tool("search_memories"), tool("web_search"), tool("read_page")],
    context,
  });

  assert.deepEqual(selected.map((item) => item.name), ["web_search"]);
});

test("selects Home Assistant tools for home control requests", () => {
  const selected = selectToolsForChat({
    message: "把客厅灯打开",
    tools: [tool("query_home_state"), tool("control_home")],
    context: { ...context, isOwner: true },
  });

  assert.deepEqual(selected.map((item) => item.name), ["query_home_state", "control_home"]);
});

test("does not expose owner-only tools to non-owner contexts", () => {
  const selected = selectToolsForChat({
    message: "搜一下今天有什么新消息",
    tools: [tool("web_search", true)],
    context,
  });

  assert.deepEqual(selected, []);
});

test("builds concise progress status content", () => {
  assert.equal(toolProgressContent(["search_memories"]), "tool:search_memories");
  assert.equal(toolProgressContent(["web_search"]), "tool:web_search");
  assert.equal(toolProgressContent(["read_page"]), "tool:read_page");
  assert.equal(toolProgressContent([]), "typing");
});
