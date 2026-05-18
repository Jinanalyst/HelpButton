// Helpers for saving live chat sessions into the shared history store.
// A chat session is one HistoryItem (kind: 'chat') whose chat.turns grow over time.

import { upsertHistory } from './storage';
import type { ChatSession, HistoryItem, RiskLevel } from './types';

function titleFrom(session: ChatSession): string {
  const firstUser = session.turns.find((t) => t.role === 'user');
  if (!firstUser) return '대화';
  const head = firstUser.content.trim().replace(/\s+/g, ' ');
  return head.length > 24 ? head.slice(0, 24) + '…' : head;
}

function highestRisk(session: ChatSession): RiskLevel {
  const order: RiskLevel[] = ['none', 'low', 'medium', 'high'];
  let max: RiskLevel = 'none';
  for (const t of session.turns) {
    if (t.risk && order.indexOf(t.risk) > order.indexOf(max)) max = t.risk;
  }
  return max;
}

export function saveChatSession(session: ChatSession): void {
  if (session.turns.length === 0) return;
  const firstUser = session.turns.find((t) => t.role === 'user');
  const item: HistoryItem = {
    id: session.id,
    timestamp: session.startedAt,
    transcript: firstUser?.content ?? '',
    intent: 'unknown',
    risk_level: highestRisk(session),
    title: titleFrom(session),
    kind: 'chat',
    chat: session,
  };
  upsertHistory(item);
}

export function newSession(): ChatSession {
  const now = Date.now();
  return {
    id: `chat-${now}`,
    startedAt: now,
    updatedAt: now,
    turns: [],
  };
}
