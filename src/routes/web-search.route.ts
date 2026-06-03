import type { FastifyInstance } from "fastify";
import { webSearchService } from "../web-search/web-search.service.js";
import { requireAdminAuth } from "./admin-auth.js";

export async function webSearchRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.post("/v1/search", async (request, reply) => {
    const body = request.body as { query: string; user_id?: string };

    if (!body.query) {
      return reply.status(400).send({ error: "query is required" });
    }

    const result = await webSearchService.search(body.query);
    return reply.send(result);
  });
}
