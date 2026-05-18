// Client-side wrapper for /api/chat.
// Never fabricates replies — if the server is unreachable, we throw a typed
// error and let the UI show a clear "지금 연결이 어려워요" message. Fake
// AI responses are dangerous for senior users who may act on them.

import type {
  ChatAction,
  ChatEnvelope,
  ChatReply,
  ChatTurn,
  FamilyContact,
} from './types';

const ENDPOINT = '/api/chat';

export type ChatErrorReason = 'offline' | 'server' | 'rate_limited' | 'unknown';

export class ChatUnavailableError extends Error {
  readonly reason: ChatErrorReason;
  constructor(reason: ChatErrorReason) {
    super(`chat_unavailable:${reason}`);
    this.name = 'ChatUnavailableError';
    this.reason = reason;
  }
}

export async function chat(
  turns: ChatTurn[],
  family: FamilyContact,
): Promise<ChatReply> {
  const messages = turns.map((t) => ({ role: t.role, content: t.content }));
  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, family }),
    });
  } catch {
    throw new ChatUnavailableError('offline');
  }

  if (!resp.ok) {
    if (resp.status === 429) throw new ChatUnavailableError('rate_limited');
    if (resp.status >= 500 || resp.status === 404) throw new ChatUnavailableError('server');
    throw new ChatUnavailableError('unknown');
  }

  const payload = (await resp.json()) as ChatEnvelope;
  if (!payload?.result) throw new ChatUnavailableError('server');
  return payload.result;
}

// ---- Action execution (tel: / sms: URIs) ----

export function runChatAction(action: ChatAction): void {
  switch (action.kind) {
    case 'call_family':
    case 'open_dialer': {
      if (action.phone) window.location.href = `tel:${sanitizePhone(action.phone)}`;
      return;
    }
    case 'send_message_family':
    case 'open_sms': {
      if (!action.phone) return;
      const body = action.message ? `?body=${encodeURIComponent(action.message)}` : '';
      window.location.href = `sms:${sanitizePhone(action.phone)}${body}`;
      return;
    }
    case 'show_step_guide':
    case 'none':
    default:
      return;
  }
}

function sanitizePhone(p: string): string {
  return p.replace(/[^\d+]/g, '');
}
