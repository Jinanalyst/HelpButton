import { useState } from 'react';
import { BottomTabs, type Tab } from '../components/BottomTabs';
import { ContactsConsent } from '../components/ContactsConsent';
import {
  Card,
  ChevronLeft,
  ChevronRight,
  Clock,
  Message,
  Phone,
  Type,
  Volume,
} from '../lib/icons';
import {
  getContactsConsent,
  getFamily,
  getSettings,
  getSubscription,
  grantContactsConsent,
  revokeContactsConsent,
  setFamily as saveFamily,
  setSettings,
} from '../lib/storage';
import { speak, volumeFor } from '../lib/speech';
import type { Plan, Settings } from '../lib/types';

const PLAN_LABEL: Record<Plan, string> = {
  free: '무료',
  safe_annual: '안심 연간',
  premium_annual: '프리미엄 연간',
};

interface Props {
  onBack: () => void;
  onTab: (t: Tab) => void;
  onOpenPayment: () => void;
}

interface ContactsManager {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
}

function getContactsApi(): ContactsManager | null {
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts && typeof nav.contacts.select === 'function' ? nav.contacts : null;
}

export function Guardian({ onBack, onTab, onOpenPayment }: Props) {
  const [family, setFamilyState] = useState(getFamily());
  const [settings, setSettingsState] = useState<Settings>(getSettings());
  const [editingFamily, setEditingFamily] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  // When set, the consent popup is shown. After "동의" we proceed to the picker.
  const [askConsent, setAskConsent] = useState(false);
  const [consentGranted, setConsentGranted] = useState(getContactsConsent().granted);
  const subscription = getSubscription();

  const hasContact = family.phone.trim().length > 0;
  const contactsApi = getContactsApi();

  const runPicker = async () => {
    setPickerError(null);
    const api = getContactsApi();
    if (!api) {
      setPickerError('이 기기에서는 연락처 선택을 지원하지 않아요. 직접 입력해 주세요.');
      setEditingFamily(true);
      return;
    }
    try {
      const picked = await api.select(['name', 'tel'], { multiple: false });
      if (!picked || picked.length === 0) return;
      const c = picked[0];
      const name = (c.name && c.name[0]) || '';
      const phone = (c.tel && c.tel[0]) || '';
      const next = { ...family, name, phone };
      setFamilyState(next);
      saveFamily(next);
    } catch {
      setPickerError('연락처를 가져오지 못했어요. 권한을 확인해 주세요.');
    }
  };

  // Entry point: ask for consent first (once), then open the picker.
  const startPicker = () => {
    if (getContactsConsent().granted) {
      void runPicker();
      return;
    }
    setAskConsent(true);
  };

  const agreeAndContinue = () => {
    grantContactsConsent();
    setConsentGranted(true);
    setAskConsent(false);
    void runPicker();
  };

  const cancelConsent = () => setAskConsent(false);

  const revoke = () => {
    if (!window.confirm('연락처 사용 동의를 해제할까요?')) return;
    revokeContactsConsent();
    setConsentGranted(false);
  };

  const toggle = (key: keyof Settings) => {
    if (typeof settings[key] !== 'boolean') return;
    const next: Settings = { ...settings, [key]: !settings[key] };
    setSettingsState(next);
    setSettings(next);
  };

  return (
    <section className="screen guardian-screen has-tabbar" aria-label="보호자">
      <div className="screen-body">
        <div className="app-bar">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <h2>보호자</h2>
        </div>

        <div className="family-card">
          <div className="role">등록된 보호자</div>
          {hasContact ? (
            <>
              <div className="name">
                {family.relation} {family.name}
              </div>
              <div className="number">{family.phone}</div>
              <div className="family-actions">
                <a className="family-btn" href={`tel:${family.phone.replace(/-/g, '')}`}>
                  <Phone size={18} />
                  전화
                </a>
                <a className="family-btn" href={`sms:${family.phone.replace(/-/g, '')}`}>
                  <Message size={18} />
                  문자
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="name">등록된 보호자가 없어요</div>
              <div className="number">연락처에서 보호자를 선택해 주세요</div>
              <div className="family-actions">
                <button type="button" className="family-btn" onClick={() => startPicker()}>
                  <Phone size={18} />
                  연락처에서 가져오기
                </button>
              </div>
            </>
          )}
        </div>

        {pickerError && <div className="footer-note">{pickerError}</div>}

        <div className="family-edit-actions">
          {hasContact && contactsApi && (
            <button type="button" className="link-row" onClick={() => startPicker()}>
              연락처에서 다시 선택
            </button>
          )}
          <button
            type="button"
            className="link-row"
            onClick={() => setEditingFamily((v) => !v)}
          >
            {editingFamily ? '저장 후 닫기' : '보호자 정보 수정'}
          </button>
          {consentGranted && (
            <button
              type="button"
              className="link-row"
              onClick={revoke}
              style={{ color: 'var(--danger)' }}
            >
              연락처 사용 동의 해제
            </button>
          )}
        </div>

        {editingFamily && (
          <div className="edit-card">
            <label>
              관계
              <input
                type="text"
                value={family.relation}
                onChange={(e) => setFamilyState({ ...family, relation: e.target.value })}
              />
            </label>
            <label>
              이름
              <input
                type="text"
                value={family.name}
                onChange={(e) => setFamilyState({ ...family, name: e.target.value })}
              />
            </label>
            <label>
              전화번호
              <input
                type="tel"
                inputMode="tel"
                value={family.phone}
                onChange={(e) => setFamilyState({ ...family, phone: e.target.value })}
              />
            </label>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                saveFamily(family);
                setEditingFamily(false);
              }}
            >
              저장
            </button>
          </div>
        )}

        <div className="section-title">설정</div>
        <div className="list-card">
          <div className="list-row">
            <div className="ico">
              <Type size={20} />
            </div>
            <div className="lbl">글자 크기</div>
            <div className="val">
              {settings.fontScale === 'normal' && '보통'}
              {settings.fontScale === 'large' && '크게'}
              {settings.fontScale === 'xlarge' && '아주 크게'}
            </div>
            <button
              type="button"
              className="chev-btn"
              aria-label="글자 크기 변경"
              onClick={() => {
                const order: Settings['fontScale'][] = ['normal', 'large', 'xlarge'];
                const next = order[(order.indexOf(settings.fontScale) + 1) % order.length];
                const updated = { ...settings, fontScale: next };
                setSettingsState(updated);
                setSettings(updated);
                document.documentElement.dataset.fontScale = next;
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="list-row">
            <div className="ico">
              <Volume size={20} />
            </div>
            <div className="lbl">음성 안내 음량</div>
            <div className="val">
              {settings.voiceVolume === 'low' && '작게'}
              {settings.voiceVolume === 'normal' && '보통'}
              {settings.voiceVolume === 'loud' && '크게'}
            </div>
            <button
              type="button"
              className="chev-btn"
              aria-label="음량 변경"
              onClick={() => {
                const order: Settings['voiceVolume'][] = ['low', 'normal', 'loud'];
                const next = order[(order.indexOf(settings.voiceVolume) + 1) % order.length];
                const updated = { ...settings, voiceVolume: next };
                setSettingsState(updated);
                setSettings(updated);
                speak('안녕하세요', { volume: volumeFor(next) });
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="list-row">
            <div className="ico">
              <Clock size={20} />
            </div>
            <div className="lbl">통화 전 다시 묻기</div>
            <button
              type="button"
              className={`toggle${settings.confirmBeforeCall ? ' on' : ''}`}
              aria-pressed={settings.confirmBeforeCall}
              onClick={() => toggle('confirmBeforeCall')}
            />
          </div>
        </div>

        <div className="section-title">계정 · 결제</div>
        <div className="list-card">
          <button type="button" className="list-row clickable" onClick={onOpenPayment}>
            <div className="ico">
              <Card size={20} />
            </div>
            <div className="lbl">구독 관리</div>
            <div className="val">{PLAN_LABEL[subscription.plan]}</div>
            <ChevronRight size={18} className="chev" />
          </button>
        </div>

        <div className="footer-note">
          헬프버튼은 송금·비밀번호·인증번호를 절대 자동으로 처리하지 않아요.
        </div>
      </div>
      <BottomTabs active="guardian" onSelect={onTab} />

      {askConsent && <ContactsConsent onAgree={agreeAndContinue} onCancel={cancelConsent} />}
    </section>
  );
}
