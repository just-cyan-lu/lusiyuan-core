const USER_ID_KEY = "lusiyuan_web_user_id";
const CONVERSATION_ID_KEY = "lusiyuan_web_conversation_id";

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
