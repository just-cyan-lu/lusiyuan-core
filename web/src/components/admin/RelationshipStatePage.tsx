import { useEffect, useMemo, useState, type ReactNode } from "react";
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

interface RelationshipStatePageProps {
  adminToken: string;
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

function linkedUsersText(relationship: RelationshipState): string {
  const links = relationship.person?.identityLinks ?? [];
  if (links.length === 0) return "暂无绑定账号";
  return links
    .map((link) => link.user.displayName ?? link.user.externalId)
    .join(" / ");
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

export function RelationshipStatePage({ adminToken }: RelationshipStatePageProps) {
  const [query, setQuery] = useState("");
  const [linkUserId, setLinkUserId] = useState("");
  const [form, setForm] = useState<RelationshipForm | null>(null);
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
      const selectedId = preferredId ?? pageState.selected?.id ?? data.relationships[0]?.id;
      const selected = selectedId
        ? data.relationships.find((relationship) => relationship.id === selectedId) ??
          data.relationships[0] ??
          null
        : null;
      let events: RelationshipStateEvent[] = [];
      let detailRelationship = selected;
      if (selected) {
        const detail = await fetchRelationshipDetail({
          token: adminToken,
          relationshipId: selected.id,
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
    void loadList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const dirty = useMemo(() => {
    if (!pageState.selected || !form) return false;
    return (
      JSON.stringify(formFromRelationship(pageState.selected)) !==
      JSON.stringify(form)
    );
  }, [pageState.selected, form]);

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
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">关系状态</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              每个现实身份一份关系状态。聊天会先沉淀成关系信号，复盘后再更新关系；疑似同一人的线索会提交给 admin 审核。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadList()}
              className="rounded-lg border border-[#c9d6e5] bg-white px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff]"
            >
              刷新
            </button>
            <button
              type="button"
              disabled={!dirty || pageState.saving}
              onClick={() => void saveRelationship()}
              className="rounded-lg bg-[#6f8fb8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5f7fa7] disabled:cursor-not-allowed disabled:bg-[#b9c7d8]"
            >
              {pageState.saving ? "保存中" : "保存"}
            </button>
            <button
              type="button"
              disabled={!pageState.selected || pageState.saving}
              onClick={() => void reviewSelectedRelationship()}
              className="rounded-lg border border-[#c9d6e5] bg-[#f8fbff] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              复盘
            </button>
            <button
              type="button"
              disabled={!pageState.selected || pageState.saving}
              onClick={() => void resetSelectedRelationship()}
              className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-2 text-sm font-medium text-[#8d6048] transition hover:bg-[#fff0e8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              重置
            </button>
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
                  <div className="mt-1 truncate text-xs text-[#7b8ca2]">
                    已有身份账号：{proposalTargetUsersText(proposal)}
                  </div>
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={pageState.saving}
                    onClick={() => void reviewIdentityProposal(proposal.id, "approve")}
                    className="rounded-lg bg-[#6f8fb8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5f7fa7] disabled:cursor-not-allowed disabled:bg-[#b9c7d8]"
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    disabled={pageState.saving}
                    onClick={() => void reviewIdentityProposal(proposal.id, "reject")}
                    className="rounded-lg border border-[#c9d6e5] bg-white px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    忽略
                  </button>
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

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-base font-semibold text-[#172033]">用户关系</h3>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadList(query);
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索用户或摘要"
                className="field-input h-10 min-w-0"
              />
              <button
                type="submit"
                className="rounded-lg border border-[#c9d6e5] bg-[#f8fbff] px-3 text-sm text-[#334155]"
              >
                搜索
              </button>
            </form>
          </div>

          <div className="mt-4 grid gap-3">
            {pageState.relationships.length > 0 ? (
              pageState.relationships.map((relationship) => {
                const active = pageState.selected?.id === relationship.id;
                return (
                  <button
                    key={relationship.id}
                    type="button"
                    onClick={() => void selectRelationship(relationship.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#a9bfd7] bg-[#eaf2fb]"
                        : "border-[#d9e2ec] bg-[#f8fbff] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#172033]">
                          {userLabel(relationship)}
                        </div>
                        <div className="mt-1 text-xs text-[#7b8ca2]">
                          {relationship.relationshipLabel}
                        </div>
                        <div className="mt-1 truncate text-xs text-[#7b8ca2]">
                          {linkedUsersText(relationship)}
                        </div>
                      </div>
                      <div className="text-xs text-[#7b8ca2]">
                        {formatDate(relationship.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-[#66758a]">
                      <MiniMetric label="熟" value={relationship.familiarity} />
                      <MiniMetric label="信" value={relationship.trust} />
                      <MiniMetric label="近" value={relationship.closeness} />
                      <MiniMetric label="张" value={relationship.tension} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                {pageState.loading ? "正在读取关系状态..." : "暂无关系状态。用户聊天后会自动创建。"}
              </div>
            )}
          </div>
        </div>

        {pageState.selected && form ? (
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
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#334155]">
                  {pageState.selected.relationshipLabel}
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
              <div className="mt-4 grid gap-4">
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
                  <div className="text-xs font-semibold text-[#7b8ca2]">绑定其他渠道账号</div>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row">
                    <input
                      className="field-input"
                      value={linkUserId}
                      onChange={(event) => setLinkUserId(event.target.value)}
                      placeholder="User externalId / id，例如 telegram:123"
                    />
                    <button
                      type="button"
                      disabled={!linkUserId.trim() || pageState.saving}
                      onClick={() => void linkUserToSelectedPerson()}
                      className="rounded-lg bg-[#6f8fb8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5f7fa7] disabled:cursor-not-allowed disabled:bg-[#b9c7d8]"
                    >
                      绑定
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-[#7b8ca2]">
                    只有明确确认是同一个现实用户时再绑定。绑定后多个渠道会共用这一份关系状态。
                  </p>
                </div>
                <Field label="关系标签">
                  <input
                    className="field-input"
                    value={form.relationshipLabel}
                    onChange={(event) =>
                      setForm({ ...form, relationshipLabel: event.target.value })
                    }
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
              <h3 className="text-base font-semibold text-[#172033]">关系变更</h3>
              <p className="mt-1 text-xs text-[#7b8ca2]">最近 20 条程序或 admin 写入记录</p>
              <div className="mt-4 grid gap-3">
                {pageState.events.length > 0 ? (
                  pageState.events.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-3 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 md:grid-cols-[8rem_1fr_10rem]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#172033]">
                          {eventTypeLabel(event.eventType)}
                        </div>
                        <div className="mt-1 text-xs text-[#7b8ca2]">
                          {event.source ?? "unknown"}
                        </div>
                      </div>
                      <div className="text-sm leading-6 text-[#334155]">{event.summary}</div>
                      <div className="text-xs text-[#7b8ca2] md:text-right">
                        {formatDate(event.createdAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                    暂无关系变更。
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-lg border border-[#d9e2ec] bg-white px-5 py-8 text-sm text-[#7b8ca2]">
            选择一个用户关系后查看详情。
          </div>
        )}
      </section>
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-2 py-1">
      <div>{label}</div>
      <div className="mt-0.5 font-semibold text-[#172033]">{value}</div>
    </div>
  );
}
