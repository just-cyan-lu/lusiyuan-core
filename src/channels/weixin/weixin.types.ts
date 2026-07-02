export interface WeixinIncomingBody {
  external_user_id?: string;
  external_conversation_id?: string;
  external_message_id?: string;
  client_message_id?: string;
  sender_name?: string;
  conversation_name?: string;
  display_name?: string;
  captured_at?: string;
  text: string;
  raw?: unknown;
}
