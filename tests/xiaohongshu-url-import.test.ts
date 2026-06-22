import test from "node:test";
import assert from "node:assert/strict";
import {
  extractXiaohongshuPostId,
  normalizeImportedComments,
  validateXiaohongshuUrl,
} from "../src/platforms/xiaohongshu/xiaohongshu-url-import.service.js";

test("accepts Xiaohongshu post and share-link hosts only", () => {
  assert.equal(validateXiaohongshuUrl("https://www.xiaohongshu.com/explore/abc123").hostname, "www.xiaohongshu.com");
  assert.equal(validateXiaohongshuUrl("https://xhslink.com/a/hello").hostname, "xhslink.com");
  assert.throws(() => validateXiaohongshuUrl("https://example.com/post/1"), /只允许导入小红书/);
});

test("extracts stable post ids from supported Xiaohongshu URL shapes", () => {
  assert.equal(extractXiaohongshuPostId("https://www.xiaohongshu.com/explore/abc123?xsec_token=1"), "abc123");
  assert.equal(extractXiaohongshuPostId("https://www.xiaohongshu.com/discovery/item/def456"), "def456");
  assert.equal(extractXiaohongshuPostId("https://xhslink.com/a/hello"), null);
});

test("keeps imported comment text verbatim and deduplicates repeated DOM candidates", () => {
  const comments = normalizeImportedComments([
    {
      external_id: "comment-1",
      author_name: "小明",
      content: "这个是怎么做出来的？",
      context: "另一位用户回复：我也想知道",
      account_reply: { content: "一点点搭起来的，之后慢慢讲。" },
    },
    {
      author_name: "小明",
      content: "这个是怎么做出来的？",
    },
  ], "post-1", 20);

  assert.equal(comments.length, 1);
  assert.equal(comments[0].content, "这个是怎么做出来的？");
  assert.equal(comments[0].commenterHistory, "另一位用户回复：我也想知道");
  assert.equal(comments[0].reply?.content, "一点点搭起来的，之后慢慢讲。");
});

