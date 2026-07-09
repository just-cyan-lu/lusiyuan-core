import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Button, Icon, Tag } from "animal-island-ui";
import { AdminInput, AdminSelect } from "./AdminFormPrimitives";
import {
  applyRelationshipReviewProposal,
  approveIdentityLinkProposal,
  fetchIdentityLinkProposals,
  fetchRelationshipDetail,
  fetchRelationships,
  mergeRelationshipIdentities,
  rejectIdentityLinkProposal,
  rejectRelationshipReviewProposal,
  resetRelationshipState,
  splitRelationshipIdentity,
  updateRelationshipIdentityLabel,
  updateRelationshipUserDisplayName,
  updateRelationshipState,
  type IdentityLinkProposal,
  type RelationshipReviewProposal,
  type RelationshipState,
  type RelationshipStateEvent,
} from "../../api/lusiyuan-api";
import { StateChangeDetail } from "./StateChangeDetail";

interface RelationshipStatePageProps {
  adminToken: string;
  selectedRelationshipId?: string;
  onOpenRelationship?: (relationshipId: string) => void;
  onBackToRelationshipList?: () => void;
  onOpenConversationPerson?: (personId: string) => void;
  onOpenMemoryPerson?: (personId: string) => void;
}

interface PageState {
  relationships: RelationshipState[];
  proposals: IdentityLinkProposal[];
  reviewProposals: RelationshipReviewProposal[];
  selected: RelationshipState | null;
  events: RelationshipStateEvent[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
}

interface RelationshipForm {
  relationshipLabel: string;
  affinity: number;
  userIntroduction: string;
  interactionStyle: string;
  summary: string;
  statusNote: string;
  autoUpdateEnabled: boolean;
}

type EditNameDialog =
  | { type: "person"; value: string }
  | { type: "user"; userId: string; channel: string; value: string }
  | null;

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新关系状态。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "关系状态读取失败";
}

function isMissingRelationshipError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Relationship not found");
}

function formatDate(value: string | null): string {
  if (!value) return "暂无";
  return new Date(value).toLocaleString();
}

function userLabel(relationship: RelationshipState): string {
  // 优先级：person 自己的 label → 第一个绑定 user 的 displayName → 第一个绑定 user 的 externalId
  // （不再兜底到 cuid personId，避免在列表行展示无意义的内部 ID）
  const person = relationship.person;
  if (person?.label) return person.label;
  const firstUser = person?.identityLinks?.[0]?.user;
  return firstUser?.displayName ?? firstUser?.externalId ?? relationship.personId;
}

function relationshipLabelFromAffinityValue(affinity: number): string {
  if (affinity >= 85) return "非常熟悉";
  if (affinity >= 65) return "很熟悉";
  if (affinity >= 40) return "熟悉稳定";
  if (affinity >= 20) return "逐渐熟悉";
  return "刚认识";
}

function channelLabel(externalId: string): string {
  const channel = externalId.split(":")[0]?.trim().toLowerCase() ?? "";
  const labels: Record<string, string> = {
    web: "web",
    xiaohongshu: "小红书",
    rednote: "小红书",
    telegram: "telegram",
    tg: "telegram",
    weixin: "微信",
    wx: "微信",
    bilibili: "B站",
    bili: "B站",
  };
  return labels[channel] ?? (channel || "未知渠道");
}

function channelUserName(user: { externalId: string; displayName: string | null }): string {
  return user.displayName?.trim() || "未命名用户";
}

function identityAliasLabels(relationship: RelationshipState): string[] {
  return (relationship.person?.identityAliases ?? [])
    .slice(0, 8)
    .map((alias) => `${alias.value}${alias.mentionCount > 1 ? ` · ${alias.mentionCount}次` : ""}`);
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function relationshipAutoUpdateEnabled(relationship: RelationshipState): boolean {
  const value = metadataRecord(relationship.metadata).autoUpdateEnabled;
  return typeof value === "boolean" ? value : true;
}

function metadataWithAutoUpdate(relationship: RelationshipState, enabled: boolean): Record<string, unknown> {
  return {
    ...metadataRecord(relationship.metadata),
    autoUpdateEnabled: enabled,
  };
}

function relationshipSummaryText(relationship: RelationshipState): string {
  return relationship.summary ?? relationship.recentSignal ?? relationship.statusNote ?? "暂无关系摘要。";
}

function proposalUserLabel(user: { externalId: string; displayName: string | null }): string {
  return user.displayName ?? user.externalId;
}

function proposalTargetLabel(proposal: IdentityLinkProposal): string {
  return (
    proposal.targetPerson.label ??
    proposal.targetUser?.displayName ??
    proposal.targetUser?.externalId ??
    proposal.targetPersonId
  );
}

function proposalTargetUsersText(proposal: IdentityLinkProposal): string {
  const links = proposal.targetPerson.identityLinks ?? [];
  if (links.length === 0) return "暂无已绑定账号";
  return links.map((link) => proposalUserLabel(link.user)).join(" / ");
}

function proposalEvidenceText(proposal: IdentityLinkProposal): string {
  const evidence =
    proposal.evidence && typeof proposal.evidence === "object" && !Array.isArray(proposal.evidence)
      ? (proposal.evidence as Record<string, unknown>)
      : {};
  const preview =
    typeof evidence.userMessagePreview === "string" && evidence.userMessagePreview.trim()
      ? `消息：${evidence.userMessagePreview}`
      : "";
  const hints = Array.isArray(evidence.matchedHints)
    ? evidence.matchedHints.filter((item): item is string => typeof item === "string")
    : [];
  const terms = Array.isArray(evidence.matchedTerms)
    ? evidence.matchedTerms.filter((item): item is string => typeof item === "string")
    : [];
  return [preview, hints.length > 0 ? `线索：${hints.join(" / ")}` : "", terms.length > 0 ? `匹配：${terms.join(" / ")}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function readableReviewValue(value: unknown): string {
  if (value === null) return "清空";
  if (value === undefined) return "未设置";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function reviewPatchEntries(patch: unknown): Array<{ key: string; label: string; value: string }> {
  const record = metadataRecord(patch);
  const preferred = ["userIntroduction", "summary", "interactionStyle", "affinity", "relationshipLabel"];
  const keys = [
    ...preferred.filter((key) => Object.prototype.hasOwnProperty.call(record, key)),
    ...Object.keys(record).filter((key) => !preferred.includes(key)),
  ];
  return keys.map((key) => ({
    key,
    label: relationshipFieldLabels[key] ?? key,
    value: readableReviewValue(record[key]),
  }));
}

function reviewStatusLabel(status: string): string {
  if (status === "pending") return "待确认";
  if (status === "applied") return "已应用";
  if (status === "rejected") return "已忽略";
  if (status === "observed") return "仅记录";
  return status;
}

function proposalEvidenceSummary(proposal: RelationshipReviewProposal): string {
  if (!proposal.evidences?.length) return "暂无证据明细。";
  return proposal.evidences
    .slice(0, 3)
    .map((evidence) => `${relationshipFieldLabels[evidence.evidenceType] ?? evidence.evidenceType}：${evidence.content}`)
    .join(" / ");
}

function formFromRelationship(relationship: RelationshipState): RelationshipForm {
  return {
    relationshipLabel: relationship.relationshipLabel,
    affinity: relationship.affinity,
    userIntroduction: relationship.userIntroduction ?? "",
    interactionStyle: relationship.interactionStyle ?? "",
    summary: relationship.summary ?? "",
    statusNote: relationship.statusNote ?? "",
    autoUpdateEnabled: relationshipAutoUpdateEnabled(relationship),
  };
}

function eventTypeLabel(type: string): string {
  if (type === "affinity_update") return "好感度变化";
  if (type === "relationship_review") return "关系复盘";
  if (type === "manual_update") return "手动调整";
  if (type === "reset") return "重置";
  if (type === "identity_merge") return "身份合并";
  if (type === "identity_split") return "身份拆分";
  if (type === "identity_link_added") return "身份链接";
  if (type === "identity_name_update") return "身份改名";
  if (type === "channel_user_name_update") return "渠道昵称修改";
  return type;
}

const relationshipFieldLabels: Record<string, string> = {
  relationshipLabel: "关系标签",
  affinity: "好感度",
  userIntroduction: "用户介绍",
  interactionStyle: "互动风格",
  summary: "关系摘要",
  recentSignal: "最近信号",
  statusNote: "备注",
  lastInteractionAt: "最近互动",
  metadata: "关系细节",
  autoUpdateEnabled: "允许 Dream 自动维护",
  delta: "变化量",
  evidence: "证据",
  lastAffinityPatch: "最近好感度调整",
  lastRelationshipReview: "最近关系复盘",
  proposedPatch: "建议改动",
  reason: "原因",
  sincerity: "真诚表达",
  shared_trait: "同频特质",
  cheerful_chat: "愉快聊天",
  caring_for_lusiyuan: "关心思源",
  gentle_kindness: "温柔体贴",
  project_interest: "项目兴趣",
  project_contribution: "项目贡献",
  value_conflict: "价值冲突",
  hostility_or_value_denial: "否定/敌意",
  personLabel: "身份名称",
  displayName: "渠道昵称",
  externalId: "渠道外部 ID",
  userId: "渠道用户",
};

export function RelationshipStatePage({
  adminToken,
  selectedRelationshipId,
  onOpenRelationship,
  onBackToRelationshipList,
  onOpenConversationPerson,
  onOpenMemoryPerson,
}: RelationshipStatePageProps) {
  const [query, setQuery] = useState("");
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [splitUserIds, setSplitUserIds] = useState<string[]>([]);
  const [splitLabel, setSplitLabel] = useState("");
  const [splitAffinity, setSplitAffinity] = useState("");
  const [editNameDialog, setEditNameDialog] = useState<EditNameDialog>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [form, setForm] = useState<RelationshipForm | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>({
    relationships: [],
    proposals: [],
    reviewProposals: [],
    selected: null,
    events: [],
    loading: false,
    saving: false,
    error: null,
    message: null,
  });

  async function loadList(nextQuery = query, preferredId?: string) {
    if (!adminToken) {
      setPageState({
        relationships: [],
        proposals: [],
        reviewProposals: [],
        selected: null,
        events: [],
        loading: false,
        saving: false,
        error: null,
        message: null,
      });
      setForm(null);
      return;
    }

    setPageState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [data, proposalData] = await Promise.all([
        fetchRelationships({
          token: adminToken,
          q: nextQuery,
          limit: 80,
        }),
        fetchIdentityLinkProposals({
          token: adminToken,
          status: "pending",
          limit: 30,
        }),
      ]);
      const selectedId = preferredId ?? selectedRelationshipId ?? null;
      let events: RelationshipStateEvent[] = [];
      let reviewProposals: RelationshipReviewProposal[] = [];
      let detailRelationship: RelationshipState | null = null;
      if (selectedId) {
        try {
          const detail = await fetchRelationshipDetail({
            token: adminToken,
            relationshipId: selectedId,
          });
          detailRelationship = detail.relationship;
          events = detail.events;
          reviewProposals = detail.reviewProposals ?? [];
        } catch (error) {
          if (!isMissingRelationshipError(error)) throw error;
          setPageState((current) => ({
            ...current,
            relationships: data.relationships,
            proposals: proposalData.proposals,
            selected: null,
            events: [],
            reviewProposals: [],
            loading: false,
            error: null,
            message: "这条关系记录已经不存在，已回到关系列表。",
          }));
          setForm(null);
          onBackToRelationshipList?.();
          return;
        }
      }

      setPageState((current) => ({
        ...current,
        relationships: data.relationships,
        proposals: proposalData.proposals,
        selected: detailRelationship,
        events,
        reviewProposals,
        loading: false,
        error: null,
      }));
      setForm(detailRelationship ? formFromRelationship(detailRelationship) : null);
    } catch (error) {
      setPageState((current) => ({
        ...current,
        loading: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function selectRelationship(relationshipId: string) {
    if (!adminToken) return;
    if (onOpenRelationship) {
      onOpenRelationship(relationshipId);
      return;
    }
    setPageState((current) => ({ ...current, loading: true, error: null }));
    try {
      const detail = await fetchRelationshipDetail({ token: adminToken, relationshipId });
      setPageState((current) => ({
        ...current,
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        loading: false,
        error: null,
        message: null,
      }));
      setForm(formFromRelationship(detail.relationship));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        loading: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  useEffect(() => {
    void loadList("", selectedRelationshipId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, selectedRelationshipId]);

  const dirty = useMemo(() => {
    if (!pageState.selected || !form) return false;
    return (
      JSON.stringify(formFromRelationship(pageState.selected)) !==
      JSON.stringify(form)
    );
  }, [pageState.selected, form]);

  const relationshipSelectOptions = useMemo(
    () =>
      pageState.relationships.map((relationship) => ({
        key: relationship.id,
        label: `${userLabel(relationship)} · 好感 ${relationship.affinity}`,
      })),
    [pageState.relationships]
  );

  useEffect(() => {
    setSplitUserIds([]);
    setSplitLabel("");
    setSplitAffinity("");
  }, [pageState.selected?.id]);

  useEffect(() => {
    setSelectedEventId((current) =>
      pageState.events.find((event) => event.id === current)?.id ?? pageState.events[0]?.id ?? null
    );
  }, [pageState.events]);

  const selectedEvent = useMemo(
    () => pageState.events.find((event) => event.id === selectedEventId) ?? pageState.events[0] ?? null,
    [pageState.events, selectedEventId]
  );

  const pendingReviewProposals = useMemo(
    () => pageState.reviewProposals.filter((proposal) => proposal.status === "pending"),
    [pageState.reviewProposals]
  );

  async function saveRelationship() {
    if (!adminToken || !pageState.selected || !form) return;
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await updateRelationshipState({
        token: adminToken,
        relationshipId: pageState.selected.id,
        relationshipLabel: form.relationshipLabel,
        affinity: form.affinity,
        userIntroduction: form.userIntroduction,
        summary: form.summary,
        interactionStyle: form.interactionStyle,
        statusNote: form.statusNote,
        metadata: metadataWithAutoUpdate(pageState.selected, form.autoUpdateEnabled),
        eventSummary: "Admin 手动调整关系状态。",
      });
      setPageState((current) => ({
        ...current,
        relationships: current.relationships.map((relationship) =>
          relationship.id === detail.relationship.id ? detail.relationship : relationship
        ),
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        message: "关系状态已保存。",
      }));
      setForm(formFromRelationship(detail.relationship));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function resetSelectedRelationship() {
    if (!adminToken || !pageState.selected) return;
    const expectedName = userLabel(pageState.selected);
    if (resetConfirmText.trim() !== expectedName) {
      setPageState((current) => ({
        ...current,
        error: `请输入「${expectedName}」后再重置。`,
        message: null,
      }));
      return;
    }
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await resetRelationshipState({
        token: adminToken,
        relationshipId: pageState.selected.id,
      });
      setPageState((current) => ({
        ...current,
        relationships: current.relationships.map((relationship) =>
          relationship.id === detail.relationship.id ? detail.relationship : relationship
        ),
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        message: "关系状态已重置。",
      }));
      setResetConfirmOpen(false);
      setResetConfirmText("");
      setForm(formFromRelationship(detail.relationship));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function reviewIdentityProposal(proposalId: string, action: "approve" | "reject") {
    if (!adminToken) return;
    const confirmed =
      action === "approve"
        ? window.confirm("确认这是同一个现实用户吗？通过后会合并关系状态。")
        : true;
    if (!confirmed) return;

    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const result =
        action === "approve"
          ? await approveIdentityLinkProposal({ token: adminToken, proposalId })
          : await rejectIdentityLinkProposal({ token: adminToken, proposalId });
      await loadList(query, result.relationship?.id ?? pageState.selected?.id);
      setPageState((current) => ({
        ...current,
        saving: false,
        message:
          action === "approve"
            ? "身份已确认并合并到同一个现实身份。"
            : "这条身份怀疑已忽略。",
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function reviewRelationshipProposal(proposalId: string, action: "apply" | "reject") {
    if (!adminToken) return;
    const confirmed =
      action === "apply"
        ? window.confirm("确认应用这次关系复盘吗？应用后会改写这个身份的关系档案。")
        : true;
    if (!confirmed) return;

    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail =
        action === "apply"
          ? await applyRelationshipReviewProposal({ token: adminToken, proposalId })
          : await rejectRelationshipReviewProposal({ token: adminToken, proposalId });
      setPageState((current) => ({
        ...current,
        relationships: current.relationships.map((relationship) =>
          relationship.id === detail.relationship.id ? detail.relationship : relationship
        ),
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        error: null,
        message: action === "apply" ? "关系复盘已应用。" : "这次关系复盘已忽略。",
      }));
      setForm(formFromRelationship(detail.relationship));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function mergeSelectedRelationships() {
    if (!adminToken || !mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    const source = pageState.relationships.find((relationship) => relationship.id === mergeSourceId);
    const target = pageState.relationships.find((relationship) => relationship.id === mergeTargetId);
    const sourceLabel = source ? userLabel(source) : "来源身份";
    const targetLabel = target ? userLabel(target) : "目标身份";
    const confirmed = window.confirm(
      `确认把「${sourceLabel}」合并到「${targetLabel}」吗？\n\n合并后会保留目标身份，好感度取两边较高值。`
    );
    if (!confirmed) return;

    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await mergeRelationshipIdentities({
        token: adminToken,
        sourceRelationshipId: mergeSourceId,
        targetRelationshipId: mergeTargetId,
      });
      const list = await fetchRelationships({ token: adminToken, q: query, limit: 80 });
      setPageState((current) => ({
        ...current,
        relationships: list.relationships,
        selected: null,
        events: [],
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        message: `已把「${sourceLabel}」合并到「${targetLabel}」。`,
        error: null,
      }));
      setForm(null);
      setMergeSourceId("");
      setMergeTargetId(detail.relationship.id);
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
        message: null,
      }));
    }
  }

  function toggleSplitUserId(userId: string) {
    setSplitUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  async function splitSelectedIdentity() {
    if (!adminToken || !pageState.selected) return;
    const links = pageState.selected.person?.identityLinks ?? [];
    if (splitUserIds.length === 0 || splitUserIds.length >= links.length) return;

    const selectedLinks = links.filter((link) => splitUserIds.includes(link.userId));
    const selectedNames = selectedLinks
      .map((link) => `${channelLabel(link.user.externalId)}：${channelUserName(link.user)}`)
      .join(" / ");
    const affinity = splitAffinity.trim() ? Number(splitAffinity) : undefined;
    if (affinity !== undefined && (!Number.isFinite(affinity) || affinity < 0 || affinity > 100)) {
      setPageState((current) => ({
        ...current,
        error: "新身份好感度需要是 0 到 100 之间的数字。",
        message: null,
      }));
      return;
    }
    const confirmed = window.confirm(
      `确认把「${selectedNames}」拆分成新的身份吗？\n\n这些渠道的聊天记录会跟着渠道账号归到新身份，原身份会保留剩余渠道。`
    );
    if (!confirmed) return;

    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await splitRelationshipIdentity({
        token: adminToken,
        relationshipId: pageState.selected.id,
        userIds: splitUserIds,
        newLabel: splitLabel.trim() || undefined,
        newAffinity: affinity,
      });
      setSplitUserIds([]);
      setSplitLabel("");
      setSplitAffinity("");
      setPageState((current) => ({
        ...current,
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        error: null,
        message: "身份已拆分，已切到新身份详情。",
      }));
      setForm(formFromRelationship(detail.relationship));
      onOpenRelationship?.(detail.relationship.id);
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
        message: null,
      }));
    }
  }

  function openPersonNameEditor() {
    if (!pageState.selected) return;
    setEditNameDialog({
      type: "person",
      value: pageState.selected.person?.label ?? userLabel(pageState.selected),
    });
  }

  function openUserNameEditor(userId: string, channel: string, value: string) {
    setEditNameDialog({ type: "user", userId, channel, value });
  }

  async function saveNameDialog() {
    if (!adminToken || !pageState.selected || !editNameDialog) return;
    const nextValue = editNameDialog.value.trim();
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = editNameDialog.type === "person"
        ? await updateRelationshipIdentityLabel({
            token: adminToken,
            relationshipId: pageState.selected.id,
            label: nextValue || null,
          })
        : await updateRelationshipUserDisplayName({
            token: adminToken,
            relationshipId: pageState.selected.id,
            userId: editNameDialog.userId,
            displayName: nextValue || null,
          });
      setPageState((current) => ({
        ...current,
        relationships: current.relationships.map((relationship) =>
          relationship.id === detail.relationship.id ? detail.relationship : relationship
        ),
        selected: detail.relationship,
        events: detail.events,
        reviewProposals: detail.reviewProposals ?? [],
        saving: false,
        error: null,
        message: editNameDialog.type === "person" ? "身份名称已更新。" : "渠道昵称已更新。",
      }));
      setForm(formFromRelationship(detail.relationship));
      setEditNameDialog(null);
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
        message: null,
      }));
    }
  }

  if (!adminToken) {
    return (
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-7 shadow-[var(--ls-shadow)]">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Relationship State</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--ls-ink-strong)]">关系状态</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          请先在顶部输入 Admin Token。这里会显示陆思源和每个现实身份之间的好感度和关系摘要。
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-6 shadow-[var(--ls-shadow)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Relationship State</div>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">
              {selectedRelationshipId ? "关系详情" : "关系状态"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ls-ink-soft)]">
              {selectedRelationshipId
                ? "这里集中处理一个现实身份的关系状态、渠道账号和关系变更记录。"
                : "每个现实身份一份关系状态。列表只放关键关系信息，点进详情后再修正状态和查看变更。"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedRelationshipId && (
              <Button type="default" onClick={() => onBackToRelationshipList?.()}>
                返回列表
              </Button>
            )}
            <Button type="default" onClick={() => void loadList(query, selectedRelationshipId)}>
              刷新
            </Button>
            {selectedRelationshipId && (
              <>
                <Button
                  type="primary"
                  loading={pageState.saving}
                  disabled={!dirty}
                  onClick={() => void saveRelationship()}
                >
                  保存
                </Button>
                <Button
                  type="default"
                  danger
                  disabled={!pageState.selected || pageState.saving}
                  onClick={() => {
                    setResetConfirmText("");
                    setResetConfirmOpen(true);
                  }}
                >
                  重置
                </Button>
              </>
            )}
          </div>
        </div>

        {!selectedRelationshipId && <RelationshipSummaryStrip relationships={pageState.relationships} />}

        {pageState.error && (
          <div className="mt-5 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm text-[var(--ls-warning-text)]">
            {pageState.error}
          </div>
        )}
        {pageState.message && (
          <div className="mt-5 rounded-lg border border-[var(--ls-success-border)] bg-[var(--ls-success-bg)] px-4 py-3 text-sm text-[var(--ls-success-text)]">
            {pageState.message}
          </div>
        )}
      </section>

      {!selectedRelationshipId ? (
        <>
          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">用户关系</h3>
                  <Icon name="icon-chat" size={18} className="opacity-70" />
                </div>
                <p className="mt-1 text-xs text-[var(--ls-ink-soft)]">
                  {pageState.relationships.length} 个现实身份，按更新时间读取最近的关系状态。
                </p>
              </div>
              <form
                className="flex w-full gap-2 md:w-auto"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadList(query);
                }}
              >
                <AdminInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索用户或摘要"
                  aria-label="搜索用户或摘要"
                />
                <Button htmlType="submit" type="default">
                  搜索
                </Button>
              </form>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ls-border)]">
              <div className="hidden grid-cols-[minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_minmax(20rem,2fr)_minmax(4.5rem,0.35fr)_minmax(7rem,0.55fr)_2rem] items-center gap-3 bg-[var(--ls-panel-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ls-ink-soft)] lg:grid">
                <div>用户</div>
                <div>渠道账号</div>
                <div>主要内容</div>
                <div className="text-center">好感</div>
                <div>最近更新</div>
                <div />
              </div>
              {pageState.relationships.length > 0 ? (
                pageState.relationships.map((relationship) => (
                  <button
                    key={relationship.id}
                    type="button"
                    onClick={() => void selectRelationship(relationship.id)}
                    className="admin-layout-button grid w-full gap-3 border-t border-[var(--ls-border)] bg-white px-4 py-4 text-left transition first:border-t-0 hover:bg-[var(--ls-panel-soft)] lg:grid-cols-[minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_minmax(20rem,2fr)_minmax(4.5rem,0.35fr)_minmax(7rem,0.55fr)_2rem] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-semibold text-[var(--ls-ink-strong)]">
                          {userLabel(relationship)}
                        </span>
                        <Tag size="small" color={relationshipLabelColor(relationship.relationshipLabel)}>
                          {relationship.relationshipLabel}
                        </Tag>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1 text-xs leading-5 text-[var(--ls-ink-soft)]">
                      {(relationship.person?.identityLinks ?? []).map((link) => (
                        <div key={link.id} className="break-words">
                          <span className="font-semibold text-[var(--ls-ink-strong)]">
                            {channelLabel(link.user.externalId)}
                          </span>
                          <span>：{channelUserName(link.user)}</span>
                        </div>
                      ))}
                      {(relationship.person?.identityLinks ?? []).length === 0 && (
                        <div>暂无渠道账号</div>
                      )}
                    </div>
                    <div className="min-w-0 text-sm leading-6 text-[var(--ls-ink-strong)]">
                      {relationshipSummaryText(relationship)}
                    </div>
                    <div className="grid grid-cols-1 gap-2 lg:contents">
                      <RelationshipScoreCell label="好感" value={relationship.affinity} />
                    </div>
                    <div className="text-xs leading-5 text-[var(--ls-ink-soft)]">
                      {formatDate(relationship.lastInteractionAt ?? relationship.updatedAt)}
                    </div>
                    <div className="hidden text-right text-xl font-semibold text-[var(--ls-border-cold)] lg:block">
                      ›
                    </div>
                  </button>
                ))
              ) : (
                <div className="bg-[var(--ls-panel-soft)] px-4 py-8 text-sm text-[var(--ls-ink-soft)]">
                  {pageState.loading ? "正在读取关系状态..." : "暂无关系状态。用户聊天后会自动创建。"}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">合并身份</h3>
                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  确认两个身份其实是同一个人时使用。合并后保留目标身份，渠道账号迁过去，好感度取两边较高值。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end">
              <Field label="来源身份">
                <AdminSelect
                  ariaLabel="来源身份"
                  value={mergeSourceId}
                  onChange={setMergeSourceId}
                  placeholder="选择要合并掉的身份"
                  options={relationshipSelectOptions}
                />
              </Field>
              <Field label="目标身份（保留）">
                <AdminSelect
                  ariaLabel="目标身份"
                  value={mergeTargetId}
                  onChange={setMergeTargetId}
                  placeholder="选择要保留的身份"
                  options={relationshipSelectOptions}
                />
              </Field>
              <Button
                type="primary"
                loading={pageState.saving}
                disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                onClick={() => void mergeSelectedRelationships()}
              >
                合并
              </Button>
            </div>
          </section>
        </>
      ) : pageState.selected && form ? (
        <div className="space-y-5">
          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-[var(--ls-ink-soft)]">当前用户</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-semibold text-[var(--ls-ink-strong)]">
                    {userLabel(pageState.selected)}
                  </span>
                  <EditPencilButton
                    label="编辑身份名称"
                    onClick={openPersonNameEditor}
                  />
                </div>
                <div className="mt-2 text-sm text-[var(--ls-ink-soft)]">
                  Person ID: {pageState.selected.personId}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(pageState.selected.person?.identityLinks ?? []).map((link) => (
                    <span
                      key={link.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-1 text-xs text-[var(--ls-ink-strong)]"
                    >
                      <span>{channelLabel(link.user.externalId)}：{channelUserName(link.user)}</span>
                      <EditPencilButton
                        label={`编辑${channelLabel(link.user.externalId)}渠道昵称`}
                        compact
                        onClick={(event) => {
                          event.stopPropagation();
                          openUserNameEditor(
                            link.userId,
                            channelLabel(link.user.externalId),
                            link.user.displayName ?? ""
                          );
                        }}
                      />
                    </span>
                  ))}
                </div>
                {identityAliasLabels(pageState.selected).length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ls-ink-soft)]">
                    <span className="font-semibold text-[var(--ls-ink-strong)]">自称/别名</span>
                    {identityAliasLabels(pageState.selected).map((alias) => (
                      <Tag key={alias} size="small" variant="outlined" color="default">
                        {alias}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="primary"
                  onClick={() => {
                    if (pageState.selected?.personId) {
                      onOpenConversationPerson?.(pageState.selected.personId);
                    }
                  }}
                >
                  查看对话记录
                </Button>
                <Button
                  type="default"
                  onClick={() => {
                    if (pageState.selected?.personId) {
                      onOpenMemoryPerson?.(pageState.selected.personId);
                    }
                  }}
                >
                  查看记忆
                </Button>
                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm text-[var(--ls-ink-strong)]">
                  <div className="text-xs text-[var(--ls-ink-soft)]">好感度</div>
                  <div className="mt-1 text-lg font-black tabular-nums">
                    {form.affinity}/100
                  </div>
                  <div className="mt-1 text-xs text-[var(--ls-ink-soft)]">
                    {form.relationshipLabel}
                  </div>
                </div>
              </div>
            </div>
	          </section>

	          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
	            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
	              <div>
	                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">待确认的关系复盘</h3>
	                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
	                  这里放 Dream 已经想好、但因为关闭自动维护而没有写入的关系档案建议。应用后会进入下面的关系变更记录。
	                </p>
	              </div>
	              <Tag size="small" variant="outlined" color="default">
                {pendingReviewProposals.length} 条待确认
              </Tag>
	            </div>
	            <div className="mt-4 grid gap-3">
	              {pendingReviewProposals.length > 0 ? (
	                pendingReviewProposals.map((proposal) => {
	                  const patchEntries = reviewPatchEntries(proposal.proposedPatch);
	                  return (
	                    <div
	                      key={proposal.id}
	                      className="grid gap-4 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-4 lg:grid-cols-[1fr_auto]"
	                    >
	                      <div className="min-w-0">
	                        <div className="flex flex-wrap items-center gap-2">
	                          <Tag size="small" color="app-yellow">
                            {reviewStatusLabel(proposal.status)}
                          </Tag>
	                          <Tag size="small" variant="outlined" color="app-blue">
                            {Math.round(proposal.confidence * 100)}%
                          </Tag>
	                          <span className="text-xs text-[var(--ls-ink-soft)]">
	                            {formatDate(proposal.createdAt)}
	                          </span>
	                        </div>
	                        <div className="mt-2 text-sm leading-6 text-[var(--ls-ink-strong)]">
	                          {proposal.reason}
	                        </div>
	                        <div className="mt-3 grid gap-2">
	                          {patchEntries.length > 0 ? (
	                            patchEntries.map((entry) => (
	                              <div
	                                key={entry.key}
	                                className="rounded-lg border border-[var(--ls-border)] bg-white px-3 py-2"
	                              >
	                                <div className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">
	                                  {entry.label}
	                                </div>
	                                <div className="mt-1 break-words text-sm leading-6 text-[var(--ls-ink-strong)]">
	                                  {entry.value}
	                                </div>
	                              </div>
	                            ))
	                          ) : (
	                            <div className="rounded-lg border border-[var(--ls-border)] bg-white px-3 py-2 text-sm text-[var(--ls-ink-soft)]">
	                              这次复盘没有建议改动，只记录观察。
	                            </div>
	                          )}
	                        </div>
	                        <div className="mt-3 text-xs leading-6 text-[var(--ls-ink-soft)]">
	                          证据：{proposalEvidenceSummary(proposal)}
	                        </div>
	                      </div>
	                      <div className="flex items-center gap-2 lg:justify-end">
	                        <Button
	                          type="primary"
	                          disabled={pageState.saving}
	                          onClick={() => void reviewRelationshipProposal(proposal.id, "apply")}
	                        >
	                          应用
	                        </Button>
	                        <Button
	                          type="default"
	                          disabled={pageState.saving}
	                          onClick={() => void reviewRelationshipProposal(proposal.id, "reject")}
	                        >
	                          忽略
	                        </Button>
	                      </div>
	                    </div>
	                  );
	                })
	              ) : (
	                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
	                  暂无待确认的关系复盘。开启自动维护时，Dream 会直接写入并出现在关系变更里。
	                </div>
	              )}
	            </div>
	          </section>

	          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
	            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">详细信息</h3>
                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  用户介绍、关系摘要、互动风格和好感度会进入聊天上下文；备注只在 admin 里看。
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-full bg-[var(--ls-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--ls-ink-soft)]">
                <input
                  type="checkbox"
                  checked={form.autoUpdateEnabled}
                  onChange={(event) => setForm({ ...form, autoUpdateEnabled: event.target.checked })}
                />
                允许 Dream 自动维护
              </label>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <TextAreaField
                label="用户介绍"
                value={form.userIntroduction}
                onChange={(value) => setForm({ ...form, userIntroduction: value })}
              />
              <TextAreaField
                label="关系摘要"
                value={form.summary}
                onChange={(value) => setForm({ ...form, summary: value })}
              />
              <TextAreaField
                label="互动风格"
                value={form.interactionStyle}
                onChange={(value) => setForm({ ...form, interactionStyle: value })}
              />
              <TextAreaField
                label="备注（仅 admin）"
                value={form.statusNote}
                onChange={(value) => setForm({ ...form, statusNote: value })}
              />
              <MetricSlider
                label={`好感度 / 关系标签：${form.relationshipLabel}`}
                value={form.affinity}
                onChange={(value) =>
                  setForm({
                    ...form,
                    affinity: value,
                    relationshipLabel: relationshipLabelFromAffinityValue(value),
                  })
                }
              />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">身份怀疑</h3>
                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  系统只会怀疑，不会自动确认。通过后才会把渠道账号合并到同一个现实身份。
                </p>
              </div>
              <div className="rounded-full bg-[var(--ls-panel-soft)] px-3 py-1 text-xs font-medium text-[var(--ls-ink-soft)]">
                {pageState.proposals.length} 条待审核
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {pageState.proposals.length > 0 ? (
                pageState.proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="grid gap-4 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-4 lg:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                          {proposalUserLabel(proposal.sourceUser)}
                        </span>
                        <span className="text-xs text-[var(--ls-ink-soft)]">可能是</span>
                        <span className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                          {proposalTargetLabel(proposal)}
                        </span>
                        <Tag size="small" variant="outlined" color="app-blue">
                            {Math.round(proposal.confidence * 100)}%
                          </Tag>
                      </div>
                      <div className="mt-2 text-xs leading-6 text-[var(--ls-ink-soft)]">
                        {proposal.reason}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                        {proposalEvidenceText(proposal) || "暂无详细证据。"}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                        已有身份账号：{proposalTargetUsersText(proposal)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:justify-end">
                      <Button
                        type="primary"
                        disabled={pageState.saving}
                        onClick={() => void reviewIdentityProposal(proposal.id, "approve")}
                      >
                        通过
                      </Button>
                      <Button
                        type="default"
                        disabled={pageState.saving}
                        onClick={() => void reviewIdentityProposal(proposal.id, "reject")}
                      >
                        忽略
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
                  暂无待审核的身份怀疑。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">拆分身份</h3>
                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  发现某些渠道账号不属于当前现实身份时，把这些渠道整体拆出去。对应渠道的聊天记录会跟着账号归到新身份。
                </p>
              </div>
              <div className="rounded-full bg-[var(--ls-panel-soft)] px-3 py-1 text-xs font-medium text-[var(--ls-ink-soft)]">
                {(pageState.selected.person?.identityLinks ?? []).length} 个渠道账号
              </div>
            </div>

            {(pageState.selected.person?.identityLinks ?? []).length > 1 ? (
              <>
                <div className="mt-4 grid gap-2">
                  {(pageState.selected.person?.identityLinks ?? []).map((link) => {
                    const checked = splitUserIds.includes(link.userId);
                    return (
                      <label
                        key={link.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                          checked
                            ? "border-[var(--ls-border-cold)] bg-[var(--ls-panel-cold)]"
                            : "border-[var(--ls-border)] bg-[var(--ls-panel-soft)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSplitUserId(link.userId)}
                          className="mt-1"
                        />
                        <span className="min-w-0 text-sm leading-6 text-[var(--ls-ink-strong)]">
                          <span className="font-semibold">{channelLabel(link.user.externalId)}</span>
                          <span>：{channelUserName(link.user)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.55fr)_auto] lg:items-end">
                  <Field label="新身份名称（可选）">
                    <AdminInput
                      value={splitLabel}
                      onChange={(event) => setSplitLabel(event.target.value)}
                      placeholder="默认使用第一个渠道昵称"
                      aria-label="新身份名称"
                    />
                  </Field>
                  <Field label="新身份好感度（可选）">
                    <AdminInput
                      type="number"
                      min={0}
                      max={100}
                      value={splitAffinity}
                      onChange={(event) => setSplitAffinity(event.target.value)}
                      placeholder={`默认 ${pageState.selected.affinity}`}
                      aria-label="新身份好感度"
                    />
                  </Field>
                  <Button
                    type="primary"
                    loading={pageState.saving}
                    disabled={
                      splitUserIds.length === 0 ||
                      splitUserIds.length >= (pageState.selected.person?.identityLinks ?? []).length
                    }
                    onClick={() => void splitSelectedIdentity()}
                  >
                    拆分
                  </Button>
                </div>

                {splitUserIds.length >= (pageState.selected.person?.identityLinks ?? []).length && (
                  <div className="mt-3 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-xs leading-6 text-[var(--ls-warning-text)]">
                    不能把全部渠道都拆出去；原身份至少要保留一个渠道账号。
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-4 text-sm text-[var(--ls-ink-soft)]">
                当前身份只有一个渠道账号，不需要拆分。要改好感度或名称，可以直接在详细信息里手动修正。
              </div>
              )}
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
	                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">关系变更</h3>
	                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
	                  最近 20 条程序或 admin 写入记录。按时间展示，每条点开后查看实际改了哪些字段。
	                </p>
	              </div>
              <Tag size="small" variant="outlined" color="default">
                {pageState.events.length} 条记录
              </Tag>
	            </div>
	            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
	              {pageState.events.length > 0 ? (
	                <>
	                  <div className="overflow-hidden rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] self-start">
	                    <div className="divide-y divide-[var(--ls-border)]">
	                      {pageState.events.map((event) => {
	                        const active = selectedEvent?.id === event.id;
	                        return (
	                          <button
	                            key={event.id}
	                            type="button"
	                            onClick={() => setSelectedEventId(event.id)}
	                            className={`admin-layout-button w-full px-4 py-3 text-left transition ${
	                              active ? "is-active" : ""
	                            }`}
	                          >
	                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ls-ink-soft)]">
	                              <Tag size="small" variant="outlined" color="app-teal">
                                {eventTypeLabel(event.eventType)}
                              </Tag>
	                              <Tag size="small" variant="outlined" color="default">
                                {event.source ?? "unknown"}
                              </Tag>
	                              {event.channel && <span>渠道：{event.channel}</span>}
	                              <span>{formatDate(event.createdAt)}</span>
	                            </div>
	                            <div className="mt-2 break-words text-sm leading-6 text-[var(--ls-ink-strong)]">
	                              {event.summary || "这条记录没有摘要。"}
	                            </div>
	                          </button>
	                        );
	                      })}
	                    </div>
	                  </div>
	                  <StateChangeDetail
                    event={selectedEvent}
                    eventTypeLabel={eventTypeLabel}
                    fieldLabels={relationshipFieldLabels}
                    title="关系变化解释"
                  />
                </>
              ) : (
                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)] xl:col-span-2">
                  暂无关系变更。
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-lg border border-[var(--ls-border)] bg-white px-5 py-8 text-sm text-[var(--ls-ink-soft)]">
          {pageState.loading ? "正在读取关系详情..." : "没有找到这条关系状态。"}
        </section>
      )}

      {editNameDialog && (
        <RelationshipModal
          title={editNameDialog.type === "person" ? "编辑身份名称" : `编辑${editNameDialog.channel}昵称`}
          description={
            editNameDialog.type === "person"
              ? "身份名称是你在关系列表里看到的现实身份名字。"
              : "渠道昵称只影响这个渠道账号在 admin 里的显示名，不会改变渠道外部 ID。"
          }
          onClose={() => setEditNameDialog(null)}
          footer={
            <>
              <Button type="default" disabled={pageState.saving} onClick={() => setEditNameDialog(null)}>
                取消
              </Button>
              <Button
                type="primary"
                loading={pageState.saving}
                disabled={!editNameDialog.value.trim()}
                onClick={() => void saveNameDialog()}
              >
                保存
              </Button>
            </>
          }
        >
          <Field label={editNameDialog.type === "person" ? "身份名称" : "渠道昵称"}>
            <AdminInput
              value={editNameDialog.value}
              onChange={(event) =>
                setEditNameDialog((current) =>
                  current ? { ...current, value: event.target.value } : current
                )
              }
              placeholder={editNameDialog.type === "person" ? "输入身份名称" : "输入渠道昵称"}
              aria-label={editNameDialog.type === "person" ? "身份名称" : "渠道昵称"}
            />
          </Field>
        </RelationshipModal>
      )}

      {resetConfirmOpen && pageState.selected && (
        <RelationshipModal
          title="确认重置关系状态"
          description={`请输入「${userLabel(pageState.selected)}」后才能重置。重置只会恢复关系状态字段，不会删除身份、渠道账号或聊天记录。`}
          onClose={() => {
            setResetConfirmOpen(false);
            setResetConfirmText("");
          }}
          footer={
            <>
              <Button
                type="default"
                disabled={pageState.saving}
                onClick={() => {
                  setResetConfirmOpen(false);
                  setResetConfirmText("");
                }}
              >
                取消
              </Button>
              <Button
                type="default"
                danger
                loading={pageState.saving}
                disabled={resetConfirmText.trim() !== userLabel(pageState.selected)}
                onClick={() => void resetSelectedRelationship()}
              >
                确认重置
              </Button>
            </>
          }
        >
          <Field label="输入身份名称">
            <AdminInput
              value={resetConfirmText}
              onChange={(event) => setResetConfirmText(event.target.value)}
              placeholder={userLabel(pageState.selected)}
              aria-label="输入要重置的身份名称"
            />
          </Field>
        </RelationshipModal>
      )}
    </div>
  );
}

function RelationshipModal({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[var(--ls-border)] bg-white p-5 shadow-[var(--ls-shadow)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ls-ink-strong)]">{title}</h3>
            {description && (
              <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            className="admin-layout-button rounded-full px-2 py-1 text-sm font-semibold text-[var(--ls-ink-soft)] hover:bg-[var(--ls-panel-soft)]"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function EditPencilButton({
  label,
  compact = false,
  onClick,
}: {
  label: string;
  compact?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`admin-layout-button inline-flex items-center justify-center rounded-full border border-[var(--ls-border)] bg-white font-semibold text-[var(--ls-ink-soft)] transition hover:bg-[var(--ls-panel-soft)] hover:text-[var(--ls-ink-strong)] ${
        compact ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-sm"
      }`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="inline-block -scale-x-100">✎</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      {children}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <textarea
        className="field-input min-h-20 resize-y leading-6"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MetricSlider({
  label,
  value,
  dangerHigh = false,
  onChange,
}: {
  label: string;
  value: number;
  dangerHigh?: boolean;
  onChange: (value: number) => void;
}) {
  const strong = dangerHigh ? value < 45 : value >= 45;
  return (
    <label className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ls-ink-soft)]">
        <span>{label}</span>
        <span className="text-[var(--ls-ink-strong)]">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-3 w-full ${strong ? "accent-[var(--ls-success-text-soft)]" : "accent-[var(--ls-warning-text-strong)]"}`}
      />
    </label>
  );
}

function RelationshipScoreCell({
  label,
  value,
  dangerHigh = false,
}: {
  label: string;
  value: number;
  dangerHigh?: boolean;
}) {
  const good = dangerHigh ? value < 45 : value >= 45;
  const barColor = good ? "var(--ls-mint)" : "var(--ls-orange)";
  const valueColor = good ? "text-[var(--ls-success-text)]" : "text-[var(--ls-warning-text-strong)]";
  return (
    <div className="rounded-md border border-[var(--ls-panel-cold-deep)] bg-[var(--ls-panel-soft)] px-2 py-2 lg:border-transparent lg:bg-transparent lg:px-1">
      <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold text-[var(--ls-ink-soft)] lg:flex-col lg:items-start lg:gap-0.5">
        <span>{label}</span>
        <span className={`text-sm font-black tabular-nums ${valueColor}`}>{value}</span>
      </div>
      {/* 水平进度条：直观看到 4 个维度的相对强度 */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ls-panel-cold-deep)] lg:block hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function RelationshipSummaryStrip({ relationships }: { relationships: RelationshipState[] }) {
  if (relationships.length === 0) return null;

  const avgAffinity = Math.round(
    relationships.reduce((sum, r) => sum + (r.affinity ?? 0), 0) / relationships.length
  );
  const closeRelationships = relationships.filter((r) => r.affinity >= 65).length;
  const distinctLabels = new Set(relationships.map((r) => r.relationshipLabel)).size;

  const stats: Array<{ label: string; value: number; tone: "good" | "neutral" | "alert"; suffix?: string }> = [
    { label: "现实身份", value: relationships.length, tone: "neutral", suffix: "个" },
    { label: "平均好感", value: avgAffinity, tone: avgAffinity >= 45 ? "good" : "neutral" },
    { label: "高好感关系", value: closeRelationships, tone: closeRelationships > 0 ? "good" : "neutral", suffix: "人" },
    { label: "关系标签", value: distinctLabels, tone: "neutral", suffix: "种" },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => {
        const toneClass =
          s.tone === "good"
            ? "border-[var(--ls-success-border-soft)] bg-[var(--ls-success-bg-soft)]"
            : s.tone === "alert"
            ? "border-[var(--ls-pink-text)] bg-[var(--ls-pink-soft)]"
            : "border-[var(--ls-border)] bg-[var(--ls-panel-soft)]";
        const valueClass =
          s.tone === "good"
            ? "text-[var(--ls-success-text-strong)]"
            : s.tone === "alert"
            ? "text-[var(--ls-pink-text)]"
            : "text-[var(--ls-ink-strong)]";
        return (
          <div key={s.label} className={`rounded-lg border px-4 py-3 ${toneClass}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ls-ink-soft)]">
              {s.label}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className={`text-2xl font-black tabular-nums ${valueClass}`}>{s.value}</span>
              {s.suffix && <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{s.suffix}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 关系标签配色：按 label 关键词匹配项目已有色板，避免所有 chip 同色单调。
 * 命中规则（按优先级匹配首个命中）：
 *   - "熟悉/老朋友/老熟" → 薄荷（积极）
 *   - "认识/刚"          → 蓝（中性，开始）
 *   - "陌生/未"          → 灰（冷）
 *   - 兜底 → 暖橙
 */
function relationshipLabelColor(label: string): import("animal-island-ui").TagProps["color"] {
  const s = label ?? "";
  if (/(熟悉|老朋友|老熟|亲近|信任)/.test(s)) return "app-green";
  if (/(认识|初次|刚开始|新建|刚)/.test(s)) return "app-blue";
  if (/(陌生|未形成|未知|未确认)/.test(s)) return "default";
  return "app-orange";
}


