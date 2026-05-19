import { useState } from 'react';
import { Check, ChevronLeft, Shield } from '../lib/icons';
import { FREE_DAILY_LIMIT, getSubscription, getUsageToday } from '../lib/storage';

interface PlanDef {
  id: 'free' | 'safe_annual' | 'premium_annual';
  name: string;
  priceLabel: string;
  priceKrw: number;
  features: string[];
  featured?: boolean;
  tag?: string;
}

const BANK_NAME = '우리은행';
const BANK_ACCOUNT = '100295547551';
const BANK_HOLDER = '헬프버튼';

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
      '위험 감지 시 가족 자동 알림',
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
  const current = getSubscription().plan;
  const usage = getUsageToday();
  const remaining = Math.max(0, FREE_DAILY_LIMIT - usage.count);
  const [selected, setSelected] = useState<PlanDef | null>(null);
  const [copied, setCopied] = useState(false);

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
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
              {!isFree && (
                <button
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`}
                  type="button"
                  onClick={() => setSelected(p)}
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
          onClick={() => setSelected(null)}
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
              <h3 style={{ margin: 0 }}>QR로 결제하기</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="닫기"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.95em', color: 'var(--muted)', marginBottom: 14 }}>
              {selected.name} · <strong style={{ color: 'var(--text)' }}>{selected.priceLabel}</strong>
            </div>

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
              <li>송금이 끝나면 가족 보호자에게 알려 주세요.</li>
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

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelected(null)}
              style={{ width: '100%' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
