import { env } from "../utils/env.js";

export function ownerExternalIds(): string[] {
  return Array.from(
    new Set([env.WEBCHAT_OWNER_USER_ID, ...env.OWNER_USER_IDS].filter(Boolean))
  );
}

export function isOwnerExternalId(externalId: string): boolean {
  return ownerExternalIds().includes(externalId);
}
