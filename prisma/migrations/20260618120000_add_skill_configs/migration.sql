CREATE TABLE "skill_configs" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_configs_skillId_key" ON "skill_configs"("skillId");
