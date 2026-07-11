export interface HomeAssistantState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

export interface HomeAssistantServiceCallInput {
  domain: string;
  action: string;
  target?: Record<string, unknown>;
  data?: Record<string, unknown>;
}
