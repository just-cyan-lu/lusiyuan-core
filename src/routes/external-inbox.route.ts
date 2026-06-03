import type { FastifyInstance } from "fastify";
import { externalInboxService } from "../external-inbox/external-inbox.service.js";
import { requireAdminAuth } from "./admin-auth.js";

export async function externalInboxRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/external-inbox", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      platform?: string;
      limit?: string;
    };

    const items = await externalInboxService.list(
      query.platform,
      query.limit ? parseInt(query.limit, 10) : 50
    );
    return reply.send({ items });
  });

  app.post("/v1/external-inbox/sync", async (request, reply) => {
    const body = request.body as { user_id?: string; platform: string };

    if (!body.platform) {
      return reply.status(400).send({ error: "platform is required" });
    }

    const result = await externalInboxService.sync(body.platform);
    return reply.send(result);
  });

  app.get("/v1/external-inbox/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { user_id?: string };

    const item = await externalInboxService.get(params.id);
    if (!item) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.send(item);
  });
}
