export interface SafetyCheckResult {
  ok: boolean;
  error?: string;
}

export function checkInput(message: string): SafetyCheckResult {
  if (!message || message.trim().length === 0) {
    return { ok: false, error: "Message cannot be empty." };
  }
  return { ok: true };
}

export function sanitizeOutput(text: string): string {
  return text.replace(/<\|system\|>/gi, "").trim();
}
