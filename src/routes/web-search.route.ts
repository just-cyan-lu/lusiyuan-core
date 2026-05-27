import type { FastifyInstance } from "fastify";
import { webSearchService } from "../web-search/web-search.service.js";
import { isOwner } from "../tools/policy/owner-check.js";

async function requireOwner(userId: string | undefined): Promise<void> {
  if (!userId || !isOwner(userId)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}

export async function webSearchRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/search", async (request, reply) => {
    const body = request.body as { query: string; user_id?: string };
    await requireOwner(body.user_id);

    if (!body.query) {
      return reply.status(400).send({ error: "query is required" });
    }

    const result = await webSearchService.search(body.query);
    return reply.send(result);
  });
}
