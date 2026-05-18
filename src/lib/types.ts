// Shared types between the React app and the /api/classify response.
// Keep in sync with api/classify.ts SCHEMA.

export type Intent =
  | 'scam_check'
  | 'family_call'
  | 'help_message'
  | 'phone_guide'
  | 'navigation'
  | 'unsafe_request'
  | 'unknown';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ActionKind =
  | 'call_family'
  | 'send_message_family'
  | 'delete_message'
  | 'open_setting'
  | 'show_step_guide'
  | 'open_map'
  | 'ignore'
  | 'ask_again';

export type ActionTone = 'primary' | 'danger' | 'ghost';

export interface SuggestedAction {
  kind: ActionKind;
  label: string;
  message_template: string | null;
  // For 'open_map': free-form Korean destination (e.g. "가까운 약국", "서울대병원", "집").
  destination: string | null;
  confirm_prompt: string;
  tone: ActionTone;
}

export interface ClassifyResult {
  intent: Intent;
  risk_level: RiskLevel;
  title: string;
  explanation: string;
  why_dangerous: string[];
  transcript_echo: string;
  suggested_actions: SuggestedAction[];
  safety_note: string;
}

export interface ClassifyEnvelope {
  result: ClassifyResult;
  meta?: {
    model?: string;
    stop_reason?: string;
    usage?: unknown;
  };
}

// ---- Local state shapes ----

export interface FamilyContact {
  name: string;
  relation: string; // 큰아들, 딸, etc.
  phone: string;
}

export interface Settings {
  fontScale: 'normal' | 'large' | 'xlarge';
  voiceVolume: 'low' | 'normal' | 'loud';
  autoFamilyAlert: boolean;
  confirmBeforeCall: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  transcript: string;
  intent: Intent;
  risk_level: RiskLevel;
  title: string;
  outcome?: string; // e.g. "가족에게 알림", "삭제 안내"
  result?: ClassifyResult; // full AI response, used by the chat-style detail view
  // Present for kind === 'chat' entries. A full multi-turn conversation log.
  chat?: ChatSession;
  kind?: 'classify' | 'chat'; // defaults to 'classify' for legacy items
}

// ---- Chat session ----

export type ChatActionKind =
  | 'call_family'
  | 'send_message_family'
  | 'open_dialer'
  | 'open_sms'
  | 'open_map'
  | 'show_step_guide'
  | 'none';

export interface ChatAction {
  kind: ChatActionKind;
  label: string;
  phone: string | null;
  message: string | null;
  steps: string[] | null;
  // For 'open_map': free-form Korean destination.
  destination: string | null;
  confirm_prompt: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  risk?: RiskLevel;
  action?: ChatAction | null;
}

export interface ChatSession {
  id: string;
  startedAt: number;
  updatedAt: number;
  turns: ChatTurn[];
}

export interface ChatReply {
  reply: string;
  risk: RiskLevel;
  action: ChatAction | null;
}

export interface ChatEnvelope {
  result: ChatReply;
  meta?: {
    model?: string;
    stop_reason?: string;
    usage?: unknown;
  };
}

export type Plan = 'free' | 'safe_annual' | 'premium_annual';

export interface Subscription {
  plan: Plan;
  renewsAt?: number;
}
