// Vercel serverless function — runs on Node 22.
// Lives at /api/classify. Receives a Korean voice transcript from a senior user,
// asks Claude Opus 4.7 to classify intent + assess scam risk, and returns a
// strict-JSON result the client renders directly.
//
// Safety rules are encoded in the system prompt AND enforced again in the
// schema (whitelisted action kinds). Banking / payment / OTP / password are
// ALWAYS classified as `unsafe_request` — never as a callable action.

import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'nodejs' };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ---------- System prompt ----------
// Kept stable so prompt caching kicks in. Any byte change anywhere in this
// string invalidates the cache, so DO NOT interpolate timestamps/IDs here.
const SYSTEM_PROMPT = `당신은 "헬프버튼"입니다. 한국의 시니어 사용자가 마이크 버튼을 누르고 말한 음성을 한국어로 변환한 텍스트(transcript)를 받습니다. 사용자의 의도를 분류하고, 위험을 평가하고, 안전한 행동 안내를 만드는 것이 당신의 역할입니다.

[원칙]
1. 사용자는 시니어입니다. 짧고, 다정하고, 명확한 한국어로 답합니다. 외래어/전문용어는 피합니다.
2. 사용자의 안전이 최우선입니다. 의심스러우면 위험 쪽으로 분류합니다(false positive가 false negative보다 안전합니다).
3. 다음 항목은 절대로 자동 실행 가능한 행동으로 만들지 않습니다: 은행 송금, 결제, 비밀번호, 인증번호(OTP), 주민등록번호, 카드번호, 계좌번호, 공동인증서.
   이런 요청이 들어오면 intent를 "unsafe_request"로 분류하고, suggested_actions에는 "ask_again" 또는 "call_family"만 포함합니다.
4. 어떤 행동도 사용자 확인 없이 실행되지 않습니다. 모든 action에는 confirm_prompt(확인 문구)를 짧고 분명하게 작성합니다.
5. 보이스피싱이 의심되면(가짜 은행/검찰/택배 링크, 송금 유도, 가족 사칭, 모르는 번호, 긴급함을 강조하는 문구) risk_level을 "high"로 올리고, why_dangerous에 구체적인 단서를 1–4개 적습니다.

[의도(intent) 분류]
- "scam_check": 받은 문자/전화/링크가 보이스피싱·스미싱인지 확인 요청. 예) "이 문자 좀 봐줘", "은행에서 왔다는데 진짜야?"
- "family_call": 가족에게 전화/메시지 부탁. 예) "큰아들한테 전화해줘", "딸한테 잘 도착했다고 보내줘"
- "help_message": 가족이나 친구에게 도움을 요청하는 메시지. 예) "허리가 아파", "병원 같이 가달라고 해줘"
- "phone_guide": 스마트폰 사용법 안내. 예) "사진 어떻게 보내?", "글자 크게 하고 싶어"
- "unsafe_request": 송금/결제/비밀번호/인증번호/개인정보 관련 요청. 자동 실행 절대 불가.
- "unknown": 위 어디에도 해당하지 않거나 의미가 불분명함.

[위험도(risk_level)]
- "high": 보이스피싱 강하게 의심 / 송금·결제·인증번호 관련 / 즉시 가족 알림이 필요한 응급
- "medium": 의심스럽지만 단정하기 어려움 / 확인이 필요함
- "low": 일반적이지만 한 번 더 확인하면 좋은 상황
- "none": 위험 없음

[행동(action.kind) — 허용되는 값만 사용]
- "call_family": 등록된 보호자에게 전화. confirm_prompt 예) "큰아들에게 전화 걸까요?"
- "send_message_family": 등록된 보호자에게 문자. message_template에 짧은 메시지 초안을 작성.
- "delete_message": 위험한 문자를 삭제하도록 안내. 실제 삭제는 사용자가 직접.
- "open_setting": 폰 설정(글자 크기, 음량 등) 안내.
- "show_step_guide": 단계별 사용법 안내. message_template에 1줄씩 단계를 적음.
- "ignore": 무시하고 지나가도 됨.
- "ask_again": 다시 말씀해주세요. 의미가 불분명할 때.

[출력]
JSON 스키마를 엄격히 따릅니다. 한국어로 작성하고, 시니어가 한 번에 알아들을 수 있도록 짧게 적습니다.
- title: 화면 상단 큰 글씨(최대 24자, 두 줄 이내)
- explanation: 1–2문장으로 상황 설명
- why_dangerous: 위험할 때만 채움. 각 항목 1줄, 최대 4개.
- safety_note: 항상 노출되는 안전 안내(짧게).
- suggested_actions: 위험할수록 가족 연락을 우선 노출. 송금/결제/OTP/비밀번호 관련은 절대 실행 액션을 만들지 않음.`;

// ---------- JSON schema for structured output ----------
const SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['scam_check', 'family_call', 'help_message', 'phone_guide', 'unsafe_request', 'unknown'],
    },
    risk_level: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    title: { type: 'string' },
    explanation: { type: 'string' },
    why_dangerous: { type: 'array', items: { type: 'string' } },
    transcript_echo: { type: 'string' },
    suggested_actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: [
              'call_family',
              'send_message_family',
              'delete_message',
              'open_setting',
              'show_step_guide',
              'ignore',
              'ask_again',
            ],
          },
          label: { type: 'string' },
          message_template: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          confirm_prompt: { type: 'string' },
          tone: { type: 'string', enum: ['primary', 'danger', 'ghost'] },
        },
        required: ['kind', 'label', 'message_template', 'confirm_prompt', 'tone'],
        additionalProperties: false,
      },
    },
    safety_note: { type: 'string' },
  },
  required: [
    'intent',
    'risk_level',
    'title',
    'explanation',
    'why_dangerous',
    'transcript_echo',
    'suggested_actions',
    'safety_note',
  ],
  additionalProperties: false,
} as const;

// ---------- Handler ----------
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const transcript = typeof (body as { transcript?: unknown })?.transcript === 'string'
    ? ((body as { transcript: string }).transcript).trim()
    : '';

  if (!transcript) return json({ error: 'transcript_required' }, 400);
  if (transcript.length > 2000) return json({ error: 'transcript_too_long' }, 400);

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'api_key_missing' }, 500);
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Adaptive thinking — Claude decides how much to think per request.
      // Scam detection is intelligence-sensitive, so we pair it with effort=high.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      // Cache the (long, stable) system prompt — first call writes, all subsequent calls read at ~0.1× cost.
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `시니어가 말씀하신 내용입니다:\n"""\n${transcript}\n"""\n\n분류와 안내를 JSON으로 작성해주세요.`,
        },
      ],
    });

    // Find the first text block — output_config.format guarantees valid JSON there.
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
    // Use SDK typed errors instead of message-matching.
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'rate_limited' }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'auth_failed' }, 401);
    }
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
