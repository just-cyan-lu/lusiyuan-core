const USER_ID_KEY = "lusiyuan_web_user_id";
const CONVERSATION_ID_KEY = "lusiyuan_web_conversation_id";
const ADMIN_TOKEN_KEY = "lusiyuan_admin_token";

function getOrCreate(key: string, prefix: string): string {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `${prefix}:${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

export function getWebIdentity() {
  const userId = getOrCreate(USER_ID_KEY, "web");
  const conversationId = getOrCreate(CONVERSATION_ID_KEY, "web");
  return { userId, conversationId };
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
