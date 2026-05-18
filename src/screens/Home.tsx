import { useState } from 'react';
import { BottomTabs, type Tab } from '../components/BottomTabs';
import { ListeningOverlay } from '../components/ListeningOverlay';
import { Mic } from '../lib/icons';
import { classify, ClassifyUnavailableError } from '../lib/api';
import { addHistory, getFamily, getSettings } from '../lib/storage';
import { isSpeechSupported, listenOnce, speakAi, volumeFor } from '../lib/speech';
import type { ClassifyResult } from '../lib/types';

interface Props {
  onResult: (transcript: string, result: ClassifyResult) => void;
  onTab: (t: Tab) => void;
  onStartChat: () => void;
}

function todayKo(): string {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

export function Home({ onResult, onTab, onStartChat }: Props) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const family = getFamily();
  const supported = isSpeechSupported();

  const startListening = async () => {
    if (busy) return;
    setError(null);
    setPartial('');

    if (!supported) {
      // Fallback for unsupported browsers (Firefox, older Safari): prompt typed input.
      const typed = window.prompt('마이크 인식을 사용할 수 없어요.\n도움이 필요한 내용을 입력해 주세요.');
      if (typed && typed.trim()) {
        await runClassify(typed.trim());
      }
      return;
    }

    setListening(true);
    const handle = listenOnce({
      onPartial: setPartial,
      onError: (code) => setError(`마이크 오류: ${code}`),
    });
    try {
      const transcript = await handle.promise;
      setListening(false);
      await runClassify(transcript);
    } catch (err) {
      setListening(false);
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'cancelled' || message === 'no_speech_detected') return;
      setError('한 번 더 말씀해 주세요.');
    }
  };

  const runClassify = async (transcript: string) => {
    setBusy(true);
    try {
      const result = await classify(transcript);
      addHistory({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        transcript,
        intent: result.intent,
        risk_level: result.risk_level,
        title: result.title,
        result,
      });
      // Speak the title aloud for accessibility.
      void speakAi(result.title, { volume: volumeFor(getSettings().voiceVolume) });
      onResult(transcript, result);
    } catch (err) {
      if (err instanceof ClassifyUnavailableError) {
        if (err.reason === 'offline') setError('인터넷 연결을 확인해 주세요.');
        else if (err.reason === 'rate_limited') setError('잠시 후 다시 시도해 주세요.');
        else setError('지금 연결이 어려워요. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('지금 연결이 어려워요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
              disabled={busy}
              type="button"
            >
              <Mic size={92} />
            </button>
            <div className="mic-label">
              {busy ? '잠시만 기다려 주세요…' : '도움이 필요하면 누르세요'}
            </div>
            <div className="mic-hint">버튼을 한 번 누르고 편하게 말씀해 주세요</div>
            {!supported && (
              <div className="mic-hint" style={{ color: 'var(--warn)' }}>
                이 브라우저는 음성 인식을 지원하지 않아요. 버튼을 누르면 글로 입력할 수 있어요.
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
              onClick={onStartChat}
              style={{ marginTop: 18 }}
            >
              💬 대화로 묻기
            </button>
          </div>
        </div>
        <BottomTabs active="home" onSelect={onTab} />
      </section>

      <ListeningOverlay
        visible={listening}
        partialText={partial}
        onCancel={() => {
          setListening(false);
          setPartial('');
        }}
      />
    </>
  );
}
