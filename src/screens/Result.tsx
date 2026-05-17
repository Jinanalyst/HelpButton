import { useState } from 'react';
import { ChevronLeft, Mic, Phone, Trash, Warning, Message } from '../lib/icons';
import { getFamily } from '../lib/storage';
import { speak } from '../lib/speech';
import type { ClassifyResult, SuggestedAction, RiskLevel } from '../lib/types';

interface Props {
  result: ClassifyResult;
  onBack: () => void;
  onRetry: () => void;
}

// Visual tone derived from risk level — the actual button style still
// comes from action.tone, which the model picks.
function bannerToneFor(risk: RiskLevel): 'danger' | 'warn' | 'ok' | 'neutral' {
  if (risk === 'high') return 'danger';
  if (risk === 'medium') return 'warn';
  if (risk === 'low') return 'ok';
  return 'neutral';
}

function actionIcon(kind: SuggestedAction['kind']) {
  switch (kind) {
    case 'call_family':
      return <Phone size={22} />;
    case 'send_message_family':
      return <Message size={22} />;
    case 'delete_message':
      return <Trash size={22} />;
    default:
      return null;
  }
}

export function Result({ result, onBack, onRetry }: Props) {
  const family = getFamily();
  const [pending, setPending] = useState<SuggestedAction | null>(null);
  const banner = bannerToneFor(result.risk_level);

  const executeAction = (action: SuggestedAction) => {
    switch (action.kind) {
      case 'call_family':
        window.location.href = `tel:${family.phone.replace(/-/g, '')}`;
        break;
      case 'send_message_family': {
        const body = (action.message_template ?? '').trim();
        const sms = body
          ? `sms:${family.phone.replace(/-/g, '')}?body=${encodeURIComponent(body)}`
          : `sms:${family.phone.replace(/-/g, '')}`;
        window.location.href = sms;
        break;
      }
      case 'delete_message':
        // We never delete on the user's behalf — just acknowledge.
        speak('문자 앱에서 직접 삭제해 주세요.');
        alert('문자 앱을 열고 직접 삭제해 주세요. 헬프버튼은 대신 삭제하지 않습니다.');
        break;
      case 'show_step_guide':
        // Step guides are presented inline via the message_template, no extra action.
        speak(action.message_template ?? '안내드릴게요.');
        break;
      case 'open_setting':
        alert('설정 앱을 직접 열어 주세요.');
        break;
      case 'ask_again':
        onRetry();
        break;
      case 'ignore':
      default:
        onBack();
    }
  };

  const handleClick = (action: SuggestedAction) => {
    if (action.confirm_prompt) {
      setPending(action);
    } else {
      executeAction(action);
    }
  };

  return (
    <section className="screen result-screen" aria-label="확인 결과">
      <div className="screen-body">
        <div className="app-bar">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <h2>확인 결과</h2>
        </div>

        <div className="transcript">
          <div className="tag" aria-hidden="true">
            <Mic size={18} />
          </div>
          <div className="tx">
            <div className="transcript-label">이렇게 말씀하셨어요</div>
            <div className="transcript-text">"{result.transcript_echo}"</div>
          </div>
        </div>

        <div className={`alert-card tone-${banner}`}>
          <div className="icon-circle" aria-hidden="true">
            <Warning size={44} />
          </div>
          {result.risk_level !== 'none' && (
            <span className="badge">
              {result.risk_level === 'high' && '위험'}
              {result.risk_level === 'medium' && '주의'}
              {result.risk_level === 'low' && '확인'}
            </span>
          )}
          <h3>{result.title}</h3>
          <p>{result.explanation}</p>

          {result.why_dangerous.length > 0 && (
            <div className="why">
              <b>이런 점이 위험해요</b>
              {result.why_dangerous.map((line, i) => (
                <div key={i}>· {line}</div>
              ))}
            </div>
          )}
        </div>

        {result.safety_note && <div className="safety-note">{result.safety_note}</div>}

        <div className="action-stack">
          {result.suggested_actions.map((action, i) => (
            <button
              key={i}
              className={`btn btn-${action.tone}`}
              type="button"
              onClick={() => handleClick(action)}
            >
              <span className="btn-inner">
                {actionIcon(action.kind)}
                <span>{action.label}</span>
              </span>
            </button>
          ))}
          <button className="btn btn-ghost" type="button" onClick={onRetry}>
            다시 묻기
          </button>
        </div>
      </div>

      {pending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-title">{pending.confirm_prompt}</div>
            {pending.message_template && (
              <div className="modal-body">"{pending.message_template}"</div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPending(null)}
              >
                취소
              </button>
              <button
                className={`btn btn-${pending.tone}`}
                type="button"
                onClick={() => {
                  const a = pending;
                  setPending(null);
                  executeAction(a);
                }}
              >
                네, 진행할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
