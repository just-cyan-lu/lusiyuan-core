export interface MemoryProposalPersonResolutionInput {
  id: string;
  scope: string;
  reportId: string;
  personId?: string | null;
  conversationId?: string | null;
  targetMemoryId?: string | null;
  sourceMessageIds?: unknown;
}

export interface MemoryProposalPersonLookup {
  findTargetMemoryPersonId(memoryId: string): Promise<string | null>;
  findSourceMessagePersonId(messageIds: string[]): Promise<string | null>;
  findReportJobScope(reportId: string): Promise<{
    userId: string | null;
    conversationId: string | null;
  } | null>;
  findPersonId(id: string): Promise<string | null>;
  findUserPersonId(idOrExternalId: string): Promise<string | null>;
  findConversationPersonId(idOrExternalId: string): Promise<string | null>;
}

export function memoryProposalRequiresPerson(scope: string): boolean {
  return scope === "person";
}

export function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function resolveMemoryProposalPersonId(
  proposal: MemoryProposalPersonResolutionInput,
  lookup: MemoryProposalPersonLookup
): Promise<string | null> {
  if (!memoryProposalRequiresPerson(proposal.scope)) {
    return null;
  }

  if (proposal.personId) {
    const proposalPersonId = await lookup.findPersonId(proposal.personId);
    if (proposalPersonId) return proposalPersonId;
  }

  if (proposal.targetMemoryId) {
    const targetPersonId = await lookup.findTargetMemoryPersonId(proposal.targetMemoryId);
    if (targetPersonId) return targetPersonId;
  }

  if (proposal.conversationId) {
    const proposalConversationPersonId = await lookup.findConversationPersonId(
      proposal.conversationId
    );
    if (proposalConversationPersonId) return proposalConversationPersonId;
  }

  const sourceMessageIds = getStringArray(proposal.sourceMessageIds);
  if (sourceMessageIds.length > 0) {
    const sourcePersonId = await lookup.findSourceMessagePersonId(sourceMessageIds);
    if (sourcePersonId) return sourcePersonId;
  }

  const jobScope = await lookup.findReportJobScope(proposal.reportId);
  if (jobScope?.userId) {
    const jobPersonId = await lookup.findUserPersonId(jobScope.userId);
    if (jobPersonId) return jobPersonId;
  }

  if (jobScope?.conversationId) {
    const conversationPersonId = await lookup.findConversationPersonId(jobScope.conversationId);
    if (conversationPersonId) return conversationPersonId;
  }

  throw new Error(
    `Cannot resolve personId for ${proposal.scope} memory proposal ${proposal.id}`
  );
}
