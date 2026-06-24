const USER_ID_KEY = "lusiyuan_web_user_id";
const CONVERSATION_ID_KEY = "lusiyuan_web_conversation_id";
const ACTIVE_ACTOR_KEY = "lusiyuan_web_active_actor";
const ADMIN_TOKEN_KEY = "lusiyuan_admin_token";

export const WEB_CHAT_ACTORS = [
  {
    id: "owner",
    label: "我",
    userId: "web:owner",
    displayName: "Owner",
    description: "你的 Web Chat 身份，会被后端视作 owner。",
  },
  {
    id: "codex",
    label: "Codex",
    userId: "web:codex",
    displayName: "Codex",
    description: "Codex 代聊或测试时使用，不会混入你的关系状态。",
  },
] as const;

export type WebChatActorId = (typeof WEB_CHAT_ACTORS)[number]["id"] | "custom";

export interface WebIdentity {
  userId: string;
  conversationId: string;
  displayName?: string;
}

const WEB_CONVERSATION_ID_PATTERN =
  /^web:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWebConversationId(value: string): boolean {
  return WEB_CONVERSATION_ID_PATTERN.test(value);
}

function createWebConversationId(): string {
  return `web:${crypto.randomUUID()}`;
}

function conversationKeyForUser(userId: string): string {
  return `${CONVERSATION_ID_KEY}:${userId}`;
}

export function webActorForUserId(userId: string): WebChatActorId {
  return WEB_CHAT_ACTORS.find((actor) => actor.userId === userId)?.id ?? "custom";
}

export function displayNameForWebUser(userId: string): string | undefined {
  return WEB_CHAT_ACTORS.find((actor) => actor.userId === userId)?.displayName;
}

export function getWebIdentityForActor(actorId: Exclude<WebChatActorId, "custom">): WebIdentity {
  const actor = WEB_CHAT_ACTORS.find((item) => item.id === actorId) ?? WEB_CHAT_ACTORS[0];
  const key = conversationKeyForUser(actor.userId);
  const existingConversationId = localStorage.getItem(key);
  const conversationId = isWebConversationId(existingConversationId ?? "")
    ? existingConversationId!
    : createWebConversationId();
  localStorage.setItem(key, conversationId);
  localStorage.setItem(USER_ID_KEY, actor.userId);
  localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
  localStorage.setItem(ACTIVE_ACTOR_KEY, actor.id);
  return {
    userId: actor.userId,
    conversationId,
    displayName: actor.displayName,
  };
}

export function getWebIdentity(): WebIdentity {
  const activeActor = localStorage.getItem(ACTIVE_ACTOR_KEY);
  if (activeActor === "owner" || activeActor === "codex") {
    return getWebIdentityForActor(activeActor);
  }
  if (activeActor !== "custom") {
    return getWebIdentityForActor("owner");
  }

  const userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) return getWebIdentityForActor("owner");

  const existingConversationId = localStorage.getItem(CONVERSATION_ID_KEY);
  const conversationId = isWebConversationId(existingConversationId ?? "")
    ? existingConversationId!
    : createWebConversationId();
  localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
  return {
    userId,
    conversationId,
    displayName: displayNameForWebUser(userId),
  };
}

export function setWebIdentity(identity: WebIdentity): void {
  localStorage.setItem(USER_ID_KEY, identity.userId);
  localStorage.setItem(CONVERSATION_ID_KEY, identity.conversationId);
  localStorage.setItem(conversationKeyForUser(identity.userId), identity.conversationId);
  localStorage.setItem(ACTIVE_ACTOR_KEY, webActorForUserId(identity.userId));
}

export function createWebConversationIdentity(userId?: string): WebIdentity {
  const nextUserId = userId?.trim() || WEB_CHAT_ACTORS[0].userId;
  const identity = {
    userId: nextUserId,
    conversationId: createWebConversationId(),
    displayName: displayNameForWebUser(nextUserId),
  };
  setWebIdentity(identity);
  return identity;
}

export function getStoredAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function setStoredAdminToken(token: string) {
  const value = token.trim();
  if (value) {
    localStorage.setItem(ADMIN_TOKEN_KEY, value);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}
