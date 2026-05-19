import { useState } from 'react';
import { BottomTabs, type Tab } from '../components/BottomTabs';
import { Mic } from '../lib/icons';
import {
  FREE_DAILY_LIMIT,
  getFamily,
  getSubscription,
  getUsageToday,
  isFreeLimitReached,
} from '../lib/storage';

interface Props {
  onTab: (t: Tab) => void;
  onStartChat: (autoStart?: boolean) => void;
}

function todayKo(): string {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

export function Home({ onTab, onStartChat }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [usageCount] = useState(getUsageToday().count);
  const family = getFamily();
  const plan = getSubscription().plan;
  const isFree = plan === 'free';
  const limitReached = isFree && usageCount >= FREE_DAILY_LIMIT;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - usageCount);

  const startListening = () => {
    setError(null);
    if (isFreeLimitReached()) {
      setError(`오늘 도움 요청 ${FREE_DAILY_LIMIT}번을 모두 쓰셨어요. 내일 다시 사용할 수 있어요.`);
      return;
    }
    // Hand off to the real multi-turn Chat flow. It calls getUserMedia
    // (triggering the OS mic-permission prompt on first use), records audio,
    // sends it to Whisper, and chats back via Claude — no mocks.
    onStartChat(true);
  };

  return (
    <section className="screen main-screen has-tabbar" aria-label="홈">
      <div className="screen-body">
        <div className="greeting">
          <div className="greeting-hello">안녕하세요</div>
          <div className="greeting-name">{family.relation}의 부모님</div>
          <div className="greeting-date">{todayKo()}</div>
        </div>

        <div className="mic-area">
          <button
            className="mic-btn"
            aria-label="도움 요청"
            onClick={startListening}
            disabled={limitReached}
            type="button"
            style={limitReached ? { opacity: 0.5 } : undefined}
          >
            <Mic size={92} />
          </button>
          <div className="mic-label">
            {limitReached ? '오늘은 다 사용하셨어요' : '도움이 필요하면 누르세요'}
          </div>
          <div className="mic-hint">
            {limitReached
              ? '내일 다시 사용할 수 있어요'
              : '버튼을 누르면 마이크 사용 권한을 묻고, 바로 대화가 시작돼요'}
          </div>
          {isFree && !limitReached && (
            <div className="mic-hint" style={{ marginTop: 4 }}>
              오늘 남은 횟수 {remaining}회 / {FREE_DAILY_LIMIT}회
            </div>
          )}
          {error && <div className="error-bar">{error}</div>}
          <div className="mic-examples">
            <div className="example-chip">"이 문자 수상해"</div>
            <div className="example-chip">"{family.relation}에게 전화해줘"</div>
            <div className="example-chip">"가까운 약국 알려줘"</div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onStartChat(false)}
            style={{ marginTop: 18 }}
          >
            💬 글로 시작하기
          </button>
        </div>
      </div>
      <BottomTabs active="home" onSelect={onTab} />
    </section>
  );
}
