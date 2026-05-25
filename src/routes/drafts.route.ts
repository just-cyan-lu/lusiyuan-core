import type { FastifyInstance } from "fastify";
import { draftService } from "../drafts/draft.service.js";
import { prisma } from "../db/prisma.js";

export async function draftsRoute(app: FastifyInstance): Promise<void> {
  app.get("/v1/drafts", async (request, reply) => {
    const query = request.query as { userId?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10), 100);

    let internalUserId: string | undefined;
    if (query.userId) {
      const user = await prisma.user.findUnique({
        where: { externalId: query.userId },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      internalUserId = user.id;
    }

    const drafts = await draftService.listDrafts(internalUserId, limit);
    return reply.send({ drafts });
  });

  app.get("/v1/drafts/:draftId", async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    const draft = await draftService.getDraft(draftId);
    if (!draft) {
      return reply.status(404).send({ error: "Draft not found" });
    }
    return reply.send({ draft });
  });

  app.patch("/v1/drafts/:draftId/status", async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    const body = request.body as { status: string };

    const allowed = ["draft", "approved", "rejected", "sent"];
    if (!allowed.includes(body.status)) {
      return reply
        .status(400)
        .send({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const draft = await draftService.getDraft(draftId);
    if (!draft) {
      return reply.status(404).send({ error: "Draft not found" });
    }

    const updated = await draftService.updateDraftStatus(
      draftId,
      body.status as "draft" | "approved" | "rejected" | "sent"
    );
    return reply.send({ draft: updated });
  });
}
