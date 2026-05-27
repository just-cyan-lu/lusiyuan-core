import type { FastifyInstance } from "fastify";
import { pageReaderService } from "../page-reader/page-reader.service.js";
import { cdpBrowserService } from "../cdp-browser/cdp-browser.service.js";
import { isOwner } from "../tools/policy/owner-check.js";

async function requireOwner(userId: string | undefined): Promise<void> {
  if (!userId || !isOwner(userId)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}

export async function pageReaderRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/read-page", async (request, reply) => {
    const body = request.body as {
      url: string;
      user_id?: string;
      tool?: "jina" | "playwright" | "cdp";
      screenshot?: boolean;
      wait_ms?: number;
    };
    await requireOwner(body.user_id);

    if (!body.url) {
      return reply.status(400).send({ error: "url is required" });
    }

    if (body.tool === "cdp") {
      const result = await cdpBrowserService.read({
        url: body.url,
        waitMs: body.wait_ms,
      });
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
    await requireOwner(body.user_id);

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
