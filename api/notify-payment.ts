// Vercel serverless function — POST /api/notify-payment.
// Sends an email to the admin (jangj6091@gmail.com) when a user clicks
// 결제했어요 in the subscription tab. Uses Resend's HTTP API directly
// (no SDK dep) so cold starts stay tiny.
//
// Required env vars:
//   RESEND_API_KEY — from https://resend.com/api-keys
//   ADMIN_EMAIL    — destination, e.g. jangj6091@gmail.com
//   RESEND_FROM    — optional, defaults to "헬프버튼 <onboarding@resend.dev>"
//                    (Resend's sandbox sender; only delivers to the account
//                    owner's verified address — fine for solo admin alerts.)

export const config = { runtime: 'nodejs' };

interface NotifyBody {
  plan?: string;
  priceKrw?: number;
  depositorName?: string;
  claimedAt?: number;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const plan = String(body.plan ?? '').slice(0, 64);
  const depositorName = String(body.depositorName ?? '').trim().slice(0, 64);
  const priceKrw = Number.isFinite(body.priceKrw) ? Number(body.priceKrw) : 0;
  const claimedAt = Number.isFinite(body.claimedAt) ? Number(body.claimedAt) : Date.now();

  if (!plan) return json({ error: 'plan_required' }, 400);
  if (!depositorName) return json({ error: 'depositor_name_required' }, 400);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return json({ error: 'notify_not_configured' }, 500);

  const from = process.env.RESEND_FROM || '헬프버튼 <onboarding@resend.dev>';
  const when = new Date(claimedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const priceLabel = priceKrw > 0 ? `${priceKrw.toLocaleString('ko-KR')}원` : '미상';

  const subject = `[헬프버튼] 결제 알림 — ${depositorName} / ${plan}`;
  const text =
    `사용자가 결제했어요 버튼을 눌렀습니다.\n\n` +
    `입금자명: ${depositorName}\n` +
    `플랜: ${plan}\n` +
    `금액: ${priceLabel}\n` +
    `시간(KST): ${when}\n\n` +
    `우리은행 1002959547551 입금 내역을 확인하고, 일치하면 그대로 두세요.\n` +
    `일치하지 않으면 사용자의 구독을 무료로 되돌려 주세요.`;
  const html =
    `<h2>헬프버튼 결제 알림</h2>` +
    `<p>사용자가 <strong>결제했어요</strong> 버튼을 눌렀습니다.</p>` +
    `<ul>` +
    `<li><strong>입금자명:</strong> ${escapeHtml(depositorName)}</li>` +
    `<li><strong>플랜:</strong> ${escapeHtml(plan)}</li>` +
    `<li><strong>금액:</strong> ${priceLabel}</li>` +
    `<li><strong>시간(KST):</strong> ${when}</li>` +
    `</ul>` +
    `<p>우리은행 <strong>1002959547551</strong> 입금 내역을 확인하세요.</p>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json({ error: 'send_failed', status: resp.status, detail: detail.slice(0, 500) }, 502);
    }
    return json({ ok: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'send_error', detail: message }, 502);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
