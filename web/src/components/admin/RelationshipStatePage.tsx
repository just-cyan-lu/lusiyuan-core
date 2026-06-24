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
  reviewRelationshipState,
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
  familiarity: number;
  trust: number;
  closeness: number;
  tension: number;
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
  return relationship.person?.label ?? primaryUserLabel(relationship) ?? relationship.personId;
}

function primaryUserLabel(relationship: RelationshipState): string | null {
  const user = relationship.person?.identityLinks[0]?.user;
  return user?.displayName ?? user?.externalId ?? null;
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
    familiarity: relationship.familiarity,
    trust: relationship.trust,
    closeness: relationship.closeness,
    tension: relationship.tension,
    interactionStyle: relationship.interactionStyle ?? "",
    summary: relationship.summary ?? "",
    recentSignal: relationship.recentSignal ?? "",
    statusNote: relationship.statusNote ?? "",
  };
}

function eventTypeLabel(type: string): string {
  if (type === "chat_relationship_signal") return "关系信号";
  if (type === "chat_relationship_update") return "聊天更新";
  if (type === "relationship_review_update") return "关系复盘";
  if (type === "manual_update") return "手动调整";
  if (type === "reset") return "重置";
  if (type === "identity_merge") return "身份合并";
  if (type === "identity_link_added") return "身份绑定";
  return type;
}

const relationshipFieldLabels: Record<string, string> = {
  relationshipLabel: "关系标签",
  familiarity: "熟悉度",
  trust: "信任度",
  closeness: "亲近感",
  tension: "关系张力",
  interactionStyle: "互动风格",
  summary: "关系摘要",
  recentSignal: "最近信号",
  statusNote: "备注",
  lastInteractionAt: "最近互动",
  metadata: "关系细节",
  deltas: "变化量",
  counts: "统计",
  signal: "关系信号",
  proposedPatch: "LLM 提议",
  lastRelationshipReview: "最近关系复盘",
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

  async function reviewSelectedRelationship() {
    if (!adminToken || !pageState.selected) return;
    setPageState((current) => ({ ...current, saving: true, error: null, message: null }));
    try {
      const detail = await reviewRelationshipState({
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
        message: "关系复盘已完成。",
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
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Relationship State</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">关系状态</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。这里会显示陆思源和每个现实身份之间的熟悉度、信任度、亲近感和关系张力。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Relationship State</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">
              {selectedRelationshipId ? "关系详情" : "关系状态"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
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
                  disabled={!pageState.selected || pageState.saving}
                  onClick={() => void reviewSelectedRelationship()}
                >
                  复盘
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

        {pageState.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {pageState.error}
          </div>
        )}
        {pageState.message && (
          <div className="mt-5 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
            {pageState.message}
          </div>
        )}
      </section>

      {!selectedRelationshipId ? (
        <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#172033]">用户关系</h3>
              <p className="mt-1 text-xs text-[#7b8ca2]">
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

          <div className="mt-4 overflow-hidden rounded-lg border border-[#d9e2ec]">
            <div className="hidden grid-cols-[minmax(15rem,1.05fr)_minmax(18rem,1.45fr)_repeat(4,4.5rem)_minmax(8rem,0.75fr)_2rem] items-center gap-3 bg-[#f8fbff] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#7b8ca2] lg:grid">
              <div>用户</div>
              <div>主要内容</div>
              <div className="text-center">熟悉</div>
              <div className="text-center">信任</div>
              <div className="text-center">亲近</div>
              <div className="text-center">张力</div>
              <div>最近更新</div>
              <div />
            </div>
            {pageState.relationships.length > 0 ? (
              pageState.relationships.map((relationship) => (
                <button
                  key={relationship.id}
                  type="button"
                  onClick={() => void selectRelationship(relationship.id)}
                  className="admin-layout-button grid w-full gap-3 border-t border-[#edf2f7] bg-white px-4 py-4 text-left transition first:border-t-0 hover:bg-[#f8fbff] lg:grid-cols-[minmax(15rem,1.05fr)_minmax(18rem,1.45fr)_repeat(4,4.5rem)_minmax(8rem,0.75fr)_2rem] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold text-[#172033]">
                        {userLabel(relationship)}
                      </span>
                      <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs font-medium text-[#334155]">
                        {relationship.relationshipLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#66758a]">
                      {(relationship.person?.identityLinks ?? []).length > 0 ? (
                        relationship.person?.identityLinks.map((link) => (
                          <span
                            key={link.id}
                            className="rounded-full bg-[#f3f7fb] px-2.5 py-1"
                          >
                            {link.user.displayName ?? link.user.externalId}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-[#f3f7fb] px-2.5 py-1">
                          暂无绑定账号
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 text-sm leading-6 text-[#334155]">
                    {relationshipSummaryText(relationship)}
                  </div>
                  <div className="grid grid-cols-4 gap-2 lg:contents">
                    <RelationshipScoreCell label="熟悉" value={relationship.familiarity} />
                    <RelationshipScoreCell label="信任" value={relationship.trust} />
                    <RelationshipScoreCell label="亲近" value={relationship.closeness} />
                    <RelationshipScoreCell
                      label="张力"
                      value={relationship.tension}
                      dangerHigh
                    />
                  </div>
                  <div className="text-xs leading-5 text-[#7b8ca2]">
                    {formatDate(relationship.lastInteractionAt ?? relationship.updatedAt)}
                  </div>
                  <div className="hidden text-right text-xl font-semibold text-[#b8c7d8] lg:block">
                    ›
                  </div>
                </button>
              ))
            ) : (
              <div className="bg-[#f8fbff] px-4 py-8 text-sm text-[#7b8ca2]">
                {pageState.loading ? "正在读取关系状态..." : "暂无关系状态。用户聊天后会自动创建。"}
              </div>
            )}
          </div>
        </section>
      ) : pageState.selected && form ? (
        <div className="space-y-5">
          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-[#7b8ca2]">当前用户</div>
                <div className="mt-2 text-2xl font-semibold text-[#172033]">
                  {userLabel(pageState.selected)}
                </div>
                <div className="mt-2 text-sm text-[#617188]">
                  Person ID: {pageState.selected.personId}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(pageState.selected.person?.identityLinks ?? []).map((link) => (
                    <span
                      key={link.id}
                      className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-3 py-1 text-xs text-[#334155]"
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
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#334155]">
                  {pageState.selected.relationshipLabel}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <MetricSlider
                label="熟悉度"
                value={form.familiarity}
                onChange={(value) => setForm({ ...form, familiarity: value })}
              />
              <MetricSlider
                label="信任度"
                value={form.trust}
                onChange={(value) => setForm({ ...form, trust: value })}
              />
              <MetricSlider
                label="亲近感"
                value={form.closeness}
                onChange={(value) => setForm({ ...form, closeness: value })}
              />
              <MetricSlider
                label="关系张力"
                value={form.tension}
                dangerHigh
                onChange={(value) => setForm({ ...form, tension: value })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <h3 className="text-base font-semibold text-[#172033]">详情与修正</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4 lg:col-span-2">
                <div className="text-xs font-semibold text-[#7b8ca2]">绑定其他渠道账号</div>
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
                <p className="mt-2 text-xs leading-6 text-[#7b8ca2]">
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

          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#172033]">身份怀疑</h3>
                <p className="mt-1 text-xs leading-6 text-[#7b8ca2]">
                  系统只会怀疑，不会自动确认。通过后才会把渠道账号合并到同一个现实身份。
                </p>
              </div>
              <div className="rounded-full bg-[#f8fbff] px-3 py-1 text-xs font-medium text-[#66758a]">
                {pageState.proposals.length} 条待审核
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {pageState.proposals.length > 0 ? (
                pageState.proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="grid gap-4 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-4 lg:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#172033]">
                          {proposalUserLabel(proposal.sourceUser)}
                        </span>
                        <span className="text-xs text-[#7b8ca2]">可能是</span>
                        <span className="text-sm font-semibold text-[#172033]">
                          {proposalTargetLabel(proposal)}
                        </span>
                        <span className="rounded-full border border-[#c9d6e5] bg-white px-2 py-0.5 text-xs text-[#66758a]">
                          {Math.round(proposal.confidence * 100)}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs leading-6 text-[#617188]">
                        {proposal.reason}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-[#7b8ca2]">
                        {proposalEvidenceText(proposal) || "暂无详细证据。"}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-[#7b8ca2]">
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
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                  暂无待审核的身份怀疑。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#172033]">关系变更</h3>
                <p className="mt-1 text-xs leading-6 text-[#7b8ca2]">
                  最近 20 条程序或 admin 写入记录。左侧按类型筛选，摘要完整展示，不再混成一串。
                </p>
              </div>
              <div className="rounded-full bg-[#f8fbff] px-3 py-1 text-xs font-medium text-[#66758a]">
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
                          className="overflow-hidden rounded-lg border border-[#d9e2ec] bg-[#f8fbff]"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-[#d9e2ec] bg-white px-4 py-3">
                            <div className="text-sm font-semibold text-[#172033]">
                              {eventTypeLabel(group.type)}
                            </div>
                            <div className="rounded-full bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]">
                              {group.events.length} 条
                            </div>
                          </div>
                          <div className="divide-y divide-[#d9e2ec]">
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
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#7b8ca2]">
                                    <span className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 font-semibold text-[#334155]">
                                      {event.source ?? "unknown"}
                                    </span>
                                    {event.channel && <span>渠道：{event.channel}</span>}
                                    <span>{formatDate(event.createdAt)}</span>
                                  </div>
                                  <div className="mt-2 break-words text-sm leading-6 text-[#334155]">
                                    {event.summary || "这条记录没有摘要。"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
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
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2] xl:col-span-2">
                  暂无关系变更。
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-lg border border-[#d9e2ec] bg-white px-5 py-8 text-sm text-[#7b8ca2]">
          {pageState.loading ? "正在读取关系详情..." : "没有找到这条关系状态。"}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
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
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
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
    <label className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[#7b8ca2]">
        <span>{label}</span>
        <span className="text-[#172033]">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-3 w-full ${strong ? "accent-[#6aa47e]" : "accent-[#c48a6a]"}`}
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
  return (
    <div className="rounded-md border border-[#e2e8f0] bg-[#f8fbff] px-2 py-2 text-center lg:border-transparent lg:bg-transparent lg:px-0">
      <div className="text-[10px] font-semibold text-[#7b8ca2] lg:hidden">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${good ? "text-[#3f7b5d]" : "text-[#9a6048]"}`}>
        {value}
      </div>
    </div>
  );
}
