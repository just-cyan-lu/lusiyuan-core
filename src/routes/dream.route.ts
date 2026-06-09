// dream.route.ts — v0.75 Dream Cycle API routes (owner-only)

import type { FastifyInstance } from "fastify";
import { dreamService } from "../dream/dream.service.js";
import { morningBriefService } from "../dream/morning-brief.service.js";
import { prisma } from "../db/prisma.js";
import { env } from "../utils/env.js";
import { requireAdminAuth } from "./admin-auth.js";
import { Prisma } from "@prisma/client";

export async function dreamRoute(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdminAuth(request);
  });

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

  function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const range: Prisma.DateTimeFilter = {};
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (fromDate) range.gte = fromDate;
    if (toDate) range.lte = toDate;
    return Object.keys(range).length > 0 ? range : undefined;
  }

  function metadataString(value: unknown, key: string): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === "string" ? entry : null;
  }

  // POST /v1/dream/run — run a daily dream cycle immediately
  app.post("/v1/dream/run", async (request, reply) => {
    const body = request.body as {
      user_id?: string;
      scope?: string;
      from?: string;
      to?: string;
      lookback_hours?: number;
    };

    if (!env.DREAM_ENABLED) {
      return reply.status(503).send({ error: "Dream Cycle is disabled" });
    }

    const result = await dreamService.runDailyDream({
      triggerType: "manual",
      lookbackHours: body.lookback_hours,
      userId: body.user_id,
    });

    return reply.send({
      job_id: result.jobId,
      status: result.status,
      daily_note_id: result.dailyNoteId ?? null,
      diary_entry_id: result.diaryEntryId ?? null,
      signal_count: result.signalCount,
      proposal_count: result.proposalCount,
      risk_count: result.riskCount,
    });
  });

  // POST /v1/dream/jobs — create a job without running it
  app.post("/v1/dream/jobs", async (request, reply) => {
    const body = request.body as {
      user_id?: string;
      trigger_type?: string;
      scope?: string;
      from?: string;
      to?: string;
    };

    const job = await dreamService.createJob({
      triggerType: (body.trigger_type ?? "manual") as never,
      scope: (body.scope ?? "daily") as never,
      userId: body.user_id,
      fromTime: body.from ? new Date(body.from) : undefined,
      toTime: body.to ? new Date(body.to) : undefined,
    });

    return reply.status(201).send(job);
  });

  // GET /v1/dream/jobs — list recent jobs for admin review
  app.get("/v1/dream/jobs", async (request, reply) => {
    const query = request.query as {
      status?: string;
      user_id?: string;
      limit?: string;
      from?: string;
      to?: string;
    };
    const range = dateRange(query.from, query.to);

    const jobs = await prisma.dreamJob.findMany({
      where: {
        ...(query.status && query.status !== "all" ? { status: query.status } : {}),
        ...(query.user_id ? { userId: query.user_id } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: parseLimit(query.limit, 30),
      include: {
        _count: {
          select: {
            dailyNotes: true,
            signals: true,
            diaryEntries: true,
            reports: true,
          },
        },
      },
    });

    return reply.send({ jobs });
  });

  // POST /v1/dream/jobs/:jobId/run — run a specific job
  app.post("/v1/dream/jobs/:jobId/run", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const body = request.body as { user_id?: string };

    const result = await dreamService.runJob(jobId);
    return reply.send(result);
  });

  // GET /v1/dream/jobs/:jobId — get job status
  app.get("/v1/dream/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const query = request.query as { user_id?: string };

    const job = await prisma.dreamJob.findUnique({ where: { id: jobId } });
    if (!job) return reply.status(404).send({ error: "Job not found" });
    return reply.send(job);
  });

  // GET /v1/dream/jobs/:jobId/deep-sleep — get consolidation output
  app.get("/v1/dream/jobs/:jobId/deep-sleep", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.dreamJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) return reply.status(404).send({ error: "Job not found" });

    const reports = await prisma.dreamConsolidationReport.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });

    const reflectionReportIds = Array.from(
      new Set(
        reports
          .map((report) => metadataString(report.metadata, "dreamReflectionReportId"))
          .filter((id): id is string => Boolean(id))
      )
    );

    const [proposals, riskFlags, growthLogs] =
      reflectionReportIds.length > 0
        ? await Promise.all([
            prisma.memoryProposal.findMany({
              where: { reportId: { in: reflectionReportIds } },
              orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
            }),
            prisma.reflectionRiskFlag.findMany({
              where: { reportId: { in: reflectionReportIds } },
              orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
            }),
            prisma.growthLogProposal.findMany({
              where: { reportId: { in: reflectionReportIds } },
              orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
            }),
          ])
        : [[], [], []];

    return reply.send({ reports, proposals, riskFlags, growthLogs });
  });

  // GET /v1/dream/daily-notes — list daily notes
  app.get("/v1/dream/daily-notes", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      limit?: string;
      from?: string;
      to?: string;
    };
    const range = dateRange(query.from, query.to);

    const notes = await prisma.dailyNote.findMany({
      where: {
        status: "active",
        ...(query.user_id ? { userId: query.user_id } : {}),
        ...(range ? { date: range } : {}),
      },
      orderBy: { date: "desc" },
      take: parseLimit(query.limit, 20),
    });
    return reply.send(notes);
  });

  // GET /v1/dream/signals — list dream signals
  app.get("/v1/dream/signals", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      limit?: string;
      signal_type?: string;
      from?: string;
      to?: string;
    };
    const range = dateRange(query.from, query.to);

    const signals = await prisma.dreamSignal.findMany({
      where: {
        status: "active",
        ...(query.signal_type ? { signalType: query.signal_type } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: parseLimit(query.limit, 50),
    });
    return reply.send(signals);
  });

  // GET /v1/dream/diary — list dream diary entries
  app.get("/v1/dream/diary", async (request, reply) => {
    const query = request.query as {
      user_id?: string;
      limit?: string;
      from?: string;
      to?: string;
    };
    const range = dateRange(query.from, query.to);

    const entries = await prisma.dreamDiaryEntry.findMany({
      where: {
        status: "active",
        ...(range ? { date: range } : {}),
      },
      orderBy: { date: "desc" },
      take: parseLimit(query.limit, 20),
    });
    return reply.send(entries);
  });

  // GET /v1/dream/diary/:id — get a specific diary entry
  app.get("/v1/dream/diary/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { user_id?: string };

    const entry = await prisma.dreamDiaryEntry.findUnique({ where: { id } });
    if (!entry) return reply.status(404).send({ error: "Diary entry not found" });
    return reply.send(entry);
  });

  // GET /v1/dream/jobs/:jobId/morning-brief — get morning brief for a job
  app.get("/v1/dream/jobs/:jobId/morning-brief", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const query = request.query as { user_id?: string };

    const brief = await morningBriefService.getMorningBrief(jobId);
    if (!brief) return reply.status(404).send({ error: "Job not found" });
    return reply.send(brief);
  });
}
