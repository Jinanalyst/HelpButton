import { Clock, Home, User } from '../lib/icons';

export type Tab = 'home' | 'history' | 'guardian';

interface Props {
  active: Tab;
  onSelect: (t: Tab) => void;
}

export function BottomTabs({ active, onSelect }: Props) {
  return (
    <nav className="tab-bar" aria-label="주요 화면">
      <button
        className={`tab${active === 'home' ? ' active' : ''}`}
        onClick={() => onSelect('home')}
        type="button"
      >
        <Home size={26} />
        <span>홈</span>
      </button>
      <button
        className={`tab${active === 'history' ? ' active' : ''}`}
        onClick={() => onSelect('history')}
        type="button"
      >
        <Clock size={26} />
        <span>기록</span>
      </button>
      <button
        className={`tab${active === 'guardian' ? ' active' : ''}`}
        onClick={() => onSelect('guardian')}
        type="button"
      >
        <User size={26} />
        <span>보호자</span>
      </button>
    </nav>
  );
}
