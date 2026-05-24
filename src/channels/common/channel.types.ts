export type Channel = "web" | "api" | "telegram" | "weixin";

export interface NormalizedIncomingMessage {
  channel: Channel;
  externalUserId: string;
  externalConversationId: string;
  externalMessageId?: string;
  displayName?: string;
  text: string;
  raw?: unknown;
}

export interface ChannelAdapter<TIncoming = unknown> {
  normalizeIncoming(input: TIncoming): NormalizedIncomingMessage;
}

export function toChatInput(msg: NormalizedIncomingMessage) {
  return {
    user_id: `${msg.channel}:${msg.externalUserId}`,
    channel: msg.channel,
    conversation_id: `${msg.channel}:${msg.externalConversationId}`,
    message: msg.text,
    external_message_id: msg.externalMessageId,
    display_name: msg.displayName,
    raw_event: msg.raw,
  };
}
