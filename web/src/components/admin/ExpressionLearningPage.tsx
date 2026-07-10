import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Card, Form, Icon, Input, Switch, type CardColor, type IconName } from "animal-island-ui";
import { AdminSelect } from "./AdminFormPrimitives";
import {
  acceptExpressionLearningTrainingDraft,
  analyzeExpressionLearningDialogueTurn,
  analyzeExpressionLearningExample,
  createExpressionLearningDialogueCase,
  createExpressionLearningDialogueTurn,
  createExpressionLearningDistillationBatch,
  createExpressionLearningExample,
  createExpressionLearningRule,
  deleteExpressionLearningDialogueCase,
  deleteExpressionLearningDialogueTurn,
  deleteExpressionLearningExample,
  deleteExpressionLearningTrainingRecord,
  deleteExpressionLearningRule,
  downloadExpressionLearningTrainingExport,
  fetchExpressionLearningDialogueCases,
  fetchExpressionLearningExamples,
  fetchExpressionLearningDistillationBatches,
  fetchExpressionLearningRules,
  fetchExpressionLearningTrainingRecords,
  generateExpressionLearningDialogueTurnDraft,
  generateExpressionLearningDraft,
  generateExpressionLearningPracticeQuestion,
  proposeExpressionLearningRule,
  reanalyzeExpressionLearningExample,
  reopenExpressionLearningDistillationCandidate,
  resolveExpressionLearningDistillationCandidate,
  runExpressionLearningPracticeBatchNow,
  saveExpressionLearningDialogueTurnExample,
  saveExpressionLearningTrainingDraft,
  updateExpressionLearningDialogueCase,
  updateExpressionLearningDialogueTurn,
  updateExpressionLearningDistillationCandidate,
  updateExpressionLearningExample,
  updateExpressionLearningRule,
  type ExpressionLearningAnalysis,
  type ExpressionLearningDialogueCase,
  type ExpressionLearningDialogueCasesResponse,
  type ExpressionLearningDialogueTurn,
  type ExpressionLearningDistillationBatch,
  type ExpressionLearningDistillationCandidate,
  type ExpressionLearningCreateInput,
  type ExpressionLearningExample,
  type ExpressionLearningPracticeQuestion,
  type ExpressionLearningPracticeQuestionResponse,
  type ExpressionLearningResponse,
  type ExpressionLearningRule,
  type ExpressionLearningRuleCandidate,
  type ExpressionLearningRulesResponse,
  type ExpressionLearningTrainingDraftInput,
  type ExpressionLearningTrainingRecord,
  type ExpressionLearningTrainingRecordsResponse,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface Props {
  adminToken: string;
}

const emptyState: ExpressionLearningResponse = {
  examples: [],
  summary: { total: 0, active: 0, skipped: 0 },
  scenes: [],
};

const emptyExerciseState: ExpressionLearningTrainingRecordsResponse = {
  records: [],
  summary: { total: 0, open: 0, archived: 0, completed: 0, dismissed: 0 },
};

const emptyDialogueState: ExpressionLearningDialogueCasesResponse = {
  cases: [],
  summary: { total: 0, draft: 0, active: 0, archived: 0 },
};

const emptyRuleState: ExpressionLearningRulesResponse = {
  rules: [],
  summary: { total: 0, active: 0, draft: 0 },
};

type LearningTab = "library" | "rules" | "exercises" | "dialogue";

type RuleSeed = ExpressionLearningRuleCandidate & { exampleId: string; revision: number };

type TeachingSeed = {
  record: ExpressionLearningTrainingRecord;
  revision: number;
};

type ExpressionLearningPatch = Omit<
  Parameters<typeof updateExpressionLearningExample>[0],
  "token" | "exampleId"
>;

const defaultSceneOptions = [
  { key: "general", label: "通用" },
  { key: "chat", label: "聊天" },
  { key: "reply", label: "回复评论" },
];

function sceneLabel(value: string) {
  return ({
    general: "通用",
    chat: "聊天",
    reply: "回复评论",
  } as Record<string, string>)[value] ?? value;
}

function sceneOptions(_extraScenes: string[] = []) {
  return defaultSceneOptions;
}

function sceneFilterOptions(extraScenes: string[] = []) {
  return [
    { key: "all", label: "全部场景" },
    ...sceneOptions(extraScenes),
  ];
}

function actionLabel(value: string) {
  return ({
    owner_written: "你直接写的",
    edited_draft: "修改草稿后发布",
    accepted_draft: "直接采用草稿",
    skipped: "决定不回复",
    owner_taught: "主动教学",
  } as Record<string, string>)[value] ?? value;
}

function outcomeLabel(value: string) {
  return ({
    sent: "发布了回复",
    skipped: "决定不回复",
  } as Record<string, string>)[value] ?? value;
}

function statusLabel(value: string) {
  return ({
    active: "参与生成",
    disabled: "已停用",
  } as Record<string, string>)[value] ?? value;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordString(value: unknown, key: string): string {
  const item = recordObject(value)[key];
  return typeof item === "string" ? item : "";
}

function questionFromTrainingRecord(
  record: ExpressionLearningTrainingRecord
): ExpressionLearningPracticeQuestion | null {
  const raw = recordObject(record.generatedQuestion);
  const contextText = record.contextText ?? recordString(raw, "contextText");
  if (!contextText) return null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((item): item is string => typeof item === "string")
    : [];
  return {
    scene: recordString(raw, "scene") || record.scene,
    contextText,
    draftText: (record.draftText ?? recordString(raw, "draftText")) || null,
    teachingFocus: recordString(raw, "teachingFocus"),
    expectedOwnerInput: recordString(raw, "expectedOwnerInput"),
    tags,
  };
}

function analysisFromTrainingRecord(record: ExpressionLearningTrainingRecord): ExpressionLearningAnalysis | null {
  return analysisFromRaw(record.analysisSnapshot);
}

function analysisFromRaw(value: unknown): ExpressionLearningAnalysis | null {
  const raw = recordObject(value);
  const lesson = recordString(raw, "lesson");
  if (!lesson) return null;
  return {
    lesson,
    reasoning: recordString(raw, "reasoning"),
    strategy: recordString(raw, "strategy"),
    tone: recordString(raw, "tone"),
    avoidances: textList(raw.avoidances),
    tags: textList(raw.tags),
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.7,
  };
}

function exerciseStatus(record: ExpressionLearningTrainingRecord) {
  if (record.example?.status === "active") {
    return { key: "active", label: "已启用", active: true };
  }
  if (record.example?.status === "disabled") {
    return { key: "disabled", label: "已停用", active: false };
  }
  if (record.status === "question_generated") {
    return { key: "question_generated", label: "刚出题", active: false };
  }
  return { key: "draft_saved", label: "草稿中", active: false };
}

function exerciseQuestionText(record: ExpressionLearningTrainingRecord): string {
  return (record.contextText ?? recordString(record.generatedQuestion, "contextText")) || "未填写题目";
}

function distillationLabel(example: ExpressionLearningExample): string {
  const evidences = example.ruleEvidences ?? [];
  if (evidences.length === 0) return "未整理";
  return evidences.some((item) => item.coverage === "full") ? "已完整覆盖" : "部分覆盖";
}

function dialogueCaseStatusLabel(value: string) {
  return ({
    draft: "草稿",
    active: "进行中",
    archived: "已归档",
  } as Record<string, string>)[value] ?? value;
}

function dialoguePathTurns(
  caseItem: ExpressionLearningDialogueCase,
  leaf: ExpressionLearningDialogueTurn | null,
): ExpressionLearningDialogueTurn[] {
  if (!leaf) return [];
  const byId = new Map(caseItem.turns.map((turn) => [turn.id, turn]));
  const path: ExpressionLearningDialogueTurn[] = [];
  const seen = new Set<string>();
  let current: ExpressionLearningDialogueTurn | undefined = leaf;
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parentTurnId ? byId.get(current.parentTurnId) : undefined;
  }
  return path;
}

export function ExpressionLearningPage({ adminToken }: Props) {
  const [activeTab, setActiveTab] = useState<LearningTab>("library");
  const [state, setState] = useState(emptyState);
  const [exerciseState, setExerciseState] = useState(emptyExerciseState);
  const [dialogueState, setDialogueState] = useState(emptyDialogueState);
  const [ruleState, setRuleState] = useState(emptyRuleState);
  const [distillationBatches, setDistillationBatches] = useState<ExpressionLearningDistillationBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDialogueCaseId, setSelectedDialogueCaseId] = useState<string | null>(null);
  const [selectedDialogueTurnId, setSelectedDialogueTurnId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedDistillationBatchId, setSelectedDistillationBatchId] = useState<string | null>(null);
  const [ruleSeed, setRuleSeed] = useState<RuleSeed | null>(null);
  const [teachingSeed, setTeachingSeed] = useState<TeachingSeed | null>(null);
  const [teachingRevision, setTeachingRevision] = useState(0);
  const [scene, setScene] = useState("all");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [exerciseCreatedFrom, setExerciseCreatedFrom] = useState("");
  const [exerciseCreatedTo, setExerciseCreatedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [batching, setBatching] = useState(false);
  const [distilling, setDistilling] = useState(false);
  const [exporting, setExporting] = useState<"json" | "jsonl" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => state.examples.find((example) => example.id === selectedId) ?? state.examples[0] ?? null,
    [selectedId, state.examples],
  );
  const selectedDialogueCase = useMemo(
    () => dialogueState.cases.find((item) => item.id === selectedDialogueCaseId) ?? dialogueState.cases[0] ?? null,
    [dialogueState.cases, selectedDialogueCaseId],
  );
  const selectedDialogueTurn = useMemo(
    () => selectedDialogueCase?.turns.find((turn) => turn.id === selectedDialogueTurnId) ?? selectedDialogueCase?.turns[0] ?? null,
    [selectedDialogueCase, selectedDialogueTurnId],
  );
  const selectedRule = useMemo(
    () => ruleState.rules.find((rule) => rule.id === selectedRuleId) ?? ruleState.rules[0] ?? null,
    [ruleState.rules, selectedRuleId],
  );
  const selectedDistillationBatch = useMemo(
    () => distillationBatches.find((batch) => batch.id === selectedDistillationBatchId) ?? distillationBatches[0] ?? null,
    [distillationBatches, selectedDistillationBatchId],
  );

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExpressionLearningExamples({
        token: adminToken,
        scene,
        status,
        outcome,
        query,
      });
      setState(result);
      if (!result.examples.some((example) => example.id === selectedId)) {
        setSelectedId(result.examples[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadExercises() {
    if (!adminToken) return;
    setError(null);
    try {
      const result = await fetchExpressionLearningTrainingRecords({
        token: adminToken,
        sourceType: "exercise",
        status: "all",
        createdFrom: exerciseCreatedFrom || undefined,
        createdTo: exerciseCreatedTo || undefined,
        limit: 300,
      });
      setExerciseState(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadRules() {
    if (!adminToken) return;
    setError(null);
    try {
      const result = await fetchExpressionLearningRules({ token: adminToken });
      setRuleState(result);
      if (!result.rules.some((rule) => rule.id === selectedRuleId)) {
        setSelectedRuleId(result.rules[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadDistillationBatches() {
    if (!adminToken) return;
    setError(null);
    try {
      const result = await fetchExpressionLearningDistillationBatches({ token: adminToken, limit: 20 });
      setDistillationBatches(result.batches);
      if (!result.batches.some((batch) => batch.id === selectedDistillationBatchId)) {
        setSelectedDistillationBatchId(result.batches[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadDialogues() {
    if (!adminToken) return;
    setError(null);
    try {
      const result = await fetchExpressionLearningDialogueCases({
        token: adminToken,
        limit: 200,
      });
      setDialogueState(result);
      const nextCase = result.cases.find((item) => item.id === selectedDialogueCaseId) ?? result.cases[0] ?? null;
      if (!nextCase) {
        setSelectedDialogueCaseId(null);
        setSelectedDialogueTurnId(null);
        return;
      }
      if (nextCase.id !== selectedDialogueCaseId) {
        setSelectedDialogueCaseId(nextCase.id);
      }
      if (!nextCase.turns.some((turn) => turn.id === selectedDialogueTurnId)) {
        setSelectedDialogueTurnId(nextCase.turns[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshAll() {
    await Promise.all([load(), loadRules(), loadDistillationBatches(), loadExercises(), loadDialogues()]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, scene, status, outcome, query]);

  useEffect(() => {
    void loadExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, exerciseCreatedFrom, exerciseCreatedTo]);

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    void loadDistillationBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    void loadDialogues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  async function save(exampleId: string, patch: ExpressionLearningPatch) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await updateExpressionLearningExample({ ...patch, token: adminToken, exampleId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function reanalyze(exampleId: string) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await reanalyzeExpressionLearningExample({ token: adminToken, exampleId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function createTeachingExample(input: Omit<ExpressionLearningCreateInput, "token">) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const { example } = await createExpressionLearningExample({
        ...input,
        token: adminToken,
      });
      await refreshAll();
      setSelectedId(example.id);
      setActiveTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function generatePractice(input: {
    scene: string;
    focus?: string | null;
  }): Promise<ExpressionLearningPracticeQuestionResponse | null> {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await generateExpressionLearningPracticeQuestion({
        ...input,
        token: adminToken,
      });
      await loadExercises();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function runBatchPracticeNow() {
    if (!adminToken) return;
    setBatching(true);
    setError(null);
    try {
      await runExpressionLearningPracticeBatchNow({ token: adminToken });
      await loadExercises();
      setActiveTab("exercises");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBatching(false);
    }
  }

  async function generateDraft(input: {
    scene: string;
    contextText: string;
  }): Promise<{ draftText: string; draftReason: string; trainingRecordId: string | null } | null> {
    if (!adminToken) return null;
    setDrafting(true);
    setError(null);
    try {
      const result = await generateExpressionLearningDraft({
        ...input,
        token: adminToken,
      });
      return {
        draftText: result.draftText,
        draftReason: result.reason,
        trainingRecordId: result.trainingRecord?.id ?? null,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setDrafting(false);
    }
  }

  function rememberDialogueCase(dialogueCase: ExpressionLearningDialogueCase, turnId?: string | null) {
    setDialogueState((current) => {
      const exists = current.cases.some((item) => item.id === dialogueCase.id);
      const cases = exists
        ? current.cases.map((item) => item.id === dialogueCase.id ? dialogueCase : item)
        : [dialogueCase, ...current.cases];
      return {
        ...current,
        cases,
        summary: exists ? current.summary : { ...current.summary, total: current.summary.total + 1 },
      };
    });
    setSelectedDialogueCaseId(dialogueCase.id);
    setSelectedDialogueTurnId(turnId ?? dialogueCase.turns[0]?.id ?? null);
  }

  function newestTurn(dialogueCase: ExpressionLearningDialogueCase): ExpressionLearningDialogueTurn | null {
    return [...dialogueCase.turns].sort((a, b) => (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ))[0] ?? null;
  }

  async function createDialogueCase(input: {
    scene: string;
    title?: string | null;
    trainingFocus?: string | null;
    rootContextText: string;
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await createExpressionLearningDialogueCase({
        ...input,
        token: adminToken,
        status: "draft",
      });
      rememberDialogueCase(result.dialogueCase);
      await loadDialogues();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function saveDialogueCase(input: {
    caseId: string;
    scene?: string;
    title?: string | null;
    trainingFocus?: string | null;
    rootContextText?: string;
    status?: "draft" | "active" | "archived";
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await updateExpressionLearningDialogueCase({
        ...input,
        token: adminToken,
      });
      rememberDialogueCase(result.dialogueCase, selectedDialogueTurnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function addDialogueTurn(input: {
    caseId: string;
    parentTurnId?: string | null;
    branchLabel?: string | null;
    userText: string;
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await createExpressionLearningDialogueTurn({
        ...input,
        token: adminToken,
      });
      rememberDialogueCase(result.dialogueCase, newestTurn(result.dialogueCase)?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function saveDialogueTurn(input: {
    turnId: string;
    branchLabel?: string | null;
    userText?: string;
    draftText?: string | null;
    finalText?: string | null;
    outcome?: "sent" | "skipped" | null;
    ownerAction?: string | null;
    ownerNote?: string | null;
    analysisSnapshot?: unknown;
    status?: string;
  }) {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await updateExpressionLearningDialogueTurn({
        ...input,
        token: adminToken,
      });
      rememberDialogueCase(result.dialogueCase, input.turnId);
      return result.dialogueCase.turns.find((turn) => turn.id === input.turnId) ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function generateDialogueDraft(turnId: string): Promise<string | null> {
    if (!adminToken) return null;
    setDrafting(true);
    setError(null);
    try {
      const result = await generateExpressionLearningDialogueTurnDraft({
        token: adminToken,
        turnId,
      });
      rememberDialogueCase(result.dialogueCase, turnId);
      return result.draftText;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setDrafting(false);
    }
  }

  async function analyzeDialogueTurn(input: {
    turnId: string;
    draftText?: string | null;
    finalText?: string | null;
    outcome?: "sent" | "skipped" | null;
    ownerAction?: string | null;
    ownerNote?: string | null;
  }): Promise<ExpressionLearningAnalysis | null> {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await analyzeExpressionLearningDialogueTurn({
        ...input,
        token: adminToken,
      });
      rememberDialogueCase(result.dialogueCase, input.turnId);
      return result.analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function saveDialogueExample(input: {
    turnId: string;
    draftText?: string | null;
    finalText?: string | null;
    outcome?: "sent" | "skipped" | null;
    ownerAction?: string | null;
    ownerNote?: string | null;
    analysis?: Partial<ExpressionLearningAnalysis> | null;
    status?: "active" | "disabled";
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await saveExpressionLearningDialogueTurnExample({
        ...input,
        token: adminToken,
      });
      rememberDialogueCase(result.dialogueCase, input.turnId);
      setSelectedId(result.example.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function deleteDialogueTurn(turnId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除这个对话节点吗？它的子分支和对应的表达经验都会一起删除。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const result = await deleteExpressionLearningDialogueTurn({
        token: adminToken,
        turnId,
      });
      rememberDialogueCase(result.dialogueCase, result.dialogueCase.turns[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function deleteDialogueCase(caseId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除整个多轮练习案例吗？所有对话节点和对应的表达经验都会一起删除。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningDialogueCase({ token: adminToken, caseId });
      setDialogueState((current) => ({
        ...current,
        cases: current.cases.filter((item) => item.id !== caseId),
        summary: { ...current.summary, total: Math.max(0, current.summary.total - 1) },
      }));
      setSelectedDialogueCaseId((current) => current === caseId ? null : current);
      setSelectedDialogueTurnId(null);
      await loadDialogues();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function exportTraining(format: "json" | "jsonl") {
    if (!adminToken) return;
    setExporting(format);
    setError(null);
    try {
      const blob = await downloadExpressionLearningTrainingExport({
        token: adminToken,
        format,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lusiyuan-expression-training-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  }

  async function analyzeTeaching(input: Omit<ExpressionLearningCreateInput, "token">) {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await analyzeExpressionLearningExample({ ...input, token: adminToken });
      return result.analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function saveTrainingDraft(
    input: Omit<ExpressionLearningTrainingDraftInput, "token">
  ): Promise<ExpressionLearningTrainingRecord | null> {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await saveExpressionLearningTrainingDraft({
        ...input,
        token: adminToken,
      });
      await loadExercises();
      return result.record;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function acceptDraft(input: {
    recordId: string;
    status?: "active" | "disabled";
    ownerNote?: string | null;
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await acceptExpressionLearningTrainingDraft({
        ...input,
        token: adminToken,
      });
      await refreshAll();
      setSelectedId(result.example.id);
      setActiveTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function deleteExercise(recordId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除这道习题吗？它关联的非启用经验也会一起删除。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningTrainingRecord({ token: adminToken, recordId });
      setTeachingSeed((current) => current?.record.id === recordId ? null : current);
      setTeachingRevision(Date.now());
      await loadExercises();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function setExerciseEnabled(exampleId: string, enabled: boolean) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const { example } = await updateExpressionLearningExample({
        token: adminToken,
        exampleId,
        status: enabled ? "active" : "disabled",
      });
      setTeachingSeed((current) => current?.record.exampleId === exampleId
        ? { ...current, record: { ...current.record, example } }
        : current);
      await loadExercises();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  function editExercise(record: ExpressionLearningTrainingRecord) {
    setTeachingSeed({ record, revision: Date.now() });
    setTeachingRevision(Date.now());
    setActiveTab("exercises");
  }

  function startNewExercise() {
    setTeachingSeed(null);
    setTeachingRevision(Date.now());
    setActiveTab("exercises");
  }

  async function deleteExample(exampleId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除这条经验吗？删除后不可恢复，对应习题和规则证据关联也会一起删除。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningExample({ token: adminToken, exampleId });
      if (selectedId === exampleId) {
        setSelectedId(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function distillRule(exampleId: string) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const { candidate } = await proposeExpressionLearningRule({ token: adminToken, exampleId });
      setRuleSeed({ ...candidate, exampleId, revision: Date.now() });
      setSelectedRuleId(null);
      setActiveTab("rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function saveRule(input: {
    ruleId?: string;
    ruleText: string;
    kind: ExpressionLearningRule["kind"];
    scope: ExpressionLearningRule["scope"];
    scene: string | null;
    strength: ExpressionLearningRule["strength"];
    status: ExpressionLearningRule["status"];
    exampleId?: string | null;
    coverage?: "partial" | "full";
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = input.ruleId
        ? await updateExpressionLearningRule({ ...input, token: adminToken, ruleId: input.ruleId })
        : await createExpressionLearningRule({
            ...input,
            token: adminToken,
            source: input.exampleId ? "distilled" : "manual",
            exampleIds: input.exampleId ? [input.exampleId] : [],
          });
      setRuleSeed(null);
      setSelectedRuleId(result.rule.id);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!adminToken || !window.confirm("确认删除这条表达规则吗？原始经验会继续保留。")) return;
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningRule({ token: adminToken, ruleId });
      setSelectedRuleId(null);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function runDistillation(input: {
    scene: string;
    organization: "unorganized" | "partial" | "full" | "all";
    createdFrom: string;
    createdTo: string;
  }) {
    if (!adminToken) return;
    setDistilling(true);
    setError(null);
    try {
      const { batch } = await createExpressionLearningDistillationBatch({
        token: adminToken,
        scene: input.scene === "all" ? null : input.scene,
        organization: input.organization,
        createdFrom: input.createdFrom || null,
        createdTo: input.createdTo || null,
        limit: 40,
      });
      setDistillationBatches((current) => [batch, ...current.filter((item) => item.id !== batch.id)]);
      setSelectedDistillationBatchId(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDistilling(false);
    }
  }

  async function saveDistillationCandidate(
    candidateId: string,
    patch: DistillationCandidatePatch,
  ) {
    if (!adminToken) return false;
    setWorking(true);
    setError(null);
    try {
      await updateExpressionLearningDistillationCandidate({ token: adminToken, candidateId, ...patch });
      await loadDistillationBatches();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function resolveDistillationCandidate(input: {
    candidateId: string;
    patch: DistillationCandidatePatch;
    action: "create" | "merge" | "dismiss";
    ruleStatus?: "draft" | "active";
  }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      if (input.action !== "dismiss") {
        await updateExpressionLearningDistillationCandidate({
          token: adminToken,
          candidateId: input.candidateId,
          ...input.patch,
        });
      }
      await resolveExpressionLearningDistillationCandidate({
        token: adminToken,
        candidateId: input.candidateId,
        action: input.action,
        ruleStatus: input.ruleStatus,
      });
      await Promise.all([loadDistillationBatches(), loadRules(), load()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function reopenDistillationCandidate(candidateId: string) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await reopenExpressionLearningDistillationCandidate({ token: adminToken, candidateId });
      await loadDistillationBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  const skippedRatio = state.summary.total > 0
    ? Math.round((state.summary.skipped / state.summary.total) * 100)
    : 0;
  const activeRatio = state.summary.total > 0
    ? Math.round((state.summary.active / state.summary.total) * 100)
    : 0;

  function openLibraryFilter(nextStatus: string, nextOutcome: string) {
    setScene("all");
    setStatus(nextStatus);
    setOutcome(nextOutcome);
    setQuery("");
    setActiveTab("library");
  }

  return (
    <div className="space-y-5">
      <Card className="admin-learning-hero overflow-hidden p-6 md:p-8" pattern="app-pink">
        <div className="flex flex-wrap items-center gap-2">
          <span className="admin-chip admin-chip-mint">
            <Icon name="icon-design" size={16} />
            Expression Learning
          </span>
          <span className="admin-chip admin-chip-pink">表达选择 · 不是人格</span>
          <span className="admin-chip admin-chip-yellow">不会改写长期记忆</span>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black leading-tight text-[var(--ls-ink-strong)] md:text-[2.1rem]">
              表达学习
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-[0.95rem]">
              这里记录你如何修改、采用或放弃思源的回复。它学习的是表达选择，不会改写人格和长期记忆。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="default"
              size="middle"
              onClick={() => void exportTraining("json")}
              disabled={Boolean(exporting)}
              loading={exporting === "json"}
            >
              导出 JSON
            </Button>
            <Button
              type="default"
              size="middle"
              onClick={() => void exportTraining("jsonl")}
              disabled={Boolean(exporting)}
              loading={exporting === "jsonl"}
            >
              导出 JSONL
            </Button>
            <Button
              type="default"
              size="middle"
              onClick={() => void runBatchPracticeNow()}
              disabled={batching || working}
              loading={batching}
              icon={<Icon name="icon-camera" size={18} />}
            >
              立即批量出题
            </Button>
            <Button
              type="primary"
              size="middle"
              icon={<Icon name="icon-variant" size={18} />}
              onClick={() => void refreshAll()}
              disabled={loading}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="全部经验"
          value={state.summary.total}
          icon="icon-critterpedia"
          tone="app-blue"
          accent="学习过的所有表达笔记"
          onClick={() => openLibraryFilter("all", "all")}
        />
        <Metric
          label="已启用"
          value={state.summary.active}
          icon="icon-miles"
          tone="app-yellow"
          accent={`占总经验 ${activeRatio}% · 当前会影响回复`}
          onClick={() => openLibraryFilter("active", "all")}
        />
        <Metric
          label="选择不回复"
          value={state.summary.skipped}
          icon="icon-variant"
          tone="app-green"
          accent={`占总经验 ${skippedRatio}% · 决定不答也是经验`}
          onClick={() => openLibraryFilter("all", "skipped")}
        />
      </section>

      <LearningTabs active={activeTab} onChange={setActiveTab} />

      {error && (
        <div className="rounded-[20px] border-2 border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-pink-text)]">
          {error}
        </div>
      )}

      {activeTab === "dialogue" && (
        <DialoguePracticePanel
          state={dialogueState}
          selectedCase={selectedDialogueCase}
          selectedTurn={selectedDialogueTurn}
          working={working}
          drafting={drafting}
          onSelectCase={(caseId) => {
            const nextCase = dialogueState.cases.find((item) => item.id === caseId) ?? null;
            setSelectedDialogueCaseId(caseId);
            setSelectedDialogueTurnId(nextCase?.turns[0]?.id ?? null);
          }}
          onSelectTurn={setSelectedDialogueTurnId}
          onCreateCase={(input) => void createDialogueCase(input)}
          onSaveCase={(input) => void saveDialogueCase(input)}
          onAddTurn={(input) => void addDialogueTurn(input)}
          onSaveTurn={saveDialogueTurn}
          onGenerateDraft={generateDialogueDraft}
          onAnalyzeTurn={analyzeDialogueTurn}
          onSaveExample={(input) => void saveDialogueExample(input)}
          onDeleteTurn={(turnId) => void deleteDialogueTurn(turnId)}
          onDeleteCase={(caseId) => void deleteDialogueCase(caseId)}
        />
      )}

      {activeTab === "exercises" && (
        <ExerciseWorkspacePanel
          records={exerciseState.records}
          working={working}
          drafting={drafting}
          onEdit={editExercise}
          onStartNew={startNewExercise}
          createdFrom={exerciseCreatedFrom}
          createdTo={exerciseCreatedTo}
          onCreatedFromChange={setExerciseCreatedFrom}
          onCreatedToChange={setExerciseCreatedTo}
          onClearDateFilter={() => {
            setExerciseCreatedFrom("");
            setExerciseCreatedTo("");
          }}
          onCreate={(input) => void createTeachingExample(input)}
          onAnalyze={(input) => analyzeTeaching(input)}
          onGenerateQuestion={(input) => generatePractice(input)}
          onGenerateDraft={generateDraft}
          onSaveDraft={(input) => saveTrainingDraft(input)}
          onAcceptTeachingDraft={(input) => void acceptDraft(input)}
          onDeleteExercise={(recordId) => void deleteExercise(recordId)}
          onSetExerciseEnabled={(exampleId, enabled) => void setExerciseEnabled(exampleId, enabled)}
          editSeed={teachingSeed}
          teachingRevision={teachingRevision}
        />
      )}

      {activeTab === "rules" && (
        <ExpressionRulesPanel
          key={ruleSeed?.revision ?? selectedRule?.id ?? "empty-rules"}
          state={ruleState}
          batches={distillationBatches}
          selectedBatch={selectedDistillationBatch}
          selectedRule={selectedRule}
          seed={ruleSeed}
          working={working}
          distilling={distilling}
          onSelectBatch={setSelectedDistillationBatchId}
          onRunDistillation={(input) => void runDistillation(input)}
          onSaveCandidate={(candidateId, patch) => saveDistillationCandidate(candidateId, patch)}
          onResolveCandidate={(input) => void resolveDistillationCandidate(input)}
          onReopenCandidate={(candidateId) => void reopenDistillationCandidate(candidateId)}
          onSelect={(ruleId) => {
            setRuleSeed(null);
            setSelectedRuleId(ruleId);
          }}
          onStartNew={() => {
            setSelectedRuleId(null);
            setRuleSeed({
              ruleText: "",
              kind: "strategy",
              scope: "global",
              scene: null,
              strength: "soft",
              coverage: "partial",
              reason: "",
              exampleId: "",
              revision: Date.now(),
            });
          }}
          onSave={(input) => void saveRule(input)}
          onDelete={(ruleId) => void deleteRule(ruleId)}
        />
      )}

      {activeTab === "library" && (
        <>
          <Card className="admin-select-host p-4 md:p-5" pattern="none">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
              <Icon name="icon-map" size={14} />
              筛选条件
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span>
                <AdminSelect
                  ariaLabel="场景"
                  value={scene}
                  onChange={setScene}
                  options={sceneFilterOptions(state.scenes)}
                />
              </label>
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">状态</span>
                <AdminSelect
                  ariaLabel="状态"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { key: "all", label: "全部状态" },
                    { key: "active", label: "参与生成" },
                    { key: "disabled", label: "已停用" },
                  ]}
                />
              </label>
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">最终决定</span>
                <AdminSelect
                  ariaLabel="最终决定"
                  value={outcome}
                  onChange={setOutcome}
                  options={[
                    { key: "all", label: "全部决定" },
                    { key: "sent", label: "发布回复" },
                    { key: "skipped", label: "不回复" },
                  ]}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">搜索</span>
                <Input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                  placeholder="情境、回复或经验"
                  className="h-10"
                  allowClear
                />
              </label>
            </div>
          </Card>

          <section className="grid min-h-[36rem] gap-5 2xl:grid-cols-[minmax(32rem,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
            <Icon name="icon-critterpedia" size={14} />
            <span>经验列表</span>
            <span className="admin-chip admin-chip-mint !py-0.5">{state.examples.length}</span>
            <span className="ml-auto text-[10px] font-semibold tracking-normal text-[var(--ls-ink-faint)]">点击切换查看</span>
          </div>

          {state.examples.map((example) => (
            <ExampleRow
              key={example.id}
              example={example}
              active={selected?.id === example.id}
              onSelect={() => setSelectedId(example.id)}
            />
          ))}

          {!loading && state.examples.length === 0 && (
            <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
              还没有表达经验。可以先用教学练习创建第一条。
            </div>
          )}
        </div>

        {selected ? (
          <ExpressionDetail
            key={selected.id}
            example={selected}
            working={working}
            onSave={(patch) => void save(selected.id, patch)}
            onDelete={() => void deleteExample(selected.id)}
            onReanalyze={() => void reanalyze(selected.id)}
            onDistill={() => void distillRule(selected.id)}
          />
        ) : (
          <Card className="p-5" pattern="none">
            <p className="text-sm text-[var(--ls-ink-soft)]">选择一条经验查看详情。</p>
          </Card>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function LearningTabs({
  active,
  onChange,
}: {
  active: LearningTab;
  onChange: (tab: LearningTab) => void;
}) {
  const tabs: Array<{ key: LearningTab; label: string; description: string; icon: IconName }> = [
    { key: "library", label: "经验库", description: "查看和修正原始经验", icon: "icon-critterpedia" },
    { key: "rules", label: "表达规则", description: "管理跨场景稳定规则", icon: "icon-map" },
    { key: "exercises", label: "习题库", description: "新建、编辑和分析习题", icon: "icon-camera" },
    { key: "dialogue", label: "多轮练习", description: "连续对话和分支", icon: "icon-chat" },
  ];
  return (
    <Card className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4" pattern="none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`admin-stacked-tab-button ${
            active === tab.key ? "admin-stacked-tab-button-active" : ""
          }`}
        >
          <span className="admin-stacked-tab-icon">
            <Icon name={tab.icon} size={20} />
          </span>
          <span className="admin-stacked-tab-copy">
            <span className="admin-stacked-tab-title">{tab.label}</span>
            <span className="admin-stacked-tab-description">{tab.description}</span>
          </span>
        </button>
      ))}
    </Card>
  );
}

type RuleSaveInput = {
  ruleId?: string;
  ruleText: string;
  kind: ExpressionLearningRule["kind"];
  scope: ExpressionLearningRule["scope"];
  scene: string | null;
  strength: ExpressionLearningRule["strength"];
  status: ExpressionLearningRule["status"];
  exampleId?: string | null;
  coverage?: "partial" | "full";
};

type DistillationCandidatePatch = {
  ruleText?: string;
  kind?: ExpressionLearningRule["kind"];
  scope?: ExpressionLearningRule["scope"];
  scene?: string | null;
  strength?: ExpressionLearningRule["strength"];
  coverage?: "partial" | "full";
  reason?: string | null;
  sourceExampleIds?: string[];
};

function distillationMatchLabel(value: ExpressionLearningDistillationCandidate["matchType"]) {
  return value === "duplicate" ? "重复规则" : value === "conflict" ? "规则冲突" : "新规则";
}

function distillationBatchStatusLabel(value: ExpressionLearningDistillationBatch["status"]) {
  return ({ processing: "整理中", proposed: "待处理", completed: "已完成", failed: "失败" } as Record<string, string>)[value] ?? value;
}

function candidateSourceIds(candidate: ExpressionLearningDistillationCandidate): string[] {
  return Array.isArray(candidate.sourceExampleIds)
    ? candidate.sourceExampleIds.filter((item): item is string => typeof item === "string")
    : [];
}

function DistillationWorkbench({
  batches,
  selectedBatch,
  working,
  distilling,
  onSelectBatch,
  onRun,
  onSaveCandidate,
  onResolveCandidate,
  onReopenCandidate,
}: {
  batches: ExpressionLearningDistillationBatch[];
  selectedBatch: ExpressionLearningDistillationBatch | null;
  working: boolean;
  distilling: boolean;
  onSelectBatch: (batchId: string) => void;
  onRun: (input: {
    scene: string;
    organization: "unorganized" | "partial" | "full" | "all";
    createdFrom: string;
    createdTo: string;
  }) => void;
  onSaveCandidate: (candidateId: string, patch: DistillationCandidatePatch) => Promise<boolean>;
  onResolveCandidate: (input: {
    candidateId: string;
    patch: DistillationCandidatePatch;
    action: "create" | "merge" | "dismiss";
    ruleStatus?: "draft" | "active";
  }) => void;
  onReopenCandidate: (candidateId: string) => void;
}) {
  const [filters, setFilters] = useState({
    scene: "all",
    organization: "unorganized" as "unorganized" | "partial" | "full" | "all",
    createdFrom: "",
    createdTo: "",
  });
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(selectedBatch?.candidates[0]?.id ?? null);
  useEffect(() => {
    setSelectedCandidateId(selectedBatch?.candidates[0]?.id ?? null);
  }, [selectedBatch?.id]);
  const proposedCount = selectedBatch?.candidates.filter((candidate) => candidate.status === "proposed").length ?? 0;
  const selectedCandidate = selectedBatch?.candidates.find((candidate) => candidate.id === selectedCandidateId)
    ?? selectedBatch?.candidates[0]
    ?? null;

  return (
    <Card className="space-y-5 p-5" pattern="app-green">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle icon="icon-diy">经验蒸馏</SectionTitle>
          <h3 className="mt-2 text-xl font-black text-[var(--ls-ink-strong)]">批量整理候选规则</h3>
        </div>
        <Button
          type="primary"
          size="middle"
          disabled={distilling || working}
          loading={distilling}
          onClick={() => onRun(filters)}
          icon={<Icon name="icon-variant" size={18} />}
        >
          {distilling ? "整理中" : "开始整理"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField label="经验范围" value={filters.organization} onChange={(organization) => setFilters((current) => ({ ...current, organization: organization as typeof filters.organization }))} options={[{ key: "unorganized", label: "未整理" }, { key: "partial", label: "部分覆盖" }, { key: "full", label: "已完整覆盖" }, { key: "all", label: "全部经验" }]} />
        <SelectField label="场景" value={filters.scene} onChange={(scene) => setFilters((current) => ({ ...current, scene }))} options={sceneFilterOptions()} />
        <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[var(--ls-ink-soft)]">开始日期</span><Input type="date" className="h-10" value={filters.createdFrom} onChange={(event: ChangeEvent<HTMLInputElement>) => setFilters((current) => ({ ...current, createdFrom: event.target.value }))} /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[var(--ls-ink-soft)]">结束日期</span><Input type="date" className="h-10" value={filters.createdTo} onChange={(event: ChangeEvent<HTMLInputElement>) => setFilters((current) => ({ ...current, createdTo: event.target.value }))} /></label>
      </div>

      {batches.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {batches.slice(0, 10).map((batch) => (
            <button key={batch.id} type="button" onClick={() => onSelectBatch(batch.id)} className={`admin-island-row min-w-[12rem] px-3 py-2 text-left ${selectedBatch?.id === batch.id ? "is-active" : ""}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[var(--ls-ink-strong)]">{formatTime(batch.createdAt)}</span><span className="admin-chip admin-chip-mint">{distillationBatchStatusLabel(batch.status)}</span></div>
              <p className="mt-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">{batch.sourceCount} 条经验 · {batch.candidateCount} 条候选</p>
            </button>
          ))}
        </div>
      )}

      {selectedBatch ? (
        <div className="space-y-3 border-t-2 border-dashed border-[var(--ls-border)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-chip admin-chip-mint">来源 {selectedBatch.sourceCount}</span>
            <span className="admin-chip admin-chip-yellow">候选 {selectedBatch.candidateCount}</span>
            <span className="admin-chip admin-chip-pink">待处理 {proposedCount}</span>
          </div>
          {selectedBatch.error && <div className="admin-island-soft-panel px-4 py-3 text-sm font-semibold text-[var(--ls-pink-text)]">{selectedBatch.error}</div>}
          {selectedBatch.candidates.length > 0 && <div className="grid gap-4 xl:grid-cols-[minmax(17rem,0.65fr)_minmax(0,1.35fr)] xl:items-start">
            <div className="space-y-2">
              {selectedBatch.candidates.map((candidate) => (
                <button key={candidate.id} type="button" onClick={() => setSelectedCandidateId(candidate.id)} className={`admin-island-row block w-full px-3 py-3 text-left ${selectedCandidate?.id === candidate.id ? "is-active" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`admin-chip ${candidate.matchType === "conflict" ? "admin-chip-pink" : candidate.matchType === "duplicate" ? "admin-chip-yellow" : "admin-chip-mint"}`}>{distillationMatchLabel(candidate.matchType)}</span>
                    <span className="text-[11px] font-semibold text-[var(--ls-ink-muted)]">{candidateSourceIds(candidate).length} 条证据</span>
                    {candidate.status !== "proposed" && <span className="ml-auto text-[11px] font-bold text-[var(--ls-ink-muted)]">{candidate.status === "accepted" ? candidate.createdRule?.status === "active" ? "已启用" : "已保存" : candidate.status === "merged" ? "已合并" : "已忽略"}</span>}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">{candidate.ruleText}</p>
                </button>
              ))}
            </div>
            {selectedCandidate && <DistillationCandidateEditor
              key={selectedCandidate.id}
              candidate={selectedCandidate}
              sourceExamples={selectedBatch.sourceExamples}
              working={working}
              onSave={onSaveCandidate}
              onResolve={onResolveCandidate}
              onReopen={onReopenCandidate}
            />}
          </div>}
          {selectedBatch.status !== "failed" && selectedBatch.candidates.length === 0 && <div className="admin-island-soft-panel px-4 py-7 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">本批次没有生成有价值的候选规则。</div>}
        </div>
      ) : (
        <div className="admin-island-soft-panel px-4 py-7 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">选择范围后开始第一次批量整理。</div>
      )}
    </Card>
  );
}

function DistillationCandidateEditor({
  candidate,
  sourceExamples,
  working,
  onSave,
  onResolve,
  onReopen,
}: {
  candidate: ExpressionLearningDistillationCandidate;
  sourceExamples: ExpressionLearningExample[];
  working: boolean;
  onSave: (candidateId: string, patch: DistillationCandidatePatch) => Promise<boolean>;
  onResolve: (input: {
    candidateId: string;
    patch: DistillationCandidatePatch;
    action: "create" | "merge" | "dismiss";
    ruleStatus?: "draft" | "active";
  }) => void;
  onReopen: (candidateId: string) => void;
}) {
  const [form, setForm] = useState({
    ruleText: candidate.ruleText,
    kind: candidate.kind,
    scope: candidate.scope,
    scene: candidate.scene ?? "general",
    strength: candidate.strength,
    coverage: candidate.coverage,
    reason: candidate.reason ?? "",
  });
  const [showAllSources, setShowAllSources] = useState(false);
  const sourceIds = candidateSourceIds(candidate);
  const sources = sourceExamples.filter((example) => sourceIds.includes(example.id));
  const visibleSources = showAllSources ? sources : sources.slice(0, 3);
  const patch: DistillationCandidatePatch = {
    ...form,
    scene: form.scope === "global" ? null : form.scene,
    sourceExampleIds: sourceIds,
  };
  const resolved = candidate.status !== "proposed";

  return (
    <div className={`rounded-lg border-2 p-4 ${candidate.matchType === "conflict" ? "border-[var(--ls-pink)] bg-[var(--ls-pink-soft)]" : "border-[var(--ls-border)] bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`admin-chip ${candidate.matchType === "conflict" ? "admin-chip-pink" : candidate.matchType === "duplicate" ? "admin-chip-yellow" : "admin-chip-mint"}`}>{distillationMatchLabel(candidate.matchType)}</span>
        <span className="text-xs font-semibold text-[var(--ls-ink-muted)]">{sourceIds.length} 条证据</span>
        {resolved && <span className="ml-auto admin-chip admin-chip-mint">{candidate.status === "accepted" ? candidate.createdRule?.status === "active" ? "已启用" : "已保存（未启用）" : candidate.status === "merged" ? "已合并" : "已忽略"}</span>}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-3">
          <EditField label="候选规则" value={form.ruleText} onChange={(ruleText) => setForm((current) => ({ ...current, ruleText }))} rows={3} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectField label="类型" value={form.kind} onChange={(kind) => setForm((current) => ({ ...current, kind: kind as ExpressionLearningRule["kind"] }))} options={[{ key: "avoid", label: "避免" }, { key: "prefer", label: "表达偏好" }, { key: "strategy", label: "回复策略" }]} />
            <SelectField label="范围" value={form.scope} onChange={(scope) => setForm((current) => ({ ...current, scope: scope as ExpressionLearningRule["scope"] }))} options={[{ key: "global", label: "全局" }, { key: "scene", label: "指定场景" }]} />
            {form.scope === "scene" && <SelectField label="场景" value={form.scene} onChange={(scene) => setForm((current) => ({ ...current, scene }))} options={defaultSceneOptions} />}
            <SelectField label="强度" value={form.strength} onChange={(strength) => setForm((current) => ({ ...current, strength: strength as ExpressionLearningRule["strength"] }))} options={[{ key: "soft", label: "尽量遵守" }, { key: "hard", label: "必须遵守" }]} />
            <SelectField label="经验覆盖程度" value={form.coverage} onChange={(coverage) => setForm((current) => ({ ...current, coverage: coverage as "partial" | "full" }))} options={[{ key: "partial", label: "部分覆盖，可继续整理" }, { key: "full", label: "完整覆盖" }]} />
          </div>
          <EditField label="提炼依据" value={form.reason} onChange={(reason) => setForm((current) => ({ ...current, reason }))} rows={2} />
        </div>
        <div className="space-y-3">
          {candidate.matchedRule && <DetailReadBlock label={candidate.matchType === "conflict" ? "冲突的现有规则" : "匹配的现有规则"} value={`${candidate.matchedRule.ruleText}\n\n${candidate.matchReason ?? ""}`} icon="icon-map" tone={candidate.matchType === "conflict" ? "admin-chip-pink" : "admin-chip-yellow"} />}
          <div className="space-y-2">
            <SectionTitle icon="icon-critterpedia">来源经验</SectionTitle>
            {visibleSources.map((example) => <div key={example.id} className="admin-island-soft-panel px-3 py-2"><div className="text-[11px] font-bold text-[var(--ls-ink-muted)]">{sceneLabel(example.scene)}</div><p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ls-ink-strong)]">{example.contextText}</p></div>)}
            {sources.length > 3 && <button type="button" className="text-xs font-bold text-[var(--ls-link)] underline decoration-dotted underline-offset-4" onClick={() => setShowAllSources((current) => !current)}>{showAllSources ? "收起证据" : `展开另外 ${sources.length - 3} 条证据`}</button>}
          </div>
        </div>
      </div>
      {!resolved && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-dashed border-[var(--ls-border)] pt-3">
        <Button type="default" size="small" disabled={working} onClick={() => onResolve({ candidateId: candidate.id, patch, action: "dismiss" })}>忽略</Button>
        <Button type="default" size="small" disabled={working || !form.ruleText.trim()} onClick={() => void onSave(candidate.id, patch)}>保存修改</Button>
        {candidate.matchedRuleId && <Button type="default" size="small" disabled={working} onClick={() => onResolve({ candidateId: candidate.id, patch, action: "merge" })}>{candidate.matchType === "conflict" ? "记为反例" : "合并证据"}</Button>}
        <Button type="default" size="small" disabled={working || !form.ruleText.trim()} onClick={() => onResolve({ candidateId: candidate.id, patch, action: "create", ruleStatus: "draft" })}>保存</Button>
        <Button type="primary" size="small" disabled={working || !form.ruleText.trim()} onClick={() => onResolve({ candidateId: candidate.id, patch, action: "create", ruleStatus: "active" })}>保存并启用</Button>
      </div>}
      {candidate.status === "dismissed" && <div className="mt-4 flex justify-end border-t border-dashed border-[var(--ls-border)] pt-3"><Button type="default" size="small" disabled={working} onClick={() => onReopen(candidate.id)}>取消忽略</Button></div>}
    </div>
  );
}

function ExpressionRulesPanel({
  state,
  batches,
  selectedBatch,
  selectedRule,
  seed,
  working,
  distilling,
  onSelectBatch,
  onRunDistillation,
  onSaveCandidate,
  onResolveCandidate,
  onReopenCandidate,
  onSelect,
  onStartNew,
  onSave,
  onDelete,
}: {
  state: ExpressionLearningRulesResponse;
  batches: ExpressionLearningDistillationBatch[];
  selectedBatch: ExpressionLearningDistillationBatch | null;
  selectedRule: ExpressionLearningRule | null;
  seed: RuleSeed | null;
  working: boolean;
  distilling: boolean;
  onSelectBatch: (batchId: string) => void;
  onRunDistillation: (input: {
    scene: string;
    organization: "unorganized" | "partial" | "full" | "all";
    createdFrom: string;
    createdTo: string;
  }) => void;
  onSaveCandidate: (candidateId: string, patch: DistillationCandidatePatch) => Promise<boolean>;
  onResolveCandidate: (input: {
    candidateId: string;
    patch: DistillationCandidatePatch;
    action: "create" | "merge" | "dismiss";
    ruleStatus?: "draft" | "active";
  }) => void;
  onReopenCandidate: (candidateId: string) => void;
  onSelect: (ruleId: string) => void;
  onStartNew: () => void;
  onSave: (input: RuleSaveInput) => void;
  onDelete: (ruleId: string) => void;
}) {
  const initial = seed ?? selectedRule;
  const [form, setForm] = useState({
    ruleText: initial?.ruleText ?? "",
    kind: initial?.kind ?? "strategy" as ExpressionLearningRule["kind"],
    scope: initial?.scope ?? "global" as ExpressionLearningRule["scope"],
    scene: initial?.scene ?? "general",
    strength: initial?.strength ?? "soft" as ExpressionLearningRule["strength"],
    status: selectedRule?.status ?? "draft" as ExpressionLearningRule["status"],
    coverage: seed?.coverage ?? "partial" as "partial" | "full",
  });

  function submit(status = form.status) {
    onSave({
      ruleId: selectedRule?.id,
      ruleText: form.ruleText,
      kind: form.kind,
      scope: form.scope,
      scene: form.scope === "scene" ? form.scene : null,
      strength: form.strength,
      status,
      exampleId: seed?.exampleId || null,
      coverage: form.coverage,
    });
  }

  return (
    <div className="space-y-5">
      <DistillationWorkbench
        batches={batches}
        selectedBatch={selectedBatch}
        working={working}
        distilling={distilling}
        onSelectBatch={onSelectBatch}
        onRun={onRunDistillation}
        onSaveCandidate={onSaveCandidate}
        onResolveCandidate={onResolveCandidate}
        onReopenCandidate={onReopenCandidate}
      />
      <section className="grid min-h-[36rem] gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
      <Card className="space-y-4 p-5" pattern="app-blue">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionTitle icon="icon-map">表达规则</SectionTitle>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">
              已启用规则直接参与生成，原始经验仍单独保留。
            </p>
          </div>
          <Button type="primary" size="small" onClick={onStartNew} disabled={working}>新建规则</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="admin-chip admin-chip-mint">全部 {state.summary.total}</span>
          <span className="admin-chip admin-chip-yellow">已启用 {state.summary.active}</span>
          <span className="admin-chip admin-chip-pink">草稿 {state.summary.draft}</span>
        </div>
        <div className="space-y-2">
          {state.rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => onSelect(rule.id)}
              className={`admin-island-row block w-full px-4 py-3 text-left ${selectedRule?.id === rule.id && !seed ? "is-active" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill active={rule.status === "active"} label={rule.status === "active" ? "已启用" : rule.status === "draft" ? "草稿" : "已停用"} />
                <span className="admin-chip admin-chip-mint">{rule.scope === "global" ? "全局" : sceneLabel(rule.scene ?? "general")}</span>
                {rule.strength === "hard" && <span className="admin-chip admin-chip-pink">必须遵守</span>}
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">{rule.ruleText}</p>
              <p className="mt-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">{rule.evidences.length} 条原始证据</p>
            </button>
          ))}
          {state.rules.length === 0 && (
            <div className="admin-island-soft-panel px-4 py-8 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">
              还没有规则，可以新建或从经验详情提炼。
            </div>
          )}
        </div>
      </Card>

      {initial ? (
        <Card className="space-y-5 p-5" pattern="app-yellow">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-[var(--ls-border)] pb-4">
            <div>
              <SectionTitle icon="icon-diy">{selectedRule ? "规则详情" : seed?.exampleId ? "提炼候选规则" : "新建规则"}</SectionTitle>
              <p className="mt-2 text-sm font-semibold text-[var(--ls-ink-muted)]">
                {seed?.reason || "规则可以随时修改、停用，原始训练资料不会被删除。"}
              </p>
            </div>
            {selectedRule && (
              <div className="flex items-center gap-2">
                <Button type="default" size="small" onClick={() => onDelete(selectedRule.id)} disabled={working} className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]">删除</Button>
                <span className="flex h-8 items-center gap-2 rounded-lg border border-[var(--ls-border)] bg-white px-2.5 text-xs font-semibold">
                  {form.status === "active" ? "已启用" : "已停用"}
                  <Switch
                    checked={form.status === "active"}
                    disabled={working}
                    onChange={(enabled: boolean) => {
                      const status = enabled ? "active" : "disabled";
                      setForm((current) => ({ ...current, status }));
                      submit(status);
                    }}
                    aria-label="启用这条表达规则"
                  />
                </span>
              </div>
            )}
          </div>

          <EditField label="规则内容" value={form.ruleText} onChange={(ruleText) => setForm((current) => ({ ...current, ruleText }))} rows={5} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="规则类型" value={form.kind} onChange={(kind) => setForm((current) => ({ ...current, kind: kind as ExpressionLearningRule["kind"] }))} options={[{ key: "avoid", label: "避免" }, { key: "prefer", label: "表达偏好" }, { key: "strategy", label: "回复策略" }]} />
            <SelectField label="执行强度" value={form.strength} onChange={(strength) => setForm((current) => ({ ...current, strength: strength as ExpressionLearningRule["strength"] }))} options={[{ key: "soft", label: "尽量遵守" }, { key: "hard", label: "必须遵守" }]} />
            <SelectField label="适用范围" value={form.scope} onChange={(scope) => setForm((current) => ({ ...current, scope: scope as ExpressionLearningRule["scope"] }))} options={[{ key: "global", label: "全局" }, { key: "scene", label: "指定场景" }]} />
            {form.scope === "scene" && <SelectField label="场景" value={form.scene} onChange={(scene) => setForm((current) => ({ ...current, scene }))} options={defaultSceneOptions} />}
            {seed?.exampleId && <SelectField label="经验覆盖程度" value={form.coverage} onChange={(coverage) => setForm((current) => ({ ...current, coverage: coverage as "partial" | "full" }))} options={[{ key: "partial", label: "部分覆盖，可继续整理" }, { key: "full", label: "完整覆盖" }]} />}
          </div>

          {selectedRule && selectedRule.evidences.length > 0 && (
            <div className="space-y-2">
              <SectionTitle icon="icon-critterpedia">原始经验证据</SectionTitle>
              {selectedRule.evidences.map((evidence) => (
                <div key={evidence.id} className="admin-island-soft-panel px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--ls-ink-muted)]">
                    <span>{sceneLabel(evidence.example.scene)}</span><span>·</span><span>{evidence.coverage === "full" ? "完整覆盖" : "部分覆盖"}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ls-ink-strong)]">{evidence.example.contextText}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t-2 border-dashed border-[var(--ls-border)] pt-4">
            {!selectedRule && <Button type="default" size="middle" disabled={working || !form.ruleText.trim()} onClick={() => submit("draft")}>保存草稿</Button>}
            <Button type="primary" size="middle" disabled={working || !form.ruleText.trim()} loading={working} onClick={() => submit(selectedRule?.status ?? "active")}>{selectedRule ? "保存修改" : "保存并启用"}</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5" pattern="none"><div className="admin-island-soft-panel px-4 py-10 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">选择一条规则查看详情，或新建规则。</div></Card>
      )}
      </section>
    </div>
  );
}

type DialogueTurnSaveInput = {
  turnId: string;
  branchLabel?: string | null;
  userText?: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
  analysisSnapshot?: unknown;
  status?: string;
};

type DialogueTurnDecisionInput = {
  turnId: string;
  draftText?: string | null;
  finalText?: string | null;
  outcome?: "sent" | "skipped" | null;
  ownerAction?: string | null;
  ownerNote?: string | null;
};

function DialoguePracticePanel({
  state,
  selectedCase,
  selectedTurn,
  working,
  drafting,
  onSelectCase,
  onSelectTurn,
  onCreateCase,
  onSaveCase,
  onAddTurn,
  onSaveTurn,
  onGenerateDraft,
  onAnalyzeTurn,
  onSaveExample,
  onDeleteTurn,
  onDeleteCase,
}: {
  state: ExpressionLearningDialogueCasesResponse;
  selectedCase: ExpressionLearningDialogueCase | null;
  selectedTurn: ExpressionLearningDialogueTurn | null;
  working: boolean;
  drafting: boolean;
  onSelectCase: (caseId: string) => void;
  onSelectTurn: (turnId: string) => void;
  onCreateCase: (input: { scene: string; title?: string | null; trainingFocus?: string | null; rootContextText: string }) => void;
  onSaveCase: (input: { caseId: string; scene?: string; title?: string | null; trainingFocus?: string | null; rootContextText?: string; status?: "draft" | "active" | "archived" }) => void;
  onAddTurn: (input: { caseId: string; parentTurnId?: string | null; branchLabel?: string | null; userText: string }) => void;
  onSaveTurn: (input: DialogueTurnSaveInput) => Promise<ExpressionLearningDialogueTurn | null>;
  onGenerateDraft: (turnId: string) => Promise<string | null>;
  onAnalyzeTurn: (input: DialogueTurnDecisionInput) => Promise<ExpressionLearningAnalysis | null>;
  onSaveExample: (input: DialogueTurnDecisionInput & { analysis?: Partial<ExpressionLearningAnalysis> | null; status?: "active" | "disabled" }) => void;
  onDeleteTurn: (turnId: string) => void;
  onDeleteCase: (caseId: string) => void;
}) {
  const [newCase, setNewCase] = useState({ scene: "chat", title: "", rootContextText: "", trainingFocus: "" });
  const [caseForm, setCaseForm] = useState({ scene: "chat", title: "", rootContextText: "", trainingFocus: "", status: "draft" as "draft" | "active" | "archived" });
  const [turnForm, setTurnForm] = useState({ draftText: "", draftReason: "", finalText: "", ownerNote: "", outcome: "sent" as "sent" | "skipped" });
  const [branchParentTurnId, setBranchParentTurnId] = useState<string | null>(null);
  const [newBranchText, setNewBranchText] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);
  const [detailMode, setDetailMode] = useState<"branches" | "reply">("reply");
  const [analysisForm, setAnalysisForm] = useState<AnalysisEditForm | null>(null);

  useEffect(() => {
    if (!selectedCase) return;
    setCaseForm({
      scene: selectedCase.scene,
      title: selectedCase.title,
      rootContextText: selectedCase.rootContextText,
      trainingFocus: selectedCase.trainingFocus ?? "",
      status: selectedCase.status,
    });
  }, [selectedCase]);

  useEffect(() => {
    if (!selectedTurn) {
      setTurnForm({ draftText: "", draftReason: "", finalText: "", ownerNote: "", outcome: "sent" });
      setAnalysisForm(null);
      return;
    }
    setTurnForm({
      draftText: selectedTurn.draftText ?? "",
      draftReason: recordString(selectedTurn.analysisSnapshot, "draftReason"),
      finalText: selectedTurn.finalText ?? "",
      ownerNote: selectedTurn.ownerNote ?? "",
      outcome: selectedTurn.outcome === "skipped" ? "skipped" : "sent",
    });
    const analysis = analysisFromRaw(selectedTurn.analysisSnapshot);
    setAnalysisForm(analysis ? analysisToEditForm(analysis) : null);
    setBranchParentTurnId(selectedTurn.parentTurnId ?? null);
  }, [selectedTurn]);

  const pathTurns = selectedCase ? dialoguePathTurns(selectedCase, selectedTurn) : [];
  const branchChoices = selectedCase?.turns.filter(
    (turn) => (turn.parentTurnId ?? null) === branchParentTurnId,
  ) ?? [];
  const canCreateCase = Boolean(newCase.title.trim() && newCase.rootContextText.trim());
  const canAnalyze = Boolean(selectedTurn && (turnForm.outcome === "skipped" || turnForm.finalText.trim()));
  const canSaveExample = Boolean(canAnalyze && analysisForm);

  function updateTurn<K extends keyof typeof turnForm>(key: K, value: (typeof turnForm)[K]) {
    setTurnForm((current) => ({ ...current, [key]: value }));
    if (key === "finalText" && value) {
      setTurnForm((current) => ({ ...current, outcome: "sent" }));
    }
    if (key !== "ownerNote") setAnalysisForm(null);
  }

  function decision(): DialogueTurnDecisionInput | null {
    if (!selectedTurn) return null;
    return {
      turnId: selectedTurn.id,
      draftText: turnForm.draftText || null,
      finalText: turnForm.outcome === "skipped" ? null : turnForm.finalText || null,
      outcome: turnForm.outcome,
      ownerAction: turnForm.outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: turnForm.ownerNote || null,
    };
  }

  async function persistTurn() {
    if (!selectedTurn) return null;
    return onSaveTurn({
      turnId: selectedTurn.id,
      draftText: turnForm.draftText || null,
      finalText: turnForm.outcome === "skipped" ? null : turnForm.finalText || null,
      outcome: turnForm.outcome,
      ownerAction: turnForm.outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: turnForm.ownerNote || null,
      analysisSnapshot: analysisForm ? { ...editFormToAnalysis(analysisForm), draftReason: turnForm.draftReason } : undefined,
      status: "draft_saved",
    });
  }

  async function generateDraft() {
    if (!selectedTurn) return;
    const saved = await persistTurn();
    if (!saved) return;
    const draft = await onGenerateDraft(selectedTurn.id);
    if (draft) setTurnForm((current) => ({ ...current, draftText: draft }));
  }

  async function analyze() {
    const currentDecision = decision();
    if (!currentDecision) return;
    await persistTurn();
    const analysis = await onAnalyzeTurn(currentDecision);
    if (analysis) setAnalysisForm(analysisToEditForm(analysis));
  }

  function saveExample(status: "active" | "disabled") {
    const currentDecision = decision();
    if (!currentDecision || !analysisForm) return;
    onSaveExample({ ...currentDecision, analysis: editFormToAnalysis(analysisForm), status });
  }

  function selectOtherTurn(turn: ExpressionLearningDialogueTurn) {
    onSelectTurn(turn.id);
    setBranchParentTurnId(turn.parentTurnId ?? null);
    setAddingBranch(false);
    setNewBranchText("");
    setDetailMode("branches");
  }

  function selectSiyuanTurn(turn: ExpressionLearningDialogueTurn) {
    onSelectTurn(turn.id);
    setDetailMode("reply");
  }

  function addBranch() {
    if (!selectedCase || !newBranchText.trim()) return;
    onAddTurn({ caseId: selectedCase.id, parentTurnId: branchParentTurnId, userText: newBranchText.trim() });
    setNewBranchText("");
    setAddingBranch(false);
    setDetailMode("reply");
  }

  return (
    <div className="space-y-5">
      <Card className="admin-select-host space-y-4 p-5" pattern="app-blue">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">New Dialogue Practice</div>
            <h3 className="mt-2 text-2xl font-black text-[var(--ls-ink-strong)]">新增多轮练习</h3>
          </div>
          <span className="admin-chip admin-chip-mint">{state.summary.total} 个练习</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="admin-select-below flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span>
            <AdminSelect ariaLabel="新建多轮练习场景" value={newCase.scene} onChange={(scene) => setNewCase((current) => ({ ...current, scene }))} options={sceneOptions()} />
          </label>
          <TextField label="标题" value={newCase.title} onChange={(title) => setNewCase((current) => ({ ...current, title }))} placeholder="比如：朋友低落时怎么陪" />
        </div>
        <EditField label="情景介绍" value={newCase.rootContextText} onChange={(rootContextText) => setNewCase((current) => ({ ...current, rootContextText }))} rows={3} />
        <TextField label="训练重点" value={newCase.trainingFocus} onChange={(trainingFocus) => setNewCase((current) => ({ ...current, trainingFocus }))} placeholder="比如：先接住情绪，再轻轻追问" />
        <div className="flex justify-end">
          <Button type="primary" size="middle" disabled={working || !canCreateCase} loading={working} onClick={() => {
            onCreateCase({ scene: newCase.scene, title: newCase.title, rootContextText: newCase.rootContextText, trainingFocus: newCase.trainingFocus || null });
            setNewCase({ scene: "chat", title: "", rootContextText: "", trainingFocus: "" });
          }}>
            新建练习
          </Button>
        </div>
      </Card>

      <section className="grid gap-5 2xl:grid-cols-[minmax(19rem,0.65fr)_minmax(0,1.35fr)]">
        <Card className="space-y-3 p-5" pattern="none">
          <SectionTitle icon="icon-critterpedia">多轮练习列表</SectionTitle>
          <div className="space-y-2">
            {state.cases.map((item) => (
              <button key={item.id} type="button" onClick={() => onSelectCase(item.id)} className={`admin-island-row block w-full px-4 py-3 text-left ${selectedCase?.id === item.id ? "is-active" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="admin-chip admin-chip-yellow">{sceneLabel(item.scene)}</span>
                  <StatusPill active={item.status === "active"} label={dialogueCaseStatusLabel(item.status)} />
                </div>
                <div className="mt-2 line-clamp-1 text-sm font-black text-[var(--ls-ink-strong)]">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ls-ink-muted)]">{item.rootContextText}</div>
              </button>
            ))}
            {state.cases.length === 0 && <div className="admin-island-soft-panel px-4 py-8 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">还没有多轮练习。</div>}
          </div>
        </Card>

        {selectedCase ? (
          <div className="space-y-4">
            <Card className="admin-select-host space-y-4 p-5" pattern="app-yellow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle icon="icon-diy">练习详情</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="default" size="small" disabled={working} onClick={() => onSaveCase({ caseId: selectedCase.id, ...caseForm, trainingFocus: caseForm.trainingFocus || null })}>保存</Button>
                  <Button type="default" size="small" disabled={working} onClick={() => onDeleteCase(selectedCase.id)} className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]">删除</Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="标题" value={caseForm.title} onChange={(title) => setCaseForm((current) => ({ ...current, title }))} />
                <label className="admin-select-below flex flex-col gap-1"><span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span><AdminSelect ariaLabel="多轮练习场景" value={caseForm.scene} onChange={(scene) => setCaseForm((current) => ({ ...current, scene }))} options={sceneOptions()} /></label>
              </div>
              <EditField label="情景介绍" value={caseForm.rootContextText} onChange={(rootContextText) => setCaseForm((current) => ({ ...current, rootContextText }))} rows={3} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="训练重点" value={caseForm.trainingFocus} onChange={(trainingFocus) => setCaseForm((current) => ({ ...current, trainingFocus }))} />
                <SelectField label="状态" value={caseForm.status} onChange={(status) => setCaseForm((current) => ({ ...current, status: status as "draft" | "active" | "archived" }))} options={[{ key: "draft", label: "草稿" }, { key: "active", label: "进行中" }, { key: "archived", label: "已归档" }]} />
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
              <Card className="space-y-4 p-5" pattern="none">
                <div className="flex items-center justify-between gap-3"><SectionTitle icon="icon-chat">当前对话路径</SectionTitle><span className="text-xs font-semibold text-[var(--ls-ink-muted)]">{pathTurns.length} 轮</span></div>
                <DetailReadBlock label="情景介绍" value={selectedCase.rootContextText} icon="icon-map" tone="admin-chip-mint" />
                <div className="space-y-4">
                  {pathTurns.map((turn) => (
                    <div key={turn.id} className="space-y-2">
                      <div className="flex justify-start"><button type="button" onClick={() => selectOtherTurn(turn)} className={`max-w-[82%] rounded-lg border-2 px-4 py-3 text-left text-sm font-semibold leading-6 ${turn.id === selectedTurn?.id && detailMode === "branches" ? "border-[var(--ls-mint)] bg-[var(--ls-mint-soft)]" : "border-[var(--ls-border)] bg-[var(--ls-panel-soft)]"}`}>{turn.userText}</button></div>
                      <div className="flex justify-end"><button type="button" onClick={() => selectSiyuanTurn(turn)} className={`max-w-[82%] rounded-lg border-2 px-4 py-3 text-left text-sm font-semibold leading-6 ${turn.id === selectedTurn?.id && detailMode === "reply" ? "border-[var(--ls-yellow)] bg-[var(--ls-yellow-soft)]" : "border-[var(--ls-border)] bg-white"}`}>{turn.outcome === "skipped" ? "不回复" : turn.finalText || turn.draftText || "点击编辑思源回复"}</button></div>
                    </div>
                  ))}
                  {pathTurns.length === 0 && <div className="admin-island-soft-panel px-4 py-8 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">从下面添加第一条对方消息开始。</div>}
                </div>
                <div className="border-t-2 border-dashed border-[var(--ls-border)] pt-4"><Button type="default" size="middle" onClick={() => { setBranchParentTurnId(selectedTurn?.id ?? null); setAddingBranch(true); setDetailMode("branches"); }} disabled={working}>添加一条对话</Button></div>
              </Card>

              {detailMode === "branches" ? (
                <Card className="space-y-4 p-5" pattern="app-green">
                  <div><SectionTitle icon="icon-chat">对方的可能回复</SectionTitle><p className="mt-2 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">选择一条回复后，左侧会切换到该分支的后续。</p></div>
                  <div className="space-y-2">
                    {branchChoices.map((turn) => <button key={turn.id} type="button" onClick={() => { onSelectTurn(turn.id); setBranchParentTurnId(turn.parentTurnId ?? null); setAddingBranch(false); setDetailMode("reply"); }} className={`admin-island-row block w-full px-4 py-3 text-left ${turn.id === selectedTurn?.id ? "is-active" : ""}`}><div className="text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">{turn.userText}</div></button>)}
                    {branchChoices.length === 0 && !addingBranch && <div className="admin-island-soft-panel px-4 py-6 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">这里还没有后续回复。</div>}
                  </div>
                  {addingBranch ? <><EditField label="新增一种回复" value={newBranchText} onChange={setNewBranchText} rows={4} /><div className="flex justify-end gap-2"><Button type="default" size="middle" onClick={() => setAddingBranch(false)}>取消</Button><Button type="primary" size="middle" disabled={working || !newBranchText.trim()} onClick={addBranch}>确定</Button></div></> : <Button type="default" size="middle" onClick={() => setAddingBranch(true)}>新增一种回复</Button>}
                </Card>
              ) : selectedTurn ? (
                <Card className="space-y-4 p-5" pattern="app-green">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><SectionTitle icon="icon-design">思源回复</SectionTitle><p className="mt-2 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">对方：{selectedTurn.userText}</p></div><Button type="default" size="small" disabled={working} onClick={() => onDeleteTurn(selectedTurn.id)} className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]">删除这条对话</Button></div>
                  <EditField label="陆思源试答" value={turnForm.draftText} onChange={(draftText) => updateTurn("draftText", draftText)} rows={4} action={<Button type="default" size="small" disabled={drafting} loading={drafting} onClick={() => void generateDraft()}>{drafting ? "试答中" : "让思源试答"}</Button>} />
                  {turnForm.draftReason && <DetailReadBlock label="试答原因" value={turnForm.draftReason} icon="icon-map" tone="admin-chip-mint" />}
                  <EditField label="我希望的回复" value={turnForm.finalText} onChange={(finalText) => updateTurn("finalText", finalText)} rows={4} />
                  <EditField label="补充说明" value={turnForm.ownerNote} onChange={(ownerNote) => updateTurn("ownerNote", ownerNote)} rows={3} />
                  <div className="flex flex-wrap justify-end gap-2"><Button type="default" size="middle" disabled={working} onClick={() => { updateTurn("outcome", "skipped"); updateTurn("finalText", ""); }}>不回复</Button><Button type="primary" size="middle" disabled={working || !canAnalyze} loading={working} onClick={() => void analyze()}>分析</Button></div>
                  {analysisForm && <AnalysisResultEditor value={analysisForm} onChange={setAnalysisForm} working={working} onSave={() => saveExample("disabled")} hideSave />}
                  {analysisForm && <div className="flex flex-wrap justify-end gap-2"><Button type="default" size="middle" disabled={working || !canSaveExample} loading={working} onClick={() => saveExample("disabled")}>保存经验</Button><Button type="primary" size="middle" disabled={working || !canSaveExample} loading={working} onClick={() => saveExample("active")}>保存并启用经验</Button></div>}
                </Card>
              ) : (
                <Card className="p-5" pattern="none"><div className="admin-island-soft-panel px-4 py-8 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">点击左侧消息查看分支，或添加第一条对话。</div></Card>
              )}
            </div>
          </div>
        ) : <Card className="p-5" pattern="none"><div className="admin-island-soft-panel px-4 py-10 text-center text-sm font-semibold text-[var(--ls-ink-muted)]">从左侧选择一个练习查看详情。</div></Card>}
      </section>
    </div>
  );
}

function ExerciseWorkspacePanel({
  teachingRevision,
  onStartNew,
  ...libraryProps
}: {
  teachingRevision: number;
  onStartNew: () => void;
  records: ExpressionLearningTrainingRecord[];
  working: boolean;
  drafting: boolean;
  onEdit: (record: ExpressionLearningTrainingRecord) => void;
  createdFrom: string;
  createdTo: string;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onClearDateFilter: () => void;
  onCreate: (input: Omit<ExpressionLearningCreateInput, "token">) => void;
  onAnalyze: (input: Omit<ExpressionLearningCreateInput, "token">) => Promise<ExpressionLearningAnalysis | null>;
  onGenerateQuestion: (input: { scene: string; focus?: string | null }) => Promise<ExpressionLearningPracticeQuestionResponse | null>;
  onGenerateDraft: (input: { scene: string; contextText: string }) => Promise<{ draftText: string; draftReason: string; trainingRecordId: string | null } | null>;
  onSaveDraft: (input: Omit<ExpressionLearningTrainingDraftInput, "token">) => Promise<ExpressionLearningTrainingRecord | null>;
  onAcceptTeachingDraft: (input: {
    recordId: string;
    status?: "active" | "disabled";
    ownerNote?: string | null;
  }) => void;
  onDeleteExercise: (recordId: string) => void;
  onSetExerciseEnabled: (exampleId: string, enabled: boolean) => void;
  editSeed: TeachingSeed | null;
}) {
  const {
    drafting,
    onCreate,
    onAnalyze,
    onGenerateQuestion,
    onGenerateDraft,
    onSaveDraft,
    onAcceptTeachingDraft,
    onDeleteExercise,
    onSetExerciseEnabled,
    editSeed,
    ...exerciseLibraryProps
  } = libraryProps;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)] xl:items-start">
      <ExerciseLibraryPanel
        {...exerciseLibraryProps}
        onStartNew={onStartNew}
      />
      <ManualTeachingPanel
        key={editSeed?.revision ?? teachingRevision}
        working={exerciseLibraryProps.working}
        drafting={drafting}
        onCreate={onCreate}
        onAnalyze={onAnalyze}
        onGenerateQuestion={onGenerateQuestion}
        onGenerateDraft={onGenerateDraft}
        onSaveDraft={onSaveDraft}
        onAcceptDraft={onAcceptTeachingDraft}
        onDeleteExercise={onDeleteExercise}
        onSetExerciseEnabled={onSetExerciseEnabled}
        editSeed={editSeed}
      />
    </section>
  );
}

function ExerciseLibraryPanel({
  records,
  working,
  onEdit,
  onStartNew,
  createdFrom,
  createdTo,
  onCreatedFromChange,
  onCreatedToChange,
  onClearDateFilter,
}: {
  records: ExpressionLearningTrainingRecord[];
  working: boolean;
  onEdit: (record: ExpressionLearningTrainingRecord) => void;
  onStartNew: () => void;
  createdFrom: string;
  createdTo: string;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onClearDateFilter: () => void;
}) {
  const [scene, setScene] = useState("all");
  const sceneValues = records.map((record) => record.scene);
  const filteredRecords = scene === "all"
    ? records
    : records.filter((record) => record.scene === scene);

  return (
    <Card className="space-y-4 p-5" pattern="app-blue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
            Exercise Library
          </div>
          <h3 className="mt-2 text-2xl font-black text-[var(--ls-ink-strong)]">习题库</h3>
          <p className="mt-2 text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            系统出的题和你保存过的手写题都会在这里。未完成题可以继续编辑，保存经验后状态跟随经验启用/停用。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="admin-chip admin-chip-mint">{records.length} 道题</span>
          <Button type="primary" size="small" onClick={onStartNew} disabled={working}>
            新建习题
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,16rem)_minmax(10rem,14rem)_minmax(10rem,14rem)_auto] lg:items-end">
        <label className="admin-select-below flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span>
          <AdminSelect
            ariaLabel="习题库场景"
            value={scene}
            onChange={setScene}
            options={sceneFilterOptions(sceneValues)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">出题开始</span>
          <Input
            type="date"
            value={createdFrom}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onCreatedFromChange(event.target.value)}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">出题结束</span>
          <Input
            type="date"
            value={createdTo}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onCreatedToChange(event.target.value)}
            className="h-10"
          />
        </label>
        <Button
          type="default"
          size="middle"
          onClick={onClearDateFilter}
          disabled={!createdFrom && !createdTo}
        >
          清除时间
        </Button>
      </div>

      <div className="space-y-2">
        {filteredRecords.map((record) => (
          <ExerciseRow
            key={record.id}
            record={record}
            onEdit={() => onEdit(record)}
          />
        ))}

        {records.length === 0 && (
          <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            还没有习题。右侧点“系统出题”或直接填写情境，就能开始第一道题。
          </div>
        )}

        {records.length > 0 && filteredRecords.length === 0 && (
          <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            当前场景下还没有习题。
          </div>
        )}
      </div>
    </Card>
  );
}

function ExerciseRow({
  record,
  onEdit,
}: {
  record: ExpressionLearningTrainingRecord;
  onEdit: () => void;
}) {
  const status = exerciseStatus(record);
  return (
    <button type="button" onClick={onEdit} className="admin-island-row block w-full px-4 py-3.5 text-left">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="admin-chip admin-chip-yellow">{sceneLabel(record.scene)}</span>
          <StatusPill active={status.active} label={status.label} />
          <span className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">
            出题 {formatTime(record.createdAt)}
          </span>
          {record.updatedAt !== record.createdAt && (
            <span className="text-[11px] font-semibold text-[var(--ls-ink-faint)]">
              更新 {formatTime(record.updatedAt)}
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">
          {exerciseQuestionText(record)}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">
          <span>表达场景</span>
          {record.finalText && <><span className="text-[var(--ls-3d-shadow)]">·</span><span>已有你的回复</span></>}
          {analysisFromTrainingRecord(record) && <><span className="text-[var(--ls-3d-shadow)]">·</span><span>已分析</span></>}
        </div>
      </div>
    </button>
  );
}

function ScopeHelp() {
  return (
    <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 text-xs font-semibold leading-6 text-[var(--ls-ink-muted)] md:grid-cols-3">
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">通用</span>
        <p className="mt-1">`general` 适合跨场景都能参考的表达经验。</p>
      </div>
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">聊天</span>
        <p className="mt-1">`chat` 适合私聊、Web Chat、微信、Telegram 这类对话。</p>
      </div>
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">回复评论</span>
        <p className="mt-1">`reply` 适合小红书、B 站等公开评论回复。</p>
      </div>
    </div>
  );
}

type TeachingForm = {
  scene: string;
  contextText: string;
  draftText: string;
  finalText: string;
  outcome: "sent" | "skipped" | "bad_question";
  ownerNote: string;
  status: "active" | "disabled";
};

const defaultTeachingForm: TeachingForm = {
  scene: "general",
  contextText: "",
  draftText: "",
  finalText: "",
  outcome: "sent",
  ownerNote: "",
  status: "active",
};

type AnalysisEditForm = {
  lesson: string;
  reasoning: string;
  strategy: string;
  tone: string;
  avoidancesText: string;
  tagsText: string;
  confidence: number;
};

function listToText(value: string[]) {
  return value.join("\n");
}

function textToList(value: string) {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function analysisToEditForm(analysis: ExpressionLearningAnalysis): AnalysisEditForm {
  return {
    lesson: analysis.lesson,
    reasoning: analysis.reasoning,
    strategy: analysis.strategy,
    tone: analysis.tone,
    avoidancesText: listToText(analysis.avoidances),
    tagsText: listToText(analysis.tags),
    confidence: analysis.confidence,
  };
}

function editFormToAnalysis(form: AnalysisEditForm): ExpressionLearningAnalysis {
  return {
    lesson: form.lesson,
    reasoning: form.reasoning,
    strategy: form.strategy,
    tone: form.tone,
    avoidances: textToList(form.avoidancesText),
    tags: textToList(form.tagsText),
    confidence: form.confidence,
  };
}

function ManualTeachingPanel({
  working,
  drafting,
  onCreate,
  onAnalyze,
  onGenerateQuestion,
  onGenerateDraft,
  onSaveDraft,
  onAcceptDraft,
  onDeleteExercise,
  onSetExerciseEnabled,
  editSeed,
}: {
  working: boolean;
  drafting: boolean;
  onCreate: (input: Omit<ExpressionLearningCreateInput, "token">) => void;
  onAnalyze: (input: Omit<ExpressionLearningCreateInput, "token">) => Promise<ExpressionLearningAnalysis | null>;
  onGenerateQuestion: (input: {
    scene: string;
    focus?: string | null;
  }) => Promise<ExpressionLearningPracticeQuestionResponse | null>;
  onGenerateDraft: (input: {
    scene: string;
    contextText: string;
  }) => Promise<{ draftText: string; draftReason: string; trainingRecordId: string | null } | null>;
  onSaveDraft: (
    input: Omit<ExpressionLearningTrainingDraftInput, "token">
  ) => Promise<ExpressionLearningTrainingRecord | null>;
  onAcceptDraft: (input: {
    recordId: string;
    status?: "active" | "disabled";
    ownerNote?: string | null;
  }) => void;
  onDeleteExercise: (recordId: string) => void;
  onSetExerciseEnabled: (exampleId: string, enabled: boolean) => void;
  editSeed: TeachingSeed | null;
}) {
  const [form, setForm] = useState<Omit<TeachingForm, "scene" | "status">>({
    contextText: "",
    draftText: "",
    finalText: "",
    outcome: "sent",
    ownerNote: "",
  });
  const [focus, setFocus] = useState("");
  const [trainingRecordId, setTrainingRecordId] = useState<string | null>(null);
  const [generatedQuestion, setGeneratedQuestion] = useState<ExpressionLearningPracticeQuestion | null>(null);
  const [draftReason, setDraftReason] = useState("");
  const [analysisForm, setAnalysisForm] = useState<AnalysisEditForm | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [libForm] = Form.useForm<Pick<TeachingForm, "scene" | "status">>();

  useEffect(() => {
    if (!editSeed) return;
    const record = editSeed.record;
    const question = questionFromTrainingRecord(record);
    const analysis = analysisFromTrainingRecord(record);
    libForm.setFieldsValue({
      scene: record.scene || defaultTeachingForm.scene,
      status: record.example?.status === "disabled" ? "disabled" : defaultTeachingForm.status,
    });
    setTrainingRecordId(record.id);
    setGeneratedQuestion(question);
    setDraftReason(recordString(record.generatedDraft, "reason"));
    setForm({
      contextText: record.contextText ?? question?.contextText ?? "",
      draftText: record.draftText ?? question?.draftText ?? "",
      finalText: record.finalText ?? "",
      outcome: record.status === "dismissed"
        ? "bad_question"
        : record.outcome === "skipped"
          ? "skipped"
          : "sent",
      ownerNote: record.ownerNote ?? record.reasonText ?? "",
    });
    setAnalysisForm(analysis ? analysisToEditForm(analysis) : null);
    setLocalMessage("已从习题库回填，可以继续编辑。");
  }, [editSeed, libForm]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "draftText") setDraftReason("");
    setAnalysisForm(null);
    setLocalMessage(null);
  }

  function patchForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    if (patch.draftText !== undefined) setDraftReason("");
    setAnalysisForm(null);
    setLocalMessage(null);
  }

  function currentGrid() {
    const grid = libForm.getFieldsValue();
    return {
      scene: grid.scene ?? defaultTeachingForm.scene,
      status: grid.status ?? defaultTeachingForm.status,
    };
  }

  function buildInput(analysis?: ExpressionLearningAnalysis): Omit<ExpressionLearningCreateInput, "token"> {
    const grid = currentGrid();
    const outcome = form.outcome === "skipped" ? "skipped" : "sent";
    return {
      trainingRecordId,
      sourceType: generatedQuestion ? "practice_answer" : "manual_teaching",
      scene: grid.scene,
      contextText: form.contextText,
      draftText: form.draftText || null,
      finalText: outcome === "skipped" ? null : form.finalText,
      outcome,
      ownerAction: outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: form.ownerNote || null,
      status: grid.status,
      analysis,
      metadata: generatedQuestion
        ? { tags: generatedQuestion.tags, teachingFocus: generatedQuestion.teachingFocus }
        : undefined,
    };
  }

  function buildTrainingDraftInput(
    analysis?: ExpressionLearningAnalysis | null
  ): Omit<ExpressionLearningTrainingDraftInput, "token"> {
    const grid = currentGrid();
    const isBadQuestion = form.outcome === "bad_question";
    const outcome: "sent" | "skipped" | null = form.outcome === "sent"
      ? "sent"
      : form.outcome === "skipped"
        ? "skipped"
        : null;
    return {
      recordId: trainingRecordId,
      sourceType: generatedQuestion ? "practice_question" : "manual_teaching",
      scene: grid.scene,
      status: "draft_saved",
      contextText: form.contextText,
      draftText: form.draftText || null,
      finalText: outcome === "sent" ? form.finalText : null,
      outcome,
      ownerAction: isBadQuestion ? null : outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: form.ownerNote || null,
      reasonText: form.ownerNote || null,
      generatedQuestion: generatedQuestion
        ? {
            ...generatedQuestion,
            contextText: form.contextText,
            draftText: form.draftText || null,
          }
        : undefined,
      generatedDraft: form.draftText
        ? { draftText: form.draftText, reason: draftReason || null }
        : undefined,
      analysisSnapshot: analysis ?? (analysisForm ? editFormToAnalysis(analysisForm) : undefined),
    };
  }

  async function saveDraft(
    analysis?: ExpressionLearningAnalysis | null,
    message = "草稿已保存到习题库。"
  ): Promise<ExpressionLearningTrainingRecord | null> {
    const record = await onSaveDraft(buildTrainingDraftInput(analysis));
    if (record) {
      setTrainingRecordId(record.id);
      setLocalMessage(message);
    }
    return record;
  }

  function acceptCurrentDraft() {
    if (!trainingRecordId) return;
    onAcceptDraft({
      recordId: trainingRecordId,
      status: currentGrid().status,
      ownerNote: form.ownerNote || null,
    });
  }

  function submit() {
    if (!analysisForm) return;
    onCreate(buildInput(editFormToAnalysis(analysisForm)));
  }

  async function generateDraft() {
    const grid = currentGrid();
    const result = await onGenerateDraft({
      scene: grid.scene,
      contextText: form.contextText,
    });
    if (result?.draftText) {
      update("draftText", result.draftText);
      setDraftReason(result.draftReason);
      if (!trainingRecordId) {
        setTrainingRecordId(result.trainingRecordId);
      }
    }
  }

  async function generateQuestion() {
    const grid = currentGrid();
    const result = await onGenerateQuestion({
      scene: grid.scene,
      focus: focus || null,
    });
    if (!result) return;
    setGeneratedQuestion(result.question);
    setDraftReason("");
    setTrainingRecordId(result.trainingRecord.id);
    patchForm({
      contextText: result.question.contextText,
      draftText: result.trainingRecord.draftText ?? result.question.draftText ?? "",
      finalText: "",
      ownerNote: "",
      outcome: "sent",
    });
    setLocalMessage("题目已生成，可以修改题目，也可以让思源重新试答。");
  }

  async function analyzeCurrent() {
    if (form.outcome === "bad_question") {
      await saveDraft(null, "已保存为草稿中，不会进入经验库。你可以在习题库继续编辑或删除。");
      setAnalysisForm(null);
      return;
    }
    const analysis = await onAnalyze(buildInput());
    if (analysis) {
      setAnalysisForm(analysisToEditForm(analysis));
      await saveDraft(analysis, "分析完成，习题已更新为草稿中。可以先修改下面的经验草稿，再保存。");
    }
  }

  const teachingSceneOptions = sceneOptions(editSeed?.record.scene ? [editSeed.record.scene] : []);
  const canAcceptCurrentDraft = Boolean(trainingRecordId && form.contextText.trim() && form.draftText.trim());
  const canSaveCurrentDraft = Boolean(form.contextText.trim());
  const linkedExample = editSeed?.record.example ?? null;
  const isExerciseEnabled = linkedExample?.status === "active";

  return (
    <Card className="admin-select-host space-y-5 p-5" pattern="app-yellow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
            Exercise Detail
          </div>
          <h3 className="mt-2 text-2xl font-black text-[var(--ls-ink-strong)]">
            {editSeed ? "习题详情" : "新建习题"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            可以让系统出题，也可以自己写题；先决定该不该回复，再分析成经验，最后确认保存。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editSeed && (
            <Button
              type="default"
              size="small"
              disabled={working}
              onClick={() => onDeleteExercise(editSeed.record.id)}
              className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]"
            >
              删除
            </Button>
          )}
          <Button
            type="default"
            size="small"
            disabled={working || !canSaveCurrentDraft}
            loading={working}
            onClick={() => void saveDraft(null)}
          >
            保存草稿
          </Button>
          {linkedExample && (
            <span className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${
              isExerciseEnabled
                ? "border-[var(--ls-success-border-light)] bg-[var(--ls-success-bg)] text-[var(--ls-success-text)]"
                : "border-[var(--ls-border)] bg-white text-[var(--ls-ink-soft)]"
            }`}>
              <span>{isExerciseEnabled ? "已启用" : "已停用"}</span>
              <Switch
                checked={isExerciseEnabled}
                disabled={working}
                onChange={(enabled: boolean) => onSetExerciseEnabled(linkedExample.id, enabled)}
                aria-label="启用这道习题对应的表达经验"
              />
            </span>
          )}
        </div>
      </div>

      <ScopeHelp />

      <Form
        form={libForm}
        layout="vertical"
        initialValues={{
          scene: defaultTeachingForm.scene,
          status: defaultTeachingForm.status,
        }}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Form.Item name="scene" label="场景">
            <AdminSelect
              ariaLabel="场景"
              options={teachingSceneOptions}
            />
          </Form.Item>
          <Form.Item name="status" label="保存状态">
            <AdminSelect
              ariaLabel="保存状态"
              options={[
                { key: "active", label: "保存后启用" },
                { key: "disabled", label: "保存后暂不启用" },
              ]}
            />
          </Form.Item>
        </div>
      </Form>

      <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <TextField
          label="出题方向（可选）"
          value={focus}
          onChange={setFocus}
          placeholder="比如：拒绝、安抚、评论区回复、朋友开玩笑"
        />
        <Button
          type="primary"
          size="middle"
          onClick={generateQuestion}
          disabled={working}
          loading={working}
          icon={<Icon name="icon-camera" size={18} />}
        >
          系统出题
        </Button>
      </div>

      {generatedQuestion && (
        <DetailReadBlock
          label="这题想训练什么"
          value={`${generatedQuestion.teachingFocus}\n\n${generatedQuestion.expectedOwnerInput}`}
          icon="icon-map"
          tone="admin-chip-mint"
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EditField label="出题 / 情境" value={form.contextText} onChange={(value) => update("contextText", value)} rows={8} />
        <EditField
          label="陆思源试答（可选）"
          value={form.draftText}
          onChange={(value) => update("draftText", value)}
          rows={8}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                type="default"
                size="small"
                onClick={generateDraft}
                disabled={drafting || !form.contextText.trim()}
                loading={drafting}
              >
                {drafting ? "试答中" : "让思源试答"}
              </Button>
              <Button
                type="primary"
                size="small"
                onClick={acceptCurrentDraft}
                disabled={working || !canAcceptCurrentDraft}
                loading={working}
              >
                采用试答并保存
              </Button>
            </div>
          }
        />
      </div>

      {draftReason && (
        <DetailReadBlock
          label="陆思源试答原因"
          value={draftReason}
          icon="icon-map"
          tone="admin-chip-mint"
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SelectField
          label="最终决定"
          value={form.outcome}
          onChange={(value) => update("outcome", value as TeachingForm["outcome"])}
          options={[
            { key: "sent", label: "应该这样回复" },
            { key: "skipped", label: "不回复" },
            { key: "bad_question", label: "这题不好" },
          ]}
        />
        {form.outcome === "sent" ? (
          <EditField
            label="我希望的回复"
            value={form.finalText}
            onChange={(value) => update("finalText", value)}
            rows={5}
          />
        ) : (
          <div className="rounded-[18px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            {form.outcome === "bad_question"
              ? "这题会被记录为坏题，不会生成经验。"
              : "不回复也可以成为经验，后面用补充说明解释原因。"}
          </div>
        )}
      </div>

      <EditField
        label={form.outcome === "bad_question" ? "补充说明：为什么这题不好" : "补充说明（可选）"}
        value={form.ownerNote}
        onChange={(value) => update("ownerNote", value)}
        rows={3}
      />

      {localMessage && (
        <div className="rounded-[18px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">
          {localMessage}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="primary"
          size="middle"
          onClick={analyzeCurrent}
          disabled={working || !form.contextText.trim() || (form.outcome === "sent" && !form.finalText.trim())}
          loading={working}
          icon={<Icon name={form.outcome === "bad_question" ? "icon-variant" : "icon-diy"} size={18} />}
        >
          {form.outcome === "bad_question" ? "记录这题不好" : "分析"}
        </Button>
      </div>

      {analysisForm && (
        <AnalysisResultEditor
          value={analysisForm}
          onChange={setAnalysisForm}
          working={working}
          onSave={submit}
        />
      )}
    </Card>
  );
}

function AnalysisResultEditor({
  value,
  onChange,
  working,
  onSave,
  saveLabel = "保存经验",
  hideSave = false,
}: {
  value: AnalysisEditForm;
  onChange: (value: AnalysisEditForm) => void;
  working: boolean;
  onSave: () => void;
  saveLabel?: string;
  hideSave?: boolean;
}) {
  function update<K extends keyof AnalysisEditForm>(key: K, next: AnalysisEditForm[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-4 rounded-[22px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle icon="icon-critterpedia">分析结果</SectionTitle>
        <span className="ml-auto text-[11px] font-semibold text-[var(--ls-ink-muted)]">
          可信度 {Math.round(value.confidence * 100)}%
        </span>
      </div>
      <div className="grid gap-3">
        <EditField label="学到的经验" value={value.lesson} onChange={(next) => update("lesson", next)} rows={3} />
        <div className="grid gap-3 md:grid-cols-2">
          <EditField label="分析理由" value={value.reasoning} onChange={(next) => update("reasoning", next)} rows={4} />
          <EditField label="以后采用的策略" value={value.strategy} onChange={(next) => update("strategy", next)} rows={4} />
        </div>
        <EditField label="语气" value={value.tone} onChange={(next) => update("tone", next)} rows={2} />
        <div className="grid gap-3 md:grid-cols-2">
          <EditField label="应该避免" value={value.avoidancesText} onChange={(next) => update("avoidancesText", next)} rows={3} />
          <EditField label="检索标签" value={value.tagsText} onChange={(next) => update("tagsText", next)} rows={3} />
        </div>
      </div>
      {!hideSave && (
        <div className="flex justify-end">
          <Button
            type="primary"
            size="middle"
            onClick={onSave}
            disabled={working || !value.lesson.trim()}
            loading={working}
            icon={<Icon name="icon-diy" size={18} />}
          >
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input h-10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ key: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <AdminSelect ariaLabel={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  icon: IconName;
  tone: CardColor;
  accent: string;
  onClick?: () => void;
}) {
  const content = (
    <Card className="admin-learning-metric flex items-start gap-3 p-4 md:p-5" pattern={tone}>
      <span className="admin-learning-metric-icon">
        <Icon name={icon} size={22} bounce />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">{label}</span>
        <span className="mt-1 block text-3xl font-black leading-none text-[var(--ls-ink-strong)]">{value}</span>
        <span className="mt-2 block text-[11px] font-semibold leading-5 text-[var(--ls-ink-muted)]">{accent}</span>
      </span>
    </Card>
  );
  return onClick ? (
    <button type="button" className="block w-full text-left" onClick={onClick}>
      {content}
    </button>
  ) : content;
}

function ExampleRow({
  example,
  active,
  onSelect,
}: {
  example: ExpressionLearningExample;
  active: boolean;
  onSelect: () => void;
}) {
  const confidence = Math.round(example.confidence * 100);
  const tone = example.outcome === "skipped" ? "admin-chip-pink" : "admin-chip-mint";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`admin-island-row admin-learning-row block w-full px-4 py-3.5 text-left transition ${
        active ? "is-active" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`admin-chip ${tone} shrink-0`}>
          {sceneLabel(example.scene)}
        </span>
        <StatusPill
          active={example.status === "active"}
          label={statusLabel(example.status)}
        />
        <span className="admin-chip admin-chip-yellow">{distillationLabel(example)}</span>
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-[var(--ls-ink-soft)] tabular-nums">
          {formatTime(example.updatedAt)}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">
        {example.lesson}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Icon name="icon-chat" size={12} />
          {actionLabel(example.ownerAction)}
        </span>
        <span className="text-[var(--ls-3d-shadow)]">·</span>
        <span className="whitespace-nowrap">使用 {example.accessCount} 次</span>
        <span className="text-[var(--ls-3d-shadow)]">·</span>
        <span className="whitespace-nowrap">可信度 {confidence}%</span>
      </div>      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ls-panel)]">
        <div
          className="admin-learning-confidence h-full rounded-full"
          style={{ width: `${confidence}%` }}
        />
      </div>
    </button>
  );
}

function ExpressionDetail({
  example,
  working,
  onSave,
  onDelete,
  onReanalyze,
  onDistill,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  onSave: (patch: ExpressionLearningPatch) => void;
  onDelete: () => void;
  onReanalyze: () => void;
  onDistill: () => void;
}) {
  const [lesson, setLesson] = useState(example.lesson);
  const [reasoning, setReasoning] = useState(example.reasoning ?? "");
  const [strategy, setStrategy] = useState(example.strategy ?? "");
  const [tone, setTone] = useState(example.tone ?? "");
  const avoidances = textList(example.avoidances);
  const tags = textList(example.tags);

  const isSkipped = example.outcome === "skipped";
  const confidence = Math.round(example.confidence * 100);

  return (
    <Card className="admin-learning-detail space-y-5 p-5" pattern="app-yellow">
      <DetailHeader
        example={example}
        working={working}
        confidence={confidence}
        onSave={onSave}
        onDelete={onDelete}
        onReanalyze={onReanalyze}
      />

      <DetailReadBlock
        label="当时情境"
        value={example.contextText}
        icon="icon-chat"
        tone="admin-chip-mint"
      />
      {example.draftText && (
        <DetailReadBlock
          label="思源原草稿"
          value={example.draftText}
          icon="icon-design"
          tone="admin-chip-yellow"
        />
      )}
      <DetailReadBlock
        label={isSkipped ? "你的最终决定" : "你最终发布的回复"}
        value={isSkipped ? "不回复" : example.finalText ?? ""}
        icon={isSkipped ? "icon-variant" : "icon-miles"}
        tone={isSkipped ? "admin-chip-pink" : "admin-chip-mint"}
      />
      <div>
        <div className="mb-3 flex items-center gap-3">
          <SectionTitle icon="icon-diy">编辑这条经验</SectionTitle>
          <span className="h-px flex-1 bg-[var(--ls-border)]" />
          <span className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">修改后保存</span>
        </div>
        <div className="grid gap-3">
          <EditField label="学到的经验" value={lesson} onChange={setLesson} rows={3} />
          <div className="grid gap-3 md:grid-cols-2">
            <EditField label="分析理由" value={reasoning} onChange={setReasoning} rows={4} />
            <EditField label="以后采用的策略" value={strategy} onChange={setStrategy} rows={4} />
          </div>
          <EditField label="语气" value={tone} onChange={setTone} rows={2} />
        </div>
      </div>

      {(tags.length > 0 || avoidances.length > 0) && (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <SectionTitle icon="icon-map">检索与避雷</SectionTitle>
            <span className="h-px flex-1 bg-[var(--ls-border)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tags.length > 0 && (
              <TagBlock label="检索标签" values={tags} tone="admin-chip-mint" />
            )}
            {avoidances.length > 0 && (
              <TagBlock label="应该避免" values={avoidances} tone="admin-chip-pink" />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t-2 border-dashed border-[var(--ls-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <EmbeddingHint status={example.embeddingStatus} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="default" size="middle" onClick={onDistill} disabled={working}>
            提炼为规则
          </Button>
          <Button
            type="primary"
            size="middle"
            onClick={() => onSave({ lesson, reasoning, strategy, tone })}
            disabled={working || !lesson.trim()}
            loading={working}
            icon={<Icon name="icon-diy" size={18} />}
          >
            保存修正
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DetailHeader({
  example,
  working,
  confidence,
  onSave,
  onDelete,
  onReanalyze,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  confidence: number;
  onSave: (patch: ExpressionLearningPatch) => void;
  onDelete: () => void;
  onReanalyze: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b-2 border-dashed border-[var(--ls-border)] pb-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--ls-ink-muted)]">
          <span className="admin-chip admin-chip-yellow">{sceneLabel(example.scene)}</span>
        </div>
        <h3 className="mt-2 text-2xl font-black leading-tight text-[var(--ls-ink-strong)]">
          {actionLabel(example.ownerAction)}
        </h3>
        <p className="mt-1 text-xs font-semibold text-[var(--ls-ink-muted)]">
          {outcomeLabel(example.outcome)} · 使用过 {example.accessCount} 次 · 可信度 {confidence}%
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="default"
          size="small"
          onClick={onDelete}
          disabled={working}
          className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]"
        >
          删除经验
        </Button>
        <span className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${
          example.status === "active"
            ? "border-[var(--ls-success-border-light)] bg-[var(--ls-success-bg)] text-[var(--ls-success-text)]"
            : "border-[var(--ls-border)] bg-white text-[var(--ls-ink-soft)]"
        }`}>
          <span>{example.status === "active" ? "已启用" : "已停用"}</span>
          <Switch
            checked={example.status === "active"}
            disabled={working}
            onChange={(enabled: boolean) => onSave({ status: enabled ? "active" : "disabled" })}
            aria-label="启用这条表达经验"
          />
        </span>
        <Button
          type="primary"
          size="small"
          onClick={onReanalyze}
          disabled={working}
          icon={<Icon name="icon-variant" size={16} />}
        >
          {working ? "处理中" : "重新分析"}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
      <Icon name={icon} size={14} />
      {children}
    </div>
  );
}

function DetailReadBlock({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone: "admin-chip-mint" | "admin-chip-yellow" | "admin-chip-pink";
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`admin-chip ${tone}`}>
          <Icon name={icon} size={12} />
          {label}
        </span>
      </div>
      <div className="mt-2 whitespace-pre-wrap rounded-[18px] border-2 border-[var(--ls-border)] border-l-[6px] border-l-[var(--ls-mint-light)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-7 text-[var(--ls-ink)]">
        {value}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ls-ink-soft)]">
        <span>{label}</span>
        {action}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="field-input resize-y text-sm leading-6"
      />
    </div>
  );
}

function TagBlock({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: "admin-chip-mint" | "admin-chip-pink";
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className={`admin-chip ${tone}`}>{value}</span>
        ))}
      </div>
    </div>
  );
}

function EmbeddingHint({ status }: { status: string }) {
  const ready = status === "ready";
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ls-ink-muted)]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          ready ? "bg-[var(--ls-mint)]" : "bg-[var(--ls-yellow)]"
        }`}
      />
      向量索引：{ready ? "可用" : status}
    </div>
  );
}
