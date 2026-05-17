import { useState } from 'react';
import { Check, ChevronLeft, Shield } from '../lib/icons';
import { getSubscription, setSubscription } from '../lib/storage';
import type { Plan } from '../lib/types';

interface PlanDef {
  id: Plan;
  name: string;
  priceLabel: string;
  features: string[];
  featured?: boolean;
  tag?: string;
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: '무료',
    priceLabel: '0원',
    features: ['하루 5번까지 도움 요청', '기본 보이스피싱 확인'],
  },
  {
    id: 'safe_annual',
    name: '안심 연간 플랜',
    priceLabel: '49,000원 / 1년',
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
  const [current, setCurrent] = useState<Plan>(getSubscription().plan);

  const choose = (plan: Plan) => {
    if (plan === current) return;
    const ok = window.confirm(
      `${PLANS.find((p) => p.id === plan)?.name}(으)로 변경하시겠어요? 결제 진행 화면이 열립니다.`,
    );
    if (!ok) return;
    // In production this is where you'd hand off to a payment provider.
    // We just persist the choice locally for the prototype.
    setSubscription({ plan });
    setCurrent(plan);
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
          부모님이 더 안전하게 쓰실 수 있도록
          <br />
          가족이 도와주실 수 있어요.
        </p>

        {PLANS.map((p) => {
          const isCurrent = p.id === current;
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
              {!isCurrent && (
                <button
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`}
                  type="button"
                  onClick={() => choose(p.id)}
                >
                  {p.id === 'free' ? '무료로 전환' : `${p.name} 시작하기`}
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
