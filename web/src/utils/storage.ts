const USER_ID_KEY = "lusiyuan_web_user_id";
const CONVERSATION_ID_KEY = "lusiyuan_web_conversation_id";
const ADMIN_TOKEN_KEY = "lusiyuan_admin_token";

export interface WebIdentity {
  userId: string;
  conversationId: string;
}

const WEB_CONVERSATION_ID_PATTERN =
  /^web:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrCreate(key: string, prefix: string): string {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `${prefix}:${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

export function isWebConversationId(value: string): boolean {
  return WEB_CONVERSATION_ID_PATTERN.test(value);
}

function createWebConversationId(): string {
  return `web:${crypto.randomUUID()}`;
}

export function getWebIdentity(): WebIdentity {
  const userId = getOrCreate(USER_ID_KEY, "web");
  const existingConversationId = localStorage.getItem(CONVERSATION_ID_KEY);
  const conversationId = isWebConversationId(existingConversationId ?? "")
    ? existingConversationId!
    : createWebConversationId();
  localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
  return { userId, conversationId };
}

export function setWebIdentity(identity: WebIdentity): void {
  localStorage.setItem(USER_ID_KEY, identity.userId);
  localStorage.setItem(CONVERSATION_ID_KEY, identity.conversationId);
}

export function createWebConversationIdentity(userId?: string): WebIdentity {
  const identity = {
    userId: userId?.trim() || getOrCreate(USER_ID_KEY, "web"),
    conversationId: createWebConversationId(),
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
