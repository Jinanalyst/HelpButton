import { Check, ChevronLeft, Shield } from '../lib/icons';
import { FREE_DAILY_LIMIT, getSubscription, getUsageToday } from '../lib/storage';

// Paid plans are listed for preview only — payment infrastructure ships with
// the app-store release. For now everyone is on the free plan.
interface PlanDef {
  id: 'free' | 'safe_annual' | 'premium_annual';
  name: string;
  priceLabel: string;
  features: string[];
  featured?: boolean;
  tag?: string;
  comingSoon?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: '무료',
    priceLabel: '0원',
    features: [`하루 ${FREE_DAILY_LIMIT}번까지 도움 요청`, '기본 보이스피싱 확인'],
  },
  {
    id: 'safe_annual',
    name: '안심 연간 플랜',
    priceLabel: '49,000원 / 1년',
    featured: true,
    tag: '준비 중',
    comingSoon: true,
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
    comingSoon: true,
    tag: '준비 중',
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
          지금은 무료 플랜으로 사용하실 수 있어요.
          <br />
          유료 플랜은 곧 시작돼요.
        </p>

        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          return (
            <div
              key={p.id}
              className={`plan${p.featured ? ' featured' : ''}${isCurrent ? ' is-current' : ''}`}
              style={p.comingSoon ? { opacity: 0.7 } : undefined}
            >
              {p.tag && <span className="plan-tag">{p.tag}</span>}
              <div className="plan-top">
                <div>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">
                    <span className={p.id === 'free' ? 'free' : 'num'}>{p.priceLabel}</span>
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
              {p.id === 'free' && isCurrent && (
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
              {p.comingSoon && (
                <button className="btn btn-ghost" type="button" disabled style={{ opacity: 0.6 }}>
                  앱 출시 후 시작돼요
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
    </section>
  );
}
