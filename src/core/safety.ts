import { env } from "../utils/env.js";

export interface SafetyCheckResult {
  ok: boolean;
  error?: string;
}

export function checkInput(message: string): SafetyCheckResult {
  if (!message || message.trim().length === 0) {
    return { ok: false, error: "Message cannot be empty." };
  }
  if (message.length > env.MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Message too long. Maximum ${env.MAX_MESSAGE_LENGTH} characters allowed.`,
    };
  }
  return { ok: true };
}

export function sanitizeOutput(text: string): string {
  return text.replace(/<\|system\|>/gi, "").trim();
}
