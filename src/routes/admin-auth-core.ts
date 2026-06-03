import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isValidAdminAuthorization(
  authorizationHeader: string | undefined,
  expectedToken: string
): boolean {
  const expected = expectedToken.trim();
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return Boolean(expected && token && safeEqual(token, expected));
}
