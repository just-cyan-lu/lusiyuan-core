import test from "node:test";
import assert from "node:assert/strict";
import { HomeAssistantClient } from "../src/home-automation/home-assistant-client.js";

test("Home Assistant client reads an entity with bearer authentication", async () => {
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  const client = new HomeAssistantClient({
    baseUrl: "http://ha.local:8123",
    token: "secret-token",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({
        entity_id: "light.living_room",
        state: "on",
        attributes: {},
      }), { status: 200 });
    },
  });

  const state = await client.getState("light.living_room");

  assert.equal(requestUrl, "http://ha.local:8123/api/states/light.living_room");
  assert.equal(requestHeaders?.get("authorization"), "Bearer secret-token");
  assert.equal(state.state, "on");
});

test("Home Assistant client calls a service with target and data", async () => {
  let requestUrl = "";
  let requestBody = "";
  const client = new HomeAssistantClient({
    baseUrl: "http://ha.local:8123/",
    token: "secret-token",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body);
      return new Response("[]", { status: 200 });
    },
  });

  await client.callService({
    domain: "light",
    action: "turn_on",
    target: { entity_id: ["light.living_room"] },
    data: { brightness_pct: 60 },
  });

  assert.equal(requestUrl, "http://ha.local:8123/api/services/light/turn_on");
  assert.deepEqual(JSON.parse(requestBody), {
    brightness_pct: 60,
    target: { entity_id: ["light.living_room"] },
  });
});

test("Home Assistant client reports API errors without exposing token", async () => {
  const client = new HomeAssistantClient({
    baseUrl: "http://ha.local:8123",
    token: "secret-token",
    fetchImpl: async () => new Response(JSON.stringify({ message: "forbidden" }), { status: 403 }),
  });

  await assert.rejects(client.listStates(), (error: Error) => {
    assert.match(error.message, /forbidden/);
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
});
