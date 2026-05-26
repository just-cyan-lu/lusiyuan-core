import type { FastifyInstance } from "fastify";
import { reflectionService } from "../reflection/reflection.service.js";
import { reflectionProposalService } from "../reflection/reflection-proposal.service.js";
import { isOwner } from "../tools/policy/owner-check.js";
import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";

async function requireOwner(userId: string | undefined): Promise<void> {
  if (!userId || !isOwner(userId)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}

export async function reflectionRoute(app: FastifyInstance): Promise<void> {
  // POST /v1/reflection/run — create job and run immediately
  app.post("/v1/reflection/run", async (request, reply) => {
    const body = request.body as {
      user_id?: string;
      scope?: string;
      conversation_id?: string;
      message_limit?: number;
    };
    await requireOwner(body.user_id);

    if (!env.REFLECTION_ENABLED) {
      return reply.status(503).send({ error: "Reflection is disabled" });
    }

    const report = await reflectionService.runManualReflection({
      scope: (body.scope ?? "conversation") as never,
      triggerType: "manual",
      conversationId: body.conversation_id,
      messageLimit: body.message_limit,
    });

    return reply.send({ report_id: report.id, summary: report.summary });
  });

  // POST /v1/reflection/jobs — create job without running
  app.post("/v1/reflection/jobs", async (request, reply) => {
    const body = request.body as {
      user_id?: string;
      scope?: string;
      conversation_id?: string;
      message_limit?: number;
    };
    await requireOwner(body.user_id);

    const job = await reflectionService.createJob({
      scope: (body.scope ?? "conversation") as never,
      triggerType: "manual",
      conversationId: body.conversation_id,
      messageLimit: body.message_limit,
    });

    return reply.send({ job_id: job.id, status: job.status });
  });

  // POST /v1/reflection/jobs/:jobId/run
  app.post("/v1/reflection/jobs/:jobId/run", async (request, reply) => {
    const body = request.body as { user_id?: string };
    await requireOwner(body.user_id);

    const { jobId } = request.params as { jobId: string };
    const report = await reflectionService.runJob(jobId);
    return reply.send({ report_id: report.id, summary: report.summary });
  });

  // GET /v1/reflection/reports
  app.get("/v1/reflection/reports", async (request, reply) => {
    const query = request.query as { user_id?: string; limit?: string };
    await requireOwner(query.user_id);

    const reports = await reflectionService.listReports(
      parseInt(query.limit ?? "20", 10)
    );
    return reply.send({ reports });
  });

  // GET /v1/reflection/reports/:reportId
  app.get("/v1/reflection/reports/:reportId", async (request, reply) => {
    const query = request.query as { user_id?: string };
    await requireOwner(query.user_id);

    const { reportId } = request.params as { reportId: string };
    const report = await reflectionService.getReport(reportId);
    if (!report) return reply.status(404).send({ error: "Report not found" });

    const [proposals, riskFlags, growthLogs] = await Promise.all([
      prisma.memoryProposal.findMany({ where: { reportId } }),
      prisma.reflectionRiskFlag.findMany({ where: { reportId } }),
      prisma.growthLogProposal.findMany({ where: { reportId } }),
    ]);

    return reply.send({ report, proposals, riskFlags, growthLogs });
  });

  // GET /v1/reflection/proposals
  app.get("/v1/reflection/proposals", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      status?: string;
      limit?: string;
    };
    await requireOwner(query.user_id);

    const proposals = await reflectionProposalService.listProposals({
      status: query.status,
      limit: parseInt(query.limit ?? "50", 10),
    });
    return reply.send({ proposals });
  });

  // POST /v1/reflection/proposals/:proposalId/approve
  app.post("/v1/reflection/proposals/:proposalId/approve", async (request, reply) => {
    const body = request.body as { user_id?: string };
    await requireOwner(body.user_id);

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.approveProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  // POST /v1/reflection/proposals/:proposalId/reject
  app.post("/v1/reflection/proposals/:proposalId/reject", async (request, reply) => {
    const body = request.body as { user_id?: string; reason?: string };
    await requireOwner(body.user_id);

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.rejectProposal(
      proposalId,
      body.user_id ?? "owner",
      body.reason
    );
    return reply.send({ proposal });
  });

  // POST /v1/reflection/proposals/:proposalId/apply
  app.post("/v1/reflection/proposals/:proposalId/apply", async (request, reply) => {
    const body = request.body as { user_id?: string };
    await requireOwner(body.user_id);

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.applyProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  // GET /v1/reflection/risks
  app.get("/v1/reflection/risks", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      status?: string;
      limit?: string;
    };
    await requireOwner(query.user_id);

    const risks = await prisma.reflectionRiskFlag.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: parseInt(query.limit ?? "50", 10),
    });
    return reply.send({ risks });
  });
}
