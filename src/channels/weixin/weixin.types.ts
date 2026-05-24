export interface WeixinIncomingBody {
  external_user_id: string;
  external_conversation_id: string;
  external_message_id?: string;
  display_name?: string;
  text: string;
  raw?: unknown;
}
