import { useState } from 'react';
import { Check, ChevronLeft, Shield } from '../lib/icons';
import {
  FREE_DAILY_LIMIT,
  getSubscription,
  getUsageToday,
  setSubscription,
} from '../lib/storage';
import type { Plan, Subscription } from '../lib/types';

interface PlanDef {
  id: Plan;
  name: string;
  priceLabel: string;
  priceKrw: number;
  features: string[];
  featured?: boolean;
  tag?: string;
}

const BANK_NAME = '우리은행';
const BANK_ACCOUNT = '1002959547551';
const BANK_HOLDER = '장진우';

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: '무료',
    priceLabel: '0원',
    priceKrw: 0,
    features: [`하루 ${FREE_DAILY_LIMIT}번까지 도움 요청`, '기본 보이스피싱 확인'],
  },
  {
    id: 'safe_annual',
    name: '안심 연간 플랜',
    priceLabel: '49,000원 / 1년',
    priceKrw: 49000,
    featured: true,
    tag: '추천',
    features: [
      '도움 요청 무제한',
      '고급 보이스피싱 분석 (링크·문구 검사)',
      '스마트폰 사용법 단계별 안내',
    ],
  },
  {
    id: 'premium_annual',
    name: '프리미엄 연간 플랜',
    priceLabel: '99,000원 / 1년',
    priceKrw: 99000,
    features: [
      '안심 플랜의 모든 기능',
      '가족 대시보드 (도움 기록 공유)',
      '24시간 비상 연결 상담',
      '최대 3명 가족 연락처 등록',
    ],
  },
];

interface Props {
  onBack: () => void;
}

export function Payment({ onBack }: Props) {
  const [subscription, setSubscriptionState] = useState<Subscription>(() => getSubscription());
  const current = subscription.plan;
  const usage = getUsageToday();
  const remaining = Math.max(0, FREE_DAILY_LIMIT - usage.count);
  const [selected, setSelected] = useState<PlanDef | null>(null);
  const [copied, setCopied] = useState(false);
  const [depositorName, setDepositorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const openModal = (p: PlanDef) => {
    setSelected(p);
    setDepositorName('');
    setSubmitError(null);
    setSubmitted(false);
  };

  const closeModal = () => {
    setSelected(null);
    setSubmitting(false);
    setSubmitError(null);
  };

  // Optimistically flip the local plan to the chosen tier and notify the admin
  // by email so they can verify the bank deposit. Plan stays in pending_review
  // until they confirm; usage gates already treat any non-free plan as unlimited.
  const claimPayment = async () => {
    if (!selected) return;
    const name = depositorName.trim();
    if (!name) {
      setSubmitError('입금자명을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const claimedAt = Date.now();
    const next: Subscription = {
      plan: selected.id,
      status: 'pending_review',
      depositorName: name,
      claimedAt,
    };
    setSubscription(next);
    setSubscriptionState(next);
    try {
      const resp = await fetch('/api/notify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selected.id,
          priceKrw: selected.priceKrw,
          depositorName: name,
          claimedAt,
        }),
      });
      if (!resp.ok) {
        // We've already activated locally — the admin will see the deposit in
        // their bank statement even if the email failed. Surface the error so
        // the user knows to follow up.
        const detail = await resp.json().catch(() => ({}));
        setSubmitError(
          detail?.error === 'notify_not_configured'
            ? '알림 설정이 아직 안 됐어요. 입금 내역만 확인해 드릴게요.'
            : '알림 전송에 실패했어요. 입금이 확인되면 자동으로 활성화돼요.',
        );
      }
      setSubmitted(true);
    } catch {
      setSubmitError('인터넷 연결을 확인해 주세요. 입금 내역으로도 확인할 수 있어요.');
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="screen payment-screen" aria-label="구독 관리">
      <div className="screen-body">
        <div className="app-bar">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <h2>구독 관리</h2>
        </div>

        {subscription.status === 'pending_review' && current !== 'free' && (
          <div
            style={{
              margin: '0 0 14px',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255, 165, 0, 0.12)',
              border: '1px solid rgba(255, 165, 0, 0.35)',
              lineHeight: 1.55,
            }}
          >
            <strong>입금 확인 중이에요</strong>
            <br />
            입금자명 <strong>{subscription.depositorName}</strong> 으로 결제하신 내역을 확인하고
            있어요. 그 사이에도 유료 기능을 사용하실 수 있어요.
          </div>
        )}

        <p className="payment-intro">
          원하는 플랜을 선택하시면
          <br />
          결제 QR 코드를 보여드려요.
        </p>

        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          const isFree = p.id === 'free';
          return (
            <div
              key={p.id}
              className={`plan${p.featured ? ' featured' : ''}${isCurrent ? ' is-current' : ''}`}
            >
              {p.tag && <span className="plan-tag">{p.tag}</span>}
              <div className="plan-top">
                <div>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">
                    <span className={isFree ? 'free' : 'num'}>{p.priceLabel}</span>
                  </div>
                </div>
                {isCurrent && <span className="current-badge">사용 중</span>}
              </div>
              <ul className="plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              {isFree && isCurrent && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(0, 122, 255, 0.08)',
                    color: 'var(--text)',
                    fontWeight: 600,
                  }}
                >
                  오늘 남은 횟수 {remaining}회 / {FREE_DAILY_LIMIT}회
                </div>
              )}
              {!isFree && !isCurrent && (
                <button
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`}
                  type="button"
                  onClick={() => openModal(p)}
                  style={{ marginTop: 10 }}
                >
                  이 플랜으로 결제하기
                </button>
              )}
            </div>
          );
        })}

        <div className="payment-foot">
          <Shield size={20} />
          <div>
            결제는 가족 보호자 계정에서 진행돼요.
            <br />
            헬프버튼은 은행·인증번호·비밀번호를 절대 자동으로 처리하지 않습니다.
          </div>
        </div>
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="결제 QR 코드"
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '20px 20px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{submitted ? '확인 중이에요' : 'QR로 결제하기'}</h3>
              <button type="button" className="icon-btn" aria-label="닫기" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.95em', color: 'var(--muted)', marginBottom: 14 }}>
              {selected.name} · <strong style={{ color: 'var(--text)' }}>{selected.priceLabel}</strong>
            </div>

            {submitted ? (
              <div style={{ lineHeight: 1.7 }}>
                <p>
                  <strong>{depositorName}</strong> 님의 결제 알림이 전송되었어요.
                </p>
                <p>
                  입금 내역이 확인되면 자동으로 정식 활성화돼요. 그 사이에도 유료 기능을 바로
                  사용하실 수 있어요.
                </p>
                {submitError && (
                  <div
                    className="error-bar"
                    style={{ marginTop: 10 }}
                  >
                    {submitError}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={closeModal}
                  style={{ width: '100%', marginTop: 14 }}
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: '#fff',
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}payment-qr.jpg`}
                    alt="우리은행 결제 QR 코드"
                    style={{ width: '100%', maxWidth: 280, height: 'auto' }}
                  />
                </div>

                <ol style={{ paddingLeft: 20, margin: '0 0 14px', lineHeight: 1.7 }}>
                  <li>은행 앱(우리은행 등)을 열어 QR 송금을 선택하세요.</li>
                  <li>위 QR 코드를 스캔합니다.</li>
                  <li>
                    금액 <strong>{selected.priceLabel}</strong>을 확인하고 송금하세요.
                  </li>
                  <li>송금이 끝나면 아래에 입금자명을 적고 <strong>결제했어요</strong>를 눌러주세요.</li>
                </ol>

                <div
                  style={{
                    background: 'rgba(0, 122, 255, 0.06)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>QR이 안 보이면 직접 송금</div>
                  <div>
                    {BANK_NAME} <strong>{BANK_ACCOUNT}</strong>
                    <br />
                    예금주: {BANK_HOLDER}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={copyAccount}
                    style={{ marginTop: 8, padding: '6px 12px' }}
                  >
                    {copied ? '복사됨 ✓' : '계좌번호 복사'}
                  </button>
                </div>

                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  입금자명
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="name"
                  placeholder="예: 홍길동"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: '1em',
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontSize: '0.85em', color: 'var(--muted)', marginBottom: 12 }}>
                  은행 송금 화면의 보내는 분 이름과 똑같이 적어주세요.
                </div>

                {submitError && <div className="error-bar" style={{ marginBottom: 12 }}>{submitError}</div>}

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={claimPayment}
                  disabled={submitting || !depositorName.trim()}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  {submitting ? '확인 중…' : '결제했어요'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  style={{ width: '100%' }}
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
