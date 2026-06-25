import { readFile } from "fs/promises";
import { resolve } from "path";

const OWNER_PROFILE_PATH = resolve(process.cwd(), "owner", "profile.md");

function stripMarkdownComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "").trim();
}

export async function loadOwnerProfile(): Promise<string> {
  try {
    const content = await readFile(OWNER_PROFILE_PATH, "utf-8");
    return stripMarkdownComments(content);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return "";
    throw error;
  }
}
