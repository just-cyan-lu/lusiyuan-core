import test from "node:test";
import assert from "node:assert/strict";
import {
  extractXiaohongshuPostId,
  normalizeImportedCommentThreads,
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

test("keeps Xiaohongshu replies inside their thread and resolves direct reply targets", () => {
  const comments = normalizeImportedCommentThreads([
    {
      root: {
        externalId: "root-1",
        authorName: "鱼小乙",
        authorUserId: "user-fish",
        content: "好耶好耶终于过审了",
      },
      replies: [
        {
          externalId: "reply-1",
          authorName: "鱼小乙",
          authorUserId: "user-fish",
          content: "怎么没搜到",
        },
        {
          externalId: "reply-2",
          authorName: "陆思源 Cyan",
          authorUserId: "user-siyuan",
          content: "好像得陆思源 Cyan 一起搜。",
          isAuthor: true,
          replyToAuthorName: "鱼小乙",
        },
        {
          externalId: "reply-3",
          authorName: "鱼小乙",
          authorUserId: "user-fish",
          content: "哈哈搞定了",
          replyToAuthorName: "陆思源 Cyan",
        },
      ],
    },
  ], "post-1", 20);

  assert.equal(comments.length, 1);
  assert.equal(comments[0].content, "好耶好耶终于过审了");
  assert.equal(comments[0].replies?.length, 3);
  assert.equal(comments[0].replies?.[0].replyToExternalId, "root-1");
  assert.equal(comments[0].replies?.[1].replyToExternalId, "reply-1");
  assert.equal(comments[0].replies?.[1].isAuthor, true);
  assert.equal(comments[0].replies?.[2].replyToExternalId, "reply-2");
});
