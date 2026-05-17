import { useState } from 'react';
import { BottomTabs, type Tab } from '../components/BottomTabs';
import {
  Bell,
  Card,
  ChevronLeft,
  ChevronRight,
  Clock,
  Message,
  Phone,
  Type,
  Volume,
} from '../lib/icons';
import { getFamily, getSettings, setFamily as saveFamily, setSettings } from '../lib/storage';
import type { Settings } from '../lib/types';

interface Props {
  onBack: () => void;
  onTab: (t: Tab) => void;
  onOpenPayment: () => void;
}

export function Guardian({ onBack, onTab, onOpenPayment }: Props) {
  const [family, setFamilyState] = useState(getFamily());
  const [settings, setSettingsState] = useState<Settings>(getSettings());
  const [editingFamily, setEditingFamily] = useState(false);

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
        </div>

        <button
          type="button"
          className="link-row"
          onClick={() => setEditingFamily((v) => !v)}
        >
          {editingFamily ? '저장 후 닫기' : '보호자 정보 수정'}
        </button>

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
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="list-row">
            <div className="ico">
              <Bell size={20} />
            </div>
            <div className="lbl">위험 시 자동 가족 알림</div>
            <button
              type="button"
              className={`toggle${settings.autoFamilyAlert ? ' on' : ''}`}
              aria-pressed={settings.autoFamilyAlert}
              onClick={() => toggle('autoFamilyAlert')}
            />
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
            <div className="val">무료</div>
            <ChevronRight size={18} className="chev" />
          </button>
        </div>

        <div className="footer-note">
          헬프버튼은 송금·비밀번호·인증번호를 절대 자동으로 처리하지 않아요.
        </div>
      </div>
      <BottomTabs active="guardian" onSelect={onTab} />
    </section>
  );
}
