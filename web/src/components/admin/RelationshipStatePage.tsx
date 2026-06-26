import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "animal-island-ui";
import { AdminInput } from "./AdminFormPrimitives";
import {
  approveIdentityLinkProposal,
  fetchIdentityLinkProposals,
  fetchRelationshipDetail,
  fetchRelationships,
  linkRelationshipUser,
  rejectIdentityLinkProposal,
  resetRelationshipState,
  updateRelationshipState,
  type IdentityLinkProposal,
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
}

interface PageState {
  relationships: RelationshipState[];
  proposals: IdentityLinkProposal[];
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
  interactionStyle: string;
  summary: string;
  recentSignal: string;
  statusNote: string;
}

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

function formFromRelationship(relationship: RelationshipState): RelationshipForm {
  return {
    relationshipLabel: relationship.relationshipLabel,
    affinity: relationship.affinity,
    interactionStyle: relationship.interactionStyle ?? "",
    summary: relationship.summary ?? "",
    recentSignal: relationship.recentSignal ?? "",
    statusNote: relationship.statusNote ?? "",
  };
}

function eventTypeLabel(type: string): string {
  if (type === "affinity_update") return "好感度调整";
  if (type === "manual_update") return "手动调整";
  if (type === "reset") return "重置";
  if (type === "identity_merge") return "身份合并";
  if (type === "identity_link_added") return "身份绑定";
  return type;
}

const relationshipFieldLabels: Record<string, string> = {
  relationshipLabel: "关系标签",
  affinity: "好感度",
  interactionStyle: "互动风格",
  summary: "关系摘要",
  recentSignal: "最近信号",
  statusNote: "备注",
  lastInteractionAt: "最近互动",
  metadata: "关系细节",
  delta: "变化量",
  evidence: "证据",
  lastAffinityPatch: "最近好感度调整",
  reason: "原因",
};

export function RelationshipStatePage({
  adminToken,
  selectedRelationshipId,
  onOpenRelationship,
  onBackToRelationshipList,
  onOpenConversationPerson,
}: RelationshipStatePageProps) {
  const [query, setQuery] = useState("");
  const [linkUserId, setLinkUserId] = useState("");
  const [form, setForm] = useState<RelationshipForm | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [pageState, setPageState] = useState<PageState>({
    relationships: [],
    proposals: [],
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
      let detailRelationship: RelationshipState | null = null;
      if (selectedId) {
        const detail = await fetchRelationshipDetail({
          token: adminToken,
          relationshipId: selectedId,
        });
        detailRelationship = detail.relationship;
        events = detail.events;
      }

      setPageState((current) => ({
        ...current,
        relationships: data.relationships,
        proposals: proposalData.proposals,
        selected: detailRelationship,
        events,
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

  const eventTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of pageState.events) {
      counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    }
    return [
      { type: "all", label: "全部", count: pageState.events.length },
      ...Array.from(counts.entries()).map(([type, count]) => ({
        type,
        label: eventTypeLabel(type),
        count,
      })),
    ];
  }, [pageState.events]);

  const filteredEvents = useMemo(
    () =>
      eventTypeFilter === "all"
        ? pageState.events
        : pageState.events.filter((event) => event.eventType === eventTypeFilter),
    [eventTypeFilter, pageState.events]
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, RelationshipStateEvent[]>();
    for (const event of filteredEvents) {
      const group = groups.get(event.eventType) ?? [];
      group.push(event);
      groups.set(event.eventType, group);
    }
    return Array.from(groups.entries()).map(([type, events]) => ({ type, events }));
  }, [filteredEvents]);

  useEffect(() => {
    setEventTypeFilter("all");
  }, [pageState.selected?.id]);

  useEffect(() => {
    setSelectedEventId((current) =>
      filteredEvents.find((event) => event.id === current)?.id ?? filteredEvents[0]?.id ?? null
    );
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedEventId]
  );

  async function saveRelationship() {
    if (!adminToken || !pageState.selected || !form) return;
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await updateRelationshipState({
        token: adminToken,
        relationshipId: pageState.selected.id,
        ...form,
        eventSummary: "Admin 手动调整关系状态。",
      });
      setPageState((current) => ({
        ...current,
        relationships: current.relationships.map((relationship) =>
          relationship.id === detail.relationship.id ? detail.relationship : relationship
        ),
        selected: detail.relationship,
        events: detail.events,
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
    if (!window.confirm("确定要把这个用户的关系状态重置为默认状态吗？")) return;
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
        saving: false,
        message: "关系状态已重置。",
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

  async function linkUserToSelectedPerson() {
    if (!adminToken || !pageState.selected || !linkUserId.trim()) return;
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await linkRelationshipUser({
        token: adminToken,
        relationshipId: pageState.selected.id,
        userId: linkUserId.trim(),
      });
      const list = await fetchRelationships({ token: adminToken, q: query, limit: 80 });
      setPageState((current) => ({
        ...current,
        relationships: list.relationships,
        selected: detail.relationship,
        events: detail.events,
        saving: false,
        message: "用户身份已绑定到当前现实身份。",
      }));
      setForm(formFromRelationship(detail.relationship));
      setLinkUserId("");
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

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[var(--ls-border)] bg-white p-7 shadow-[var(--ls-shadow)]">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Relationship State</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--ls-ink-strong)]">关系状态</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          请先在顶部输入 Admin Token。这里会显示陆思源和每个现实身份之间的好感度和关系摘要。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-6 shadow-[var(--ls-shadow)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Relationship State</div>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">
              {selectedRelationshipId ? "关系详情" : "关系状态"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ls-ink-soft)]">
              {selectedRelationshipId
                ? "这里集中处理一个现实身份的关系状态、渠道绑定和关系变更记录。"
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
                  onClick={() => void resetSelectedRelationship()}
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
        <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">用户关系</h3>
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
            <div className="hidden grid-cols-[minmax(15rem,1.05fr)_minmax(18rem,1.45fr)_minmax(5rem,0.4fr)_minmax(8rem,0.75fr)_2rem] items-center gap-3 bg-[var(--ls-panel-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ls-ink-soft)] lg:grid">
              <div>用户</div>
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
                  className="admin-layout-button grid w-full gap-3 border-t border-[var(--ls-border)] bg-white px-4 py-4 text-left transition first:border-t-0 hover:bg-[var(--ls-panel-soft)] lg:grid-cols-[minmax(15rem,1.05fr)_minmax(18rem,1.45fr)_minmax(5rem,0.4fr)_minmax(8rem,0.75fr)_2rem] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold text-[var(--ls-ink-strong)]">
                        {userLabel(relationship)}
                      </span>
                      {(() => {
                        const tone = relationshipLabelTone(relationship.relationshipLabel);
                        return (
                          <span
                            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                          >
                            {relationship.relationshipLabel}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--ls-ink-soft)]">
                      {(() => {
                        // 只在 chip 内容与上方 userLabel 不同时才显示，避免同一 user ID 重复两次
                        const top = userLabel(relationship);
                        const links = relationship.person?.identityLinks ?? [];
                        const labels = links
                          .map((link) => link.user.displayName ?? link.user.externalId)
                          .filter((label) => label && label !== top);
                        if (labels.length === 0) return null;
                        return labels.map((label, i) => (
                          <span
                            key={`${label}-${i}`}
                            className="rounded-full bg-[var(--ls-panel-cold)] px-2.5 py-1"
                          >
                            {label}
                          </span>
                        ));
                      })()}
                    </div>
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
      ) : pageState.selected && form ? (
        <div className="space-y-5">
          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-[var(--ls-ink-soft)]">当前用户</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ls-ink-strong)]">
                  {userLabel(pageState.selected)}
                </div>
                <div className="mt-2 text-sm text-[var(--ls-ink-soft)]">
                  Person ID: {pageState.selected.personId}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(pageState.selected.person?.identityLinks ?? []).map((link) => (
                    <span
                      key={link.id}
                      className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-1 text-xs text-[var(--ls-ink-strong)]"
                    >
                      {link.user.displayName ?? link.user.externalId}
                    </span>
                  ))}
                </div>
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
                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm text-[var(--ls-ink-strong)]">
                  {pageState.selected.relationshipLabel}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <MetricSlider
                label="好感度"
                value={form.affinity}
                onChange={(value) => setForm({ ...form, affinity: value })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">详情与修正</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 lg:col-span-2">
                <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">绑定其他渠道账号</div>
                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <AdminInput
                    value={linkUserId}
                    onChange={(event) => setLinkUserId(event.target.value)}
                    placeholder="User externalId / id，例如 telegram:123"
                    aria-label="绑定渠道账号"
                  />
                  <Button
                    type="primary"
                    disabled={!linkUserId.trim() || pageState.saving}
                    onClick={() => void linkUserToSelectedPerson()}
                  >
                    绑定
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  只有明确确认是同一个现实用户时再绑定。绑定后多个渠道会共用这一份关系状态。
                </p>
              </div>
              <Field label="关系标签">
                <AdminInput
                  value={form.relationshipLabel}
                  onChange={(event) =>
                    setForm({ ...form, relationshipLabel: event.target.value })
                  }
                  aria-label="关系标签"
                />
              </Field>
              <TextAreaField
                label="互动风格"
                value={form.interactionStyle}
                onChange={(value) => setForm({ ...form, interactionStyle: value })}
              />
              <TextAreaField
                label="关系摘要"
                value={form.summary}
                onChange={(value) => setForm({ ...form, summary: value })}
              />
              <TextAreaField
                label="最近信号"
                value={form.recentSignal}
                onChange={(value) => setForm({ ...form, recentSignal: value })}
              />
              <TextAreaField
                label="备注"
                value={form.statusNote}
                onChange={(value) => setForm({ ...form, statusNote: value })}
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
                        <span className="rounded-full border border-[var(--ls-border-cold)] bg-white px-2 py-0.5 text-xs text-[var(--ls-ink-soft)]">
                          {Math.round(proposal.confidence * 100)}%
                        </span>
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
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">关系变更</h3>
                <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                  最近 20 条程序或 admin 写入记录。左侧按类型筛选，摘要完整展示，不再混成一串。
                </p>
              </div>
              <div className="rounded-full bg-[var(--ls-panel-soft)] px-3 py-1 text-xs font-medium text-[var(--ls-ink-soft)]">
                {pageState.events.length} 条记录
              </div>
            </div>
            {eventTypeOptions.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {eventTypeOptions.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setEventTypeFilter(option.type)}
                    className={`admin-pill-button rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      eventTypeFilter === option.type ? "is-active" : ""
                    }`}
                  >
                    {option.label} {option.count}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
              {pageState.events.length > 0 ? (
                <>
                  <div className="grid gap-4 self-start">
                    {groupedEvents.length > 0 ? (
                      groupedEvents.map((group) => (
                        <div
                          key={group.type}
                          className="overflow-hidden rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)]"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--ls-border)] bg-white px-4 py-3">
                            <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                              {eventTypeLabel(group.type)}
                            </div>
                            <div className="rounded-full bg-[var(--ls-panel-soft)] px-2.5 py-1 text-xs text-[var(--ls-ink-soft)]">
                              {group.events.length} 条
                            </div>
                          </div>
                          <div className="divide-y divide-[var(--ls-border)]">
                            {group.events.map((event) => {
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
                                    <span className="rounded-full border border-[var(--ls-border)] bg-white px-2.5 py-1 font-semibold text-[var(--ls-ink-strong)]">
                                      {event.source ?? "unknown"}
                                    </span>
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
                      ))
                    ) : (
                      <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
                        当前筛选下没有关系变更。
                      </div>
                    )}
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
    </div>
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
function relationshipLabelTone(label: string): { bg: string; text: string; border: string } {
  const s = label ?? "";
  if (/(熟悉|老朋友|老熟|亲近|信任)/.test(s)) {
    return { bg: "var(--ls-mint-soft)", text: "var(--ls-mint-text)", border: "var(--ls-success-border-soft)" };
  }
  if (/(认识|初次|刚开始|新建|刚)/.test(s)) {
    return { bg: "var(--ls-panel-cold)", text: "var(--ls-info-text)", border: "var(--ls-border-cold-soft)" };
  }
  if (/(陌生|未形成|未知|未确认)/.test(s)) {
    return { bg: "var(--ls-panel-soft)", text: "var(--ls-ink-soft)", border: "var(--ls-border)" };
  }
  return { bg: "var(--ls-warning-bg)", text: "var(--ls-warning-text-strong)", border: "var(--ls-warning-border)" };
}
