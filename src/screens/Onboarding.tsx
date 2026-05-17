import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Phone, Shield } from '../lib/icons';
import { markOnboarded } from '../lib/storage';

interface Slide {
  illust: React.ReactNode;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    illust: <Mic size={100} />,
    title: '누르고\n말씀하세요',
    subtitle: '큰 버튼을 누르고 편하게 말씀해 주세요.\n필요한 도움을 바로 드릴게요.',
  },
  {
    illust: <Shield size={100} />,
    title: '수상한 문자는\n먼저 확인하세요',
    subtitle: '받은 문자나 전화가 보이스피싱인지\n읽어드리고 위험 여부를 알려드려요.',
  },
  {
    illust: <Phone size={100} />,
    title: '가족에게\n바로 연결해드려요',
    subtitle: '위급할 때 한 번 누르면\n가족과 통화하거나 메시지를 보냅니다.',
  },
];

function multiline(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<number | null>(null);

  // Update idx when the user finishes swiping. Debounced so we only react
  // to settled positions, not every scroll-snap intermediate frame.
  const handleScroll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (scrollTimeout.current !== null) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      const w = c.clientWidth || 1;
      const newIdx = Math.round(c.scrollLeft / w);
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, newIdx));
      setIdx((prev) => (prev !== clamped ? clamped : prev));
    }, 60);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current !== null) window.clearTimeout(scrollTimeout.current);
    };
  }, []);

  // Programmatic scroll used by the 이전 / 다음 buttons and dot taps.
  const goTo = (i: number) => {
    const c = containerRef.current;
    if (!c) return;
    const target = Math.max(0, Math.min(SLIDES.length - 1, i));
    c.scrollTo({ left: target * c.clientWidth, behavior: 'smooth' });
  };

  const finish = () => {
    markOnboarded();
    onDone();
  };

  const isLast = idx === SLIDES.length - 1;

  return (
    <section className="screen ob" aria-label={`안내 ${idx + 1} / ${SLIDES.length}`}>
      <div
        ref={containerRef}
        className="ob-slides"
        onScroll={handleScroll}
        role="region"
        aria-label="안내 슬라이드"
      >
        {SLIDES.map((slide, i) => (
          <article
            key={i}
            className="ob-slide"
            aria-hidden={i !== idx}
            aria-label={`${i + 1}번째 안내`}
          >
            <div className="ob-illust">{slide.illust}</div>
            <h1>{multiline(slide.title)}</h1>
            <p>{multiline(slide.subtitle)}</p>
          </article>
        ))}
      </div>

      <div className="ob-bottom">
        <div className="dots" role="tablist" aria-label="안내 순서">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${i + 1}번째 안내로 이동`}
              className={`dot${i === idx ? ' active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="ob-actions">
          {isLast ? (
            <button className="btn btn-primary" type="button" onClick={finish}>
              시작하기
            </button>
          ) : (
            <div className="btn-row">
              {idx > 0 && (
                <button className="btn btn-ghost" type="button" onClick={() => goTo(idx - 1)}>
                  이전
                </button>
              )}
              <button className="btn btn-primary" type="button" onClick={() => goTo(idx + 1)}>
                다음
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
