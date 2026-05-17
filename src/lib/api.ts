// Client-side wrapper for the /api/classify serverless function.
// When the function isn't reachable (e.g. `npm run dev` without `vercel dev`),
// we fall back to a deterministic mock so the senior UI is still walkable.

import type { ClassifyEnvelope, ClassifyResult } from './types';

const ENDPOINT = '/api/classify';

export async function classify(transcript: string): Promise<ClassifyResult> {
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) {
      // 404 → backend not deployed; surface mock instead of crashing the UI.
      if (resp.status === 404) return mockClassify(transcript);
      const text = await resp.text();
      throw new Error(`classify_http_${resp.status}:${text.slice(0, 200)}`);
    }
    const payload = (await resp.json()) as ClassifyEnvelope;
    return payload.result;
  } catch (err) {
    // Network error (server unreachable). Use mock so dev experience is intact.
    if (err instanceof TypeError) return mockClassify(transcript);
    throw err;
  }
}

// ---- Mock classifier (used in dev when serverless not running) ----
function mockClassify(transcript: string): ClassifyResult {
  const lower = transcript.toLowerCase();

  // Scam-ish keywords
  if (
    /(보이스피싱|은행|이체|송금|입금|인증번호|카드번호|비밀번호|otp|국세청|검찰|택배.*확인|링크)/i.test(transcript)
  ) {
    return {
      intent: 'unsafe_request',
      risk_level: 'high',
      title: '보이스피싱이 의심돼요',
      explanation: '이 메시지에는 은행이나 인증번호 관련 유도가 있어요. 절대 누르거나 알려주지 마세요.',
      why_dangerous: [
        '가짜 도메인일 가능성이 높습니다',
        '송금/계좌 입력을 유도합니다',
        '모르는 번호일 수 있습니다',
      ],
      transcript_echo: transcript,
      suggested_actions: [
        {
          kind: 'call_family',
          label: '가족에게 알리기',
          message_template: null,
          confirm_prompt: '가족에게 전화 걸까요?',
          tone: 'primary',
        },
        {
          kind: 'delete_message',
          label: '문자 삭제 안내',
          message_template: null,
          confirm_prompt: '문자를 삭제하시겠어요?',
          tone: 'danger',
        },
        {
          kind: 'ask_again',
          label: '다시 묻기',
          message_template: null,
          confirm_prompt: '',
          tone: 'ghost',
        },
      ],
      safety_note:
        '헬프버튼은 송금, 비밀번호, 인증번호를 절대로 자동으로 처리하지 않아요.',
    };
  }

  // Family call
  if (/(전화|연결|걸어|아들|딸|손주|남편|부인|보호자)/.test(transcript)) {
    return {
      intent: 'family_call',
      risk_level: 'low',
      title: '가족에게 연결해드릴게요',
      explanation: '등록된 보호자에게 전화를 걸 수 있어요. 한 번 더 확인할게요.',
      why_dangerous: [],
      transcript_echo: transcript,
      suggested_actions: [
        {
          kind: 'call_family',
          label: '전화 걸기',
          message_template: null,
          confirm_prompt: '보호자에게 전화 걸까요?',
          tone: 'primary',
        },
        {
          kind: 'send_message_family',
          label: '문자로 보내기',
          message_template: '엄마인데 잠깐 통화 가능하니?',
          confirm_prompt: '문자를 보낼까요?',
          tone: 'ghost',
        },
      ],
      safety_note: '통화 전 한 번 더 확인해요.',
    };
  }

  // Phone usage
  if (/(글자|크게|소리|사진|어떻게|방법|설정)/.test(transcript)) {
    return {
      intent: 'phone_guide',
      risk_level: 'none',
      title: '스마트폰 사용법을 알려드릴게요',
      explanation: '천천히 단계별로 도와드릴게요.',
      why_dangerous: [],
      transcript_echo: transcript,
      suggested_actions: [
        {
          kind: 'show_step_guide',
          label: '단계별로 보기',
          message_template: '1. 설정 앱을 엽니다\n2. 화면 → 글자 크기를 누릅니다\n3. 막대를 오른쪽으로 옮깁니다',
          confirm_prompt: '',
          tone: 'primary',
        },
      ],
      safety_note: '천천히 따라하시면 돼요. 어려우면 가족에게 도움을 청하세요.',
    };
  }

  // Fallback
  void lower;
  return {
    intent: 'unknown',
    risk_level: 'none',
    title: '잘 못 들었어요',
    explanation: '한 번만 더 말씀해 주시겠어요?',
    why_dangerous: [],
    transcript_echo: transcript,
    suggested_actions: [
      {
        kind: 'ask_again',
        label: '다시 말씀하기',
        message_template: null,
        confirm_prompt: '',
        tone: 'primary',
      },
    ],
    safety_note: '편하게 천천히 말씀해 주세요.',
  };
}
