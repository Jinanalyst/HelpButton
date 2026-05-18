import { ChevronLeft } from '../lib/icons';
import type { HistoryItem } from '../lib/types';

interface Props {
  item: HistoryItem;
  onBack: () => void;
}

function fmtFull(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${h12}:${mm}`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${ampm} ${h12}:${mm}`;
}

export function HistoryDetail({ item, onBack }: Props) {
  const result = item.result;
  const replyTs = item.timestamp + 1000;

  if (item.kind === 'chat' && item.chat) {
    return (
      <section className="screen chat-screen" aria-label="대화 기록">
        <div className="screen-body">
          <div className="app-bar">
            <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
              <ChevronLeft size={20} />
            </button>
            <h2>대화 기록</h2>
          </div>

          <div className="chat-day-divider">
            <span>{fmtFull(item.timestamp)}</span>
          </div>

          {item.chat.turns.map((t, i) =>
            t.role === 'user' ? (
              <div className="chat-row outgoing" key={i}>
                <div className="chat-meta-side">{fmtTime(t.timestamp)}</div>
                <div className="chat-bubble outgoing">{t.content}</div>
              </div>
            ) : (
              <div className="chat-row incoming" key={i}>
                <div className="chat-avatar">HB</div>
                <div className="chat-stack">
                  <div className="chat-name">헬프버튼</div>
                  <div className="chat-bubble incoming">{t.content}</div>
                </div>
                <div className="chat-meta-side">{fmtTime(t.timestamp)}</div>
              </div>
            ),
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="screen chat-screen" aria-label="대화 기록">
      <div className="screen-body">
        <div className="app-bar">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <h2>대화 기록</h2>
        </div>

        <div className="chat-day-divider">
          <span>{fmtFull(item.timestamp)}</span>
        </div>

        <div className="chat-row outgoing">
          <div className="chat-meta-side">{fmtTime(item.timestamp)}</div>
          <div className="chat-bubble outgoing">{item.transcript}</div>
        </div>

        {result ? (
          <>
            <div className="chat-row incoming">
              <div className="chat-avatar">HB</div>
              <div className="chat-stack">
                <div className="chat-name">헬프버튼</div>
                <div className="chat-bubble incoming">
                  <strong>{result.title}</strong>
                  {result.explanation && (
                    <>
                      <br />
                      {result.explanation}
                    </>
                  )}
                </div>
                {result.why_dangerous && result.why_dangerous.length > 0 && (
                  <div className="chat-bubble incoming">
                    왜 조심해야 하나요?
                    <ul className="chat-list">
                      {result.why_dangerous.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.safety_note && (
                  <div className="chat-bubble incoming subtle">{result.safety_note}</div>
                )}
              </div>
              <div className="chat-meta-side">{fmtTime(replyTs)}</div>
            </div>
          </>
        ) : (
          <div className="chat-row incoming">
            <div className="chat-avatar">HB</div>
            <div className="chat-stack">
              <div className="chat-name">헬프버튼</div>
              <div className="chat-bubble incoming">{item.title}</div>
            </div>
            <div className="chat-meta-side">{fmtTime(replyTs)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
