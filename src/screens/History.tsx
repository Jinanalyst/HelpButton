import { BottomTabs, type Tab } from '../components/BottomTabs';
import { ChevronLeft, ChevronRight, Clock, Phone, Shield, Warning } from '../lib/icons';
import { getHistory } from '../lib/storage';
import type { HistoryItem, Intent } from '../lib/types';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const ydy = new Date(now);
  ydy.setDate(ydy.getDate() - 1);
  const isYdy = d.toDateString() === ydy.toDateString();

  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const timePart = `${ampm} ${h12}:${mm}`;

  if (sameDay) return timePart;
  if (isYdy) return `어제 ${timePart}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${timePart}`;
}

function bucket(ts: number): '오늘' | '어제' | '이번 주' | '이전' {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfDay) return '오늘';
  if (ts >= startOfDay - 24 * 3600 * 1000) return '어제';
  if (ts >= startOfDay - 7 * 24 * 3600 * 1000) return '이번 주';
  return '이전';
}

function iconFor(intent: Intent, risk: HistoryItem['risk_level']) {
  if (intent === 'unsafe_request' || risk === 'high') {
    return { cls: 'danger', icon: <Warning size={26} /> };
  }
  if (intent === 'family_call' || intent === 'help_message') {
    return { cls: 'primary', icon: <Phone size={26} /> };
  }
  if (intent === 'scam_check') {
    return { cls: 'warn', icon: <Shield size={26} /> };
  }
  return { cls: 'ok', icon: <Clock size={26} /> };
}

interface Props {
  onBack: () => void;
  onTab: (t: Tab) => void;
  onOpen: (item: HistoryItem) => void;
}

export function History({ onBack, onTab, onOpen }: Props) {
  const items = getHistory();

  const grouped = items.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    const key = bucket(item.timestamp);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  const order: Array<'오늘' | '어제' | '이번 주' | '이전'> = ['오늘', '어제', '이번 주', '이전'];

  return (
    <section className="screen history-screen has-tabbar" aria-label="도움 기록">
      <div className="screen-body">
        <div className="app-bar">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <h2>도움 기록</h2>
        </div>

        {items.length === 0 && (
          <div className="empty">
            <Clock size={56} />
            <div className="empty-title">아직 기록이 없어요</div>
            <div className="empty-sub">홈에서 마이크 버튼을 눌러 도움을 받아보세요.</div>
          </div>
        )}

        {order.map((label) => {
          const group = grouped[label];
          if (!group || group.length === 0) return null;
          return (
            <div key={label}>
              <div className="history-day-label">{label}</div>
              <div className="history-list">
                {group.map((item) => {
                  const ico = iconFor(item.intent, item.risk_level);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="history-item clickable"
                      onClick={() => onOpen(item)}
                    >
                      <div className={`history-icon ${ico.cls}`}>{ico.icon}</div>
                      <div className="body">
                        <div className="title">{item.title}</div>
                        <div className="meta">{fmtTime(item.timestamp)}</div>
                      </div>
                      <ChevronRight size={20} color="#8696A4" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <BottomTabs active="history" onSelect={onTab} />
    </section>
  );
}
