import type { FastifyInstance } from "fastify";
import { pageReaderService } from "../page-reader/page-reader.service.js";
import { chromeDevtoolsMcpService } from "../mcp/chrome-devtools-mcp.service.js";
import { requireAdminAuth } from "./admin-auth.js";

export async function pageReaderRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.post("/v1/read-page", async (request, reply) => {
    const body = request.body as {
      url: string;
      user_id?: string;
      tool?: "jina" | "playwright" | "chrome-devtools-mcp";
      screenshot?: boolean;
      wait_ms?: number;
    };

    if (!body.url) {
      return reply.status(400).send({ error: "url is required" });
    }

    if (body.tool === "chrome-devtools-mcp") {
      const result = await chromeDevtoolsMcpService.read(body.url, body.wait_ms);
      return reply.send(result);
    }

    const result = await pageReaderService.read({
      url: body.url,
      screenshot: body.screenshot,
      preferTool: body.tool,
    });
    return reply.send(result);
  });

  app.post("/v1/screenshot", async (request, reply) => {
    const body = request.body as { url: string; user_id?: string };

    if (!body.url) {
      return reply.status(400).send({ error: "url is required" });
    }

    const result = await pageReaderService.read({
      url: body.url,
      screenshot: true,
      preferTool: "playwright",
    });
    return reply.send(result);
  });
}
