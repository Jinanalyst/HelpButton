// Vercel serverless function — runs on Node 22.
// Lives at /api/chat. Free-form Korean conversation for senior users.
//
// Differs from /api/classify:
// - Multi-turn: accepts message history.
// - Plain-text reply (no JSON schema). Short, spoken-friendly Korean.
// - Refuses unsafe operations (송금/결제/OTP/비밀번호 등). When the user clearly
//   wants a real-world action (전화/문자/문자 삭제 등), it surfaces a structured
//   `action` hint the client can render as a tappable card.

import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'nodejs' };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

const client = new Anthropic();

// Stable — do not interpolate timestamps/IDs (prompt cache key).
const SYSTEM_PROMPT = `당신은 "헬프버튼"입니다. 한국의 시니어 사용자와 음성으로 대화합니다. 사용자가 한 말을 한국어 텍스트로 받으면, 짧고 다정한 한국어로 대답합니다.

[대화 원칙]
1. 시니어가 한 번에 알아듣도록 1~3문장으로 짧게 답합니다. 외래어/전문용어는 풀어 씁니다.
2. 듣기 좋게 말하듯 적습니다. 마침표/쉼표를 자연스럽게 사용합니다.
3. 사용자가 같은 말을 반복하거나 흐름이 끊겨도 다정하게 다시 묻습니다.
4. 모르면 솔직히 모른다고 답하고, 가족에게 물어보도록 권합니다.

[안전 규칙 — 반드시 지킬 것]
다음 요청은 절대 직접 도와주지 마세요. 대신 "이건 가족과 함께 확인하세요"로 부드럽게 안내하세요:
- 은행 송금, 결제, 카드번호, 계좌번호 입력
- 비밀번호, 인증번호(OTP), 주민등록번호, 공동인증서
- 모르는 사람에게 돈 보내기, 모르는 링크 누르기
- 보이스피싱이 의심되는 문자/전화 (가짜 검찰, 가짜 택배, 가짜 은행)
이런 신호가 보이면 risk를 'high'로, action을 'call_family'로 제안하세요.

[행동 안내 — action 필드]
대답에 함께 다음 중 하나의 행동을 권유할 수 있습니다(필요할 때만, 자연스러울 때만):
- "call_family": 등록된 보호자에게 전화
- "send_message_family": 등록된 보호자에게 문자 (message에 짧은 초안 작성)
- "open_dialer": 일반 번호로 전화 다이얼러 열기 (phone 필드에 번호)
- "open_sms": 일반 번호로 문자 작성 화면 열기 (phone, message)
- "show_step_guide": 폰 사용법 단계 안내 (steps에 1줄씩)
- "none": 행동 권유 없음
행동은 사용자가 명확히 원할 때만 제안합니다. 어색하면 그냥 "none"으로 두세요.

[출력 형식]
반드시 다음 JSON만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "reply": "사용자에게 말로 들려줄 한국어 답변 (1~3문장)",
  "risk": "none" | "low" | "medium" | "high",
  "action": {
    "kind": "call_family" | "send_message_family" | "open_dialer" | "open_sms" | "show_step_guide" | "none",
    "label": "버튼에 보일 짧은 한국어",
    "phone": "010-...." | null,
    "message": "문자 초안" | null,
    "steps": ["1단계", "2단계"] | null,
    "confirm_prompt": "행동 전에 한 번 더 묻는 짧은 문장"
  } | null
}`;

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    action: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'call_family',
                'send_message_family',
                'open_dialer',
                'open_sms',
                'show_step_guide',
                'none',
              ],
            },
            label: { type: 'string' },
            phone: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            message: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            steps: {
              anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }],
            },
            confirm_prompt: { type: 'string' },
          },
          required: ['kind', 'label', 'phone', 'message', 'steps', 'confirm_prompt'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['reply', 'risk', 'action'],
  additionalProperties: false,
} as const;

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body: { messages?: unknown; family?: { name?: string; relation?: string; phone?: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const messages = Array.isArray(body.messages)
    ? (body.messages as IncomingMessage[]).filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0,
      )
    : [];

  if (messages.length === 0) return json({ error: 'messages_required' }, 400);
  if (messages.length > 40) return json({ error: 'too_many_messages' }, 400);

  // Soft length guard against pathological inputs.
  for (const m of messages) {
    if (m.content.length > 2000) return json({ error: 'message_too_long' }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'api_key_missing' }, 500);

  const familyHint = body.family
    ? `\n\n[등록된 보호자]\n이름: ${body.family.name || '미등록'} / 관계: ${body.family.relation || '보호자'} / 전화: ${body.family.phone || '미등록'}`
    : '';

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: familyHint || ' ',
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;

    if (!textBlock) {
      return json({ error: 'no_text_response', stop_reason: response.stop_reason }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json({ error: 'invalid_model_json', raw: textBlock.text.slice(0, 500) }, 502);
    }

    return json(
      {
        result: parsed,
        meta: {
          model: response.model,
          stop_reason: response.stop_reason,
          usage: response.usage,
        },
      },
      200,
    );
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'auth_failed' }, 401);
    if (err instanceof Anthropic.APIError) {
      return json({ error: 'upstream_error', status: err.status, detail: err.message }, 502);
    }
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'unknown_error', detail: message }, 500);
  }
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}
