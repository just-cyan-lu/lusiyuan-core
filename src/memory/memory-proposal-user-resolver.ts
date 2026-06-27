export interface MemoryProposalUserResolutionInput {
  id: string;
  scope: string;
  reportId: string;
  userId?: string | null;
  conversationId?: string | null;
  channel?: string | null;
  targetMemoryId?: string | null;
  sourceMessageIds?: unknown;
}

export interface MemoryProposalUserLookup {
  findTargetMemoryUserId(memoryId: string): Promise<string | null>;
  findSourceMessageUserId(messageIds: string[]): Promise<string | null>;
  findReportJobScope(reportId: string): Promise<{
    userId: string | null;
    conversationId: string | null;
  } | null>;
  findUserInternalId(idOrExternalId: string): Promise<string | null>;
  findConversationUserId(idOrExternalId: string): Promise<string | null>;
}

export function memoryProposalRequiresUser(scope: string): boolean {
  return scope === "user";
}

export function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function resolveMemoryProposalUserId(
  proposal: MemoryProposalUserResolutionInput,
  lookup: MemoryProposalUserLookup
): Promise<string | null> {
  if (!memoryProposalRequiresUser(proposal.scope)) {
    return null;
  }

  if (proposal.userId) {
    const proposalUserId = await lookup.findUserInternalId(proposal.userId);
    if (proposalUserId) return proposalUserId;
  }

  if (proposal.conversationId) {
    const proposalConversationUserId = await lookup.findConversationUserId(
      proposal.conversationId
    );
    if (proposalConversationUserId) return proposalConversationUserId;
  }

  if (proposal.targetMemoryId) {
    const targetUserId = await lookup.findTargetMemoryUserId(proposal.targetMemoryId);
    if (targetUserId) return targetUserId;
  }

  const sourceMessageIds = getStringArray(proposal.sourceMessageIds);
  if (sourceMessageIds.length > 0) {
    const sourceUserId = await lookup.findSourceMessageUserId(sourceMessageIds);
    if (sourceUserId) return sourceUserId;
  }

  const jobScope = await lookup.findReportJobScope(proposal.reportId);
  if (jobScope?.userId) {
    const jobUserId = await lookup.findUserInternalId(jobScope.userId);
    if (jobUserId) return jobUserId;
  }

  if (jobScope?.conversationId) {
    const conversationUserId = await lookup.findConversationUserId(jobScope.conversationId);
    if (conversationUserId) return conversationUserId;
  }

  throw new Error(
    `Cannot resolve userId for ${proposal.scope} memory proposal ${proposal.id}`
  );
}
