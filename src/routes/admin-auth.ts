import type { FastifyRequest } from "fastify";
import { env } from "../utils/env.js";
import { isValidAdminAuthorization } from "./admin-auth-core.js";

function authError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export function requireAdminAuth(request: FastifyRequest): void {
  const expected = env.ADMIN_API_TOKEN.trim();
  if (!expected) {
    throw authError("ADMIN_API_TOKEN is not configured", 503);
  }

  if (!isValidAdminAuthorization(request.headers.authorization, expected)) {
    throw authError("Unauthorized", 401);
  }
}

export { isValidAdminAuthorization };
