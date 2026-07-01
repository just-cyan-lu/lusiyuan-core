import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { memoryProposalService } from "../memory/memory-proposal.service.js";
import { prisma } from "../db/prisma.js";
import { requireAdminAuth } from "./admin-auth.js";

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

export async function memoryProposalsRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

  app.get("/v1/memory/proposals", async (request, reply) => {
    const query = request.query as {
      person_id?: string;
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

    const proposals = await memoryProposalService.listProposals({
      status: query.status,
      reportId: query.report_id,
      personId: query.person_id,
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

  app.post("/v1/memory/proposals/:proposalId/approve", async (request, reply) => {
    const body = request.body as { user_id?: string };
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await memoryProposalService.approveProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  app.post("/v1/memory/proposals/:proposalId/reject", async (request, reply) => {
    const body = request.body as { user_id?: string; reason?: string };
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await memoryProposalService.rejectProposal(
      proposalId,
      body.user_id ?? "owner",
      body.reason
    );
    return reply.send({ proposal });
  });

  app.post("/v1/memory/proposals/:proposalId/apply", async (request, reply) => {
    const body = request.body as { user_id?: string };
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await memoryProposalService.applyProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  app.post("/v1/memory/proposals/:proposalId/apply-global", async (request, reply) => {
    const body = request.body as { user_id?: string };
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await memoryProposalService.applyProposalGlobally(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  app.post("/v1/memory/proposals/:proposalId/revoke", async (request, reply) => {
    const body = request.body as { user_id?: string };
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await memoryProposalService.revokeProposal(
      proposalId,
      body.user_id ?? "owner"
    );
    return reply.send({ proposal });
  });

  app.get("/v1/memory/risks", async (request, reply) => {
    const query = request.query as {
      status?: string;
      limit?: string;
      from?: string;
      to?: string;
    };
    const range = createdAtRange(query.from, query.to);
    const risks = await prisma.memoryRiskFlag.findMany({
      where: {
        ...(query.status && query.status !== "all" ? { status: query.status } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: parseLimit(query.limit, 50),
    });
    return reply.send({ risks });
  });
}
