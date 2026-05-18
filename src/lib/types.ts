// Shared types between the React app and the /api/classify response.
// Keep in sync with api/classify.ts SCHEMA.

export type Intent =
  | 'scam_check'
  | 'family_call'
  | 'help_message'
  | 'phone_guide'
  | 'unsafe_request'
  | 'unknown';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ActionKind =
  | 'call_family'
  | 'send_message_family'
  | 'delete_message'
  | 'open_setting'
  | 'show_step_guide'
  | 'ignore'
  | 'ask_again';

export type ActionTone = 'primary' | 'danger' | 'ghost';

export interface SuggestedAction {
  kind: ActionKind;
  label: string;
  message_template: string | null;
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
}

export type Plan = 'free' | 'safe_annual' | 'premium_annual';

export interface Subscription {
  plan: Plan;
  renewsAt?: number;
}
