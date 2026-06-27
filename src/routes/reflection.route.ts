import type { FastifyInstance } from "fastify";
import { reflectionService } from "../reflection/reflection.service.js";
import { reflectionProposalService } from "../reflection/reflection-proposal.service.js";
import { prisma } from "../db/prisma.js";
import { requireAdminAuth } from "./admin-auth.js";
import { Prisma } from "@prisma/client";
import type { ReflectionScope } from "../reflection/reflection.types.js";

const validReflectionScopes = new Set<ReflectionScope>([
  "conversation",
  "user",
  "daily",
  "global_project",
]);

interface ReflectionRunBody {
  user_id?: string;
  scope?: string;
  conversation_id?: string;
  message_limit?: number;
}

function normalizeReflectionRunBody(body: ReflectionRunBody = {}): {
  scope: ReflectionScope;
  userId?: string;
  conversationId?: string;
  messageLimit?: number;
} {
  const scope = (body.scope ?? "conversation") as ReflectionScope;
  if (!validReflectionScopes.has(scope)) {
    throw Object.assign(new Error(`Invalid reflection scope: ${body.scope}`), {
      statusCode: 400,
    });
  }

  const userId = body.user_id?.trim();
  const conversationId = body.conversation_id?.trim();

  if (scope === "conversation" && !conversationId) {
    throw Object.assign(
      new Error("conversation_id is required for conversation reflection"),
      { statusCode: 400 }
    );
  }
  if (scope === "user" && !userId) {
    throw Object.assign(new Error("user_id is required for user reflection"), {
      statusCode: 400,
    });
  }

  return {
    scope,
    userId: scope === "user" ? userId : undefined,
    conversationId: scope === "conversation" ? conversationId : undefined,
    messageLimit: body.message_limit,
  };
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("Invalid date filter"), { statusCode: 400 });
  }
  return date;
}

function createdAtRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate) range.gte = fromDate;
  if (toDate) range.lte = toDate;
  return Object.keys(range).length > 0 ? range : undefined;
}

export async function reflectionRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  // POST /v1/reflection/run — create job and run immediately
  app.post("/v1/reflection/run", async (request, reply) => {
    const body = normalizeReflectionRunBody(request.body as ReflectionRunBody);

    const report = await reflectionService.runManualReflection({
      scope: body.scope,
      triggerType: "manual",
      userId: body.userId,
      conversationId: body.conversationId,
      messageLimit: body.messageLimit,
    });

    return reply.send({ report_id: report.id, summary: report.summary });
  });

  // POST /v1/reflection/jobs — create job without running
  app.post("/v1/reflection/jobs", async (request, reply) => {
    const body = normalizeReflectionRunBody(request.body as ReflectionRunBody);

    const job = await reflectionService.createJob({
      scope: body.scope,
      triggerType: "manual",
      userId: body.userId,
      conversationId: body.conversationId,
      messageLimit: body.messageLimit,
    });

    return reply.send({ job_id: job.id, status: job.status });
  });

  // POST /v1/reflection/jobs/:jobId/run
  app.post("/v1/reflection/jobs/:jobId/run", async (request, reply) => {
    const body = request.body as { user_id?: string };

    const { jobId } = request.params as { jobId: string };
    const report = await reflectionService.runJob(jobId);
    return reply.send({ report_id: report.id, summary: report.summary });
  });

  // GET /v1/reflection/reports
  app.get("/v1/reflection/reports", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      limit?: string;
      from?: string;
      to?: string;
    };
    const range = createdAtRange(query.from, query.to);

    const reports = await prisma.reflectionReport.findMany({
      where: range ? { createdAt: range } : undefined,
      orderBy: { createdAt: "desc" },
      take: parseLimit(query.limit, 20),
    });
    return reply.send({ reports });
  });

  // GET /v1/reflection/reports/:reportId
  app.get("/v1/reflection/reports/:reportId", async (request, reply) => {
    const query = request.query as { user_id?: string };

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
      risk_level?: string;
      proposal_type?: string;
      scope?: string;
      type?: string;
      report_id?: string;
      q?: string;
      limit?: string;
      from?: string;
      to?: string;
    };

    const proposals = await reflectionProposalService.listProposals({
      status: query.status,
      reportId: query.report_id,
      userId: query.user_id,
      riskLevel: query.risk_level,
      proposalType: query.proposal_type,
      scope: query.scope,
      type: query.type,
      query: query.q,
      limit: parseLimit(query.limit, 50),
      from: parseDate(query.from),
      to: parseDate(query.to),
    });
    return reply.send({ proposals });
  });

  // POST /v1/reflection/proposals/:proposalId/approve
  app.post("/v1/reflection/proposals/:proposalId/approve", async (request, reply) => {
    const body = request.body as { user_id?: string };

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

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.applyProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  // POST /v1/reflection/proposals/:proposalId/apply-global
  app.post("/v1/reflection/proposals/:proposalId/apply-global", async (request, reply) => {
    const body = request.body as { user_id?: string };

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.applyProposalGlobally(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  // POST /v1/reflection/proposals/:proposalId/revoke
  app.post("/v1/reflection/proposals/:proposalId/revoke", async (request, reply) => {
    const body = request.body as { user_id?: string };

    const { proposalId } = request.params as { proposalId: string };
    const proposal = await reflectionProposalService.revokeProposal(
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
      from?: string;
      to?: string;
    };
    const range = createdAtRange(query.from, query.to);

    const risks = await prisma.reflectionRiskFlag.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: parseLimit(query.limit, 50),
    });
    return reply.send({ risks });
  });
}
