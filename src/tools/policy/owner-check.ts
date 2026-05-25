import { env } from "../../utils/env.js";

export function isOwner(userId: string): boolean {
  return env.OWNER_USER_IDS.includes(userId);
}
