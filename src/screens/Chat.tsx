import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Mic, Phone } from '../lib/icons';
import {
  isSpeechSupported,
  listenOnce,
  recordToWhisper,
  speakAi,
  stopSpeaking,
  volumeFor,
  type RecordHandle,
} from '../lib/speech';
import { chat, ChatUnavailableError, runChatAction } from '../lib/chat';
import { newSession, saveChatSession } from '../lib/chatHistory';
import {
  FREE_DAILY_LIMIT,
  getFamily,
  getSettings,
  incrementUsage,
  isFreeLimitReached,
} from '../lib/storage';
import type { ChatAction, ChatSession, ChatTurn } from '../lib/types';

interface Props {
  onBack: () => void;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${ampm} ${h12}:${mm}`;
}

interface PendingConfirm {
  turnIndex: number;
  action: ChatAction;
}

export function Chat({ onBack }: Props) {
  const [session, setSession] = useState<ChatSession>(() => newSession());
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const recHandle = useRef<RecordHandle | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const family = getFamily();
  const settings = getSettings();
  const volume = volumeFor(settings.voiceVolume);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.turns.length]);

  useEffect(() => {
    saveChatSession(session);
  }, [session]);

  useEffect(() => () => stopSpeaking(), []);

  const sendUserTurn = async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    if (isFreeLimitReached()) {
      setError(`오늘 도움 요청 ${FREE_DAILY_LIMIT}번을 모두 쓰셨어요. 내일 다시 사용할 수 있어요.`);
      return;
    }
    const userTurn: ChatTurn = { role: 'user', content: text.trim(), timestamp: Date.now() };
    const nextTurns = [...session.turns, userTurn];
    setSession((s) => ({ ...s, turns: nextTurns, updatedAt: Date.now() }));
    setBusy(true);

    try {
      const reply = await chat(nextTurns, family);
      incrementUsage();
      const assistantTurn: ChatTurn = {
        role: 'assistant',
        content: reply.reply,
        timestamp: Date.now(),
        risk: reply.risk,
        action: reply.action,
      };
      setSession((s) => {
        const nextTurns2 = [...s.turns, assistantTurn];
        // If the AI proposed a real action, auto-surface the big 예/아니오 confirm.
        if (reply.action && reply.action.kind !== 'none' && reply.action.kind !== 'show_step_guide') {
          setPending({ turnIndex: nextTurns2.length - 1, action: reply.action });
        }
        return { ...s, turns: nextTurns2, updatedAt: Date.now() };
      });
      // Speak the reply + (if any) the confirm prompt afterwards.
      const toSpeak =
        reply.action && reply.action.kind !== 'none' && reply.action.confirm_prompt
          ? `${reply.reply} ${reply.action.confirm_prompt}`
          : reply.reply;
      await speakAi(toSpeak, { volume });
    } catch (err) {
      if (err instanceof ChatUnavailableError) {
        if (err.reason === 'offline') setError('인터넷 연결을 확인해 주세요.');
        else if (err.reason === 'rate_limited') setError('잠시 후 다시 말씀해 주세요.');
        else setError('지금 연결이 어려워요. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('지금 연결이 어려워요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (busy || recording) return;
    stopSpeaking();
    setError(null);
    setPending(null);

    // Prefer Whisper (better Korean for seniors). Fall back to Web Speech if
    // mic permission fails or MediaRecorder isn't available.
    const handle = recordToWhisper();
    recHandle.current = handle;
    setRecording(true);

    try {
      const transcript = await handle.promise;
      setRecording(false);
      recHandle.current = null;
      await sendUserTurn(transcript);
    } catch (err) {
      setRecording(false);
      recHandle.current = null;
      const code = err instanceof Error ? err.message : String(err);
      if (code === 'cancelled') return;
      if (code === 'no_speech_detected') {
        setError('말씀이 들리지 않았어요. 한 번 더 눌러서 말씀해 주세요.');
        return;
      }
      if (code === 'mic_denied') {
        setError('마이크 사용 권한을 허용해 주세요.');
        return;
      }
      if (code === 'mic_unsupported' || code === 'stt_unavailable') {
        // Fallback to Web Speech API in unsupported browsers.
        await fallbackListen();
        return;
      }
      setError('한 번 더 말씀해 주세요.');
    }
  };

  const stopRecording = () => {
    if (recHandle.current) recHandle.current.stop();
  };

  const cancelRecording = () => {
    if (recHandle.current) recHandle.current.cancel();
    setRecording(false);
    recHandle.current = null;
  };

  const fallbackListen = async () => {
    if (!isSpeechSupported()) {
      const typed = window.prompt('마이크를 사용할 수 없어요.\n말씀하실 내용을 입력해 주세요.');
      if (typed && typed.trim()) await sendUserTurn(typed.trim());
      return;
    }
    setRecording(true);
    const h = listenOnce({});
    try {
      const transcript = await h.promise;
      setRecording(false);
      await sendUserTurn(transcript);
    } catch {
      setRecording(false);
      setError('한 번 더 말씀해 주세요.');
    }
  };

  const confirmAction = () => {
    if (!pending) return;
    runChatAction(pending.action);
    setPending(null);
  };

  const rejectAction = () => {
    if (!pending) return;
    setPending(null);
    void speakAi('알겠어요. 그만둘게요.', { volume });
  };

  return (
    <section className="screen chat-screen" aria-label="대화" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="app-bar" style={{ padding: '8px 14px 4px' }}>
        <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={20} />
        </button>
        <h2>대화하기</h2>
      </div>

      <div
        className="screen-body"
        ref={scrollerRef}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}
      >
        {session.turns.length === 0 && (
          <div className="chat-row incoming">
            <div className="chat-avatar">HB</div>
            <div className="chat-stack">
              <div className="chat-name">헬프버튼</div>
              <div className="chat-bubble incoming">
                안녕하세요. 편하게 말씀해 주세요.
                <br />
                아래 마이크 버튼을 누르고 말씀하시면 돼요.
              </div>
            </div>
          </div>
        )}

        {session.turns.map((t, i) => {
          if (t.role === 'user') {
            return (
              <div className="chat-row outgoing" key={i}>
                <div className="chat-meta-side">{fmtTime(t.timestamp)}</div>
                <div className="chat-bubble outgoing">{t.content}</div>
              </div>
            );
          }
          return (
            <div className="chat-row incoming" key={i}>
              <div className="chat-avatar">HB</div>
              <div className="chat-stack">
                <div className="chat-name">헬프버튼</div>
                <div className="chat-bubble incoming">{t.content}</div>
                {t.action?.kind === 'show_step_guide' && t.action.steps && (
                  <div className="chat-bubble incoming">
                    <strong>{t.action.label}</strong>
                    <ol className="chat-list">
                      {t.action.steps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void speakAi(t.content, { volume })}
                      style={{ marginTop: 8 }}
                    >
                      🔊 다시 듣기
                    </button>
                  </div>
                )}
              </div>
              <div className="chat-meta-side">{fmtTime(t.timestamp)}</div>
            </div>
          );
        })}

        {busy && (
          <div className="chat-row incoming">
            <div className="chat-avatar">HB</div>
            <div className="chat-stack">
              <div className="chat-bubble incoming subtle">생각하는 중이에요…</div>
            </div>
          </div>
        )}
        {error && <div className="error-bar" style={{ margin: '8px 14px' }}>{error}</div>}
      </div>

      {pending ? (
        <ConfirmBar
          action={pending.action}
          onYes={confirmAction}
          onNo={rejectAction}
          onReplay={() => {
            const turn = session.turns[pending.turnIndex];
            if (turn) {
              const toSpeak = pending.action.confirm_prompt
                ? `${turn.content} ${pending.action.confirm_prompt}`
                : turn.content;
              void speakAi(toSpeak, { volume });
            }
          }}
        />
      ) : (
        <MicBar
          recording={recording}
          busy={busy}
          onStart={startRecording}
          onStop={stopRecording}
          onCancel={cancelRecording}
        />
      )}
    </section>
  );
}

function MicBar({
  recording,
  busy,
  onStart,
  onStop,
  onCancel,
}: {
  recording: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px 20px',
        background: 'rgba(255,255,255,0.7)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <button
        className="mic-btn"
        aria-label={recording ? '말하기 끝내기' : '말하기 시작'}
        onClick={recording ? onStop : onStart}
        disabled={busy}
        type="button"
        style={{
          width: 96,
          height: 96,
          background: recording ? 'var(--danger)' : undefined,
        }}
      >
        <Mic size={48} />
      </button>
      <div className="mic-hint">
        {busy
          ? '대답을 만드는 중…'
          : recording
            ? '다 말씀하셨으면 한 번 더 누르세요'
            : '버튼을 한 번 누르고 말씀하세요'}
      </div>
      {recording && (
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
      )}
    </div>
  );
}

function ConfirmBar({
  action,
  onYes,
  onNo,
  onReplay,
}: {
  action: ChatAction;
  onYes: () => void;
  onNo: () => void;
  onReplay: () => void;
}) {
  const isCall = action.kind === 'call_family' || action.kind === 'open_dialer';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 16px 22px',
        background: '#FFFFFF',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ textAlign: 'center', fontSize: '1.05em', fontWeight: 600, color: 'var(--text)' }}>
        {action.confirm_prompt || action.label}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onYes}
          style={{ flex: 1, minHeight: 64, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {isCall && <Phone size={22} />}
          예, {action.label}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onNo}
          style={{ flex: 1, minHeight: 64 }}
        >
          아니오
        </button>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onReplay}
        style={{ alignSelf: 'center' }}
      >
        🔊 다시 듣기
      </button>
    </div>
  );
}
