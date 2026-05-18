// Short consent popup shown before invoking `navigator.contacts.select`.
// Senior-friendly: one line of context, one checkbox, two buttons.

import { useState } from 'react';
import { Check } from '../lib/icons';

interface Props {
  onAgree: () => void;
  onCancel: () => void;
}

export function ContactsConsent({ onAgree, onCancel }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="연락처 사용 동의">
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-title">연락처를 가져올까요?</div>

        <div className="modal-body" style={{ textAlign: 'left' }}>
          이름과 전화번호만 가져와서 이 기기에만 저장해요.
        </div>

        <button
          type="button"
          className="consent-check"
          aria-pressed={checked}
          onClick={() => setChecked((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '14px 16px',
            margin: '14px 0 6px',
            background: checked ? 'rgba(0, 122, 255, 0.08)' : '#FFFFFF',
            border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12,
            fontSize: '1.05em',
            fontWeight: 600,
            color: 'var(--text)',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
              background: checked ? 'var(--primary)' : '#FFFFFF',
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            {checked && <Check size={18} />}
          </span>
          동의합니다
        </button>

        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!checked}
            onClick={onAgree}
            style={{ opacity: checked ? 1 : 0.5 }}
          >
            연락처 가져오기
          </button>
        </div>
      </div>
    </div>
  );
}
