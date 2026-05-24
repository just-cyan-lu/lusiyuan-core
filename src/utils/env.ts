import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  MODEL_BASE_URL: requireEnv("MODEL_BASE_URL"),
  MODEL_API_KEY: requireEnv("MODEL_API_KEY"),
  MODEL_NAME: requireEnv("MODEL_NAME"),
  MEMORY_EXTRACTION_MODEL_NAME:
    process.env.MEMORY_EXTRACTION_MODEL_NAME ??
    process.env.MODEL_NAME ??
    "gpt-4.1-mini",
} as const;
