import test from "node:test";
import assert from "node:assert/strict";
import { matchSocialProfileUrl } from "../src/runtime/external-identity-profile-rules.js";

test("accepts supported social-profile roots", () => {
  assert.equal(matchSocialProfileUrl("https://space.bilibili.com/12345")?.platform, "B站");
  assert.equal(matchSocialProfileUrl("https://bsky.app/profile/yuri.bsky.social")?.platform, "Bluesky");
  assert.equal(matchSocialProfileUrl("https://www.zhihu.com/people/yuri-42")?.platform, "知乎");
  assert.equal(matchSocialProfileUrl("https://www.youtube.com/@yuri")?.platform, "YouTube");
  assert.equal(matchSocialProfileUrl("https://www.instagram.com/yuri/")?.platform, "Instagram");
});

test("rejects content pages and unrelated same-name pages", () => {
  assert.equal(matchSocialProfileUrl("https://x.com/yuri/status/123"), null);
  assert.equal(matchSocialProfileUrl("https://www.bilibili.com/video/BV1xx"), null);
  assert.equal(matchSocialProfileUrl("https://www.xiaohongshu.com/explore/abc"), null);
  assert.equal(matchSocialProfileUrl("https://example.com/yuri"), null);
});
