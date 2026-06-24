import { isOwnerExternalId } from "../../core/owner-identity.js";

export function isOwner(userId: string): boolean {
  return isOwnerExternalId(userId);
}
