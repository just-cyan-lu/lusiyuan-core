import type { SkillDefinition } from "./skill.types.js";
import { xiaohongshuReplySkillDefinition } from "./xiaohongshu-reply/xiaohongshu-reply.skill.js";

export async function listSkills(): Promise<SkillDefinition[]> {
  return [await xiaohongshuReplySkillDefinition()];
}

export async function getSkill(id: string): Promise<SkillDefinition | undefined> {
  return (await listSkills()).find((skill) => skill.id === id);
}
