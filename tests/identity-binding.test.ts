import test from "node:test";
import assert from "node:assert/strict";
import {
  extractIdentityBindingCode,
  shouldOfferIdentityBinding,
} from "../src/runtime/identity-binding.service.js";

test("extracts Lu Siyuan identity binding codes", () => {
  assert.equal(extractIdentityBindingCode("CYAN-8K2Q7M"), "CYAN-8K2Q7M");
  assert.equal(extractIdentityBindingCode("绑定码 cyan8k2q7m"), "CYAN-8K2Q7M");
  assert.equal(extractIdentityBindingCode("普通聊天 8K2Q7M"), null);
});

test("offers binding for explicit account binding requests", () => {
  assert.equal(shouldOfferIdentityBinding("可以绑定一下身份吗"), true);
  assert.equal(shouldOfferIdentityBinding("把这个微信账号绑到我原来的身份上"), true);
  assert.equal(shouldOfferIdentityBinding("我从小红书来的"), true);
  assert.equal(shouldOfferIdentityBinding("微信那边也是我"), true);
});

test("offers binding for specific self-introduction but ignores generic identity nouns", () => {
  assert.equal(shouldOfferIdentityBinding("我是 cyan"), true);
  assert.equal(shouldOfferIdentityBinding("我叫小蓝，这次换 telegram 了"), true);
  assert.equal(shouldOfferIdentityBinding("我是学生"), false);
  assert.equal(shouldOfferIdentityBinding("CYAN-8K2Q7M"), false);
});
