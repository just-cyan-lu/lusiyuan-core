import test from "node:test";
import assert from "node:assert/strict";
import {
  readPageTool,
  selectReadPageBackend,
} from "../src/tools/builtin/read-page.tool.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";
import type { ToolExecutionContext } from "../src/tools/tool.types.js";

const baseContext: ToolExecutionContext = {
  userId: "web:someone",
  channel: "web",
  isOwner: false,
};

const ownerContext: ToolExecutionContext = {
  userId: "web:owner",
  channel: "web",
  isOwner: true,
};

test("blocks Chrome DevTools MCP read_page usage for non-owner users", async () => {
  await assert.rejects(
    () =>
      readPageTool.handler(
        { url: "https://example.com", tool: "chrome-devtools-mcp" },
        baseContext
      ),
    /只能在 Owner 对话中使用/
  );
});

test("selects Jina first for public documentation pages", () => {
  runtimeSettingsService.withTemporaryValues(
    { JINA_ENABLED: true, PLAYWRIGHT_ENABLED: true },
    () => {
      assert.equal(
        selectReadPageBackend({ url: "https://docs.github.com/en/actions" }, baseContext),
        "jina"
      );
    }
  );
});

test("selects Playwright for normal non-owner pages when enabled", () => {
  runtimeSettingsService.withTemporaryValues(
    { JINA_ENABLED: true, PLAYWRIGHT_ENABLED: true },
    () => {
      assert.equal(
        selectReadPageBackend({ url: "https://example.com/app" }, baseContext),
        "playwright"
      );
    }
  );
});

test("selects Chrome MCP for owner-only login-style pages", () => {
  runtimeSettingsService.withTemporaryValues(
    {
      JINA_ENABLED: true,
      PLAYWRIGHT_ENABLED: true,
      MCP_ENABLED: true,
      CHROME_DEVTOOLS_MCP_ENABLED: true,
    },
    () => {
      assert.equal(
        selectReadPageBackend({ url: "https://www.xiaohongshu.com/explore/abc" }, ownerContext),
        "chrome-devtools-mcp"
      );
      assert.equal(
        selectReadPageBackend({ url: "https://www.xiaohongshu.com/explore/abc" }, baseContext),
        "playwright"
      );
    }
  );
});

test("screenshot requests do not override Chrome MCP for owner login-style pages", () => {
  runtimeSettingsService.withTemporaryValues(
    {
      JINA_ENABLED: true,
      PLAYWRIGHT_ENABLED: true,
      MCP_ENABLED: true,
      CHROME_DEVTOOLS_MCP_ENABLED: true,
    },
    () => {
      assert.equal(
        selectReadPageBackend({ url: "https://www.xiaohongshu.com/explore/abc", screenshot: true }, ownerContext),
        "chrome-devtools-mcp"
      );
    }
  );
});

test("screenshot requests skip Jina because Jina is text-only", () => {
  runtimeSettingsService.withTemporaryValues(
    { JINA_ENABLED: true, PLAYWRIGHT_ENABLED: true },
    () => {
      assert.equal(
        selectReadPageBackend({ url: "https://docs.github.com/en/actions", screenshot: true }, baseContext),
        "playwright"
      );
    }
  );
});
