import { useState } from 'react';
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

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const finish = () => {
    markOnboarded();
    onDone();
  };

  return (
    <section className="screen ob" aria-label={`안내 ${idx + 1}/3`}>
      <div className="screen-body">
        <div className="ob-illust">{slide.illust}</div>
        <h1>
          {slide.title.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < slide.title.split('\n').length - 1 && <br />}
            </span>
          ))}
        </h1>
        <p>
          {slide.subtitle.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < slide.subtitle.split('\n').length - 1 && <br />}
            </span>
          ))}
        </p>

        <div className="dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span key={i} className={`dot${i === idx ? ' active' : ''}`} />
          ))}
        </div>

        <div className="ob-actions">
          {idx === 0 && (
            <button className="btn btn-primary" type="button" onClick={() => setIdx(1)}>
              다음
            </button>
          )}
          {idx > 0 && idx < SLIDES.length - 1 && (
            <div className="btn-row">
              <button className="btn btn-ghost" type="button" onClick={() => setIdx(idx - 1)}>
                이전
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setIdx(idx + 1)}>
                다음
              </button>
            </div>
          )}
          {idx === SLIDES.length - 1 && (
            <button className="btn btn-primary" type="button" onClick={finish}>
              시작하기
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
