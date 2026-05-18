// Desktop-only phone shell. On mobile (<720px) it disappears and the app
// renders full-screen — which is what you want on an installed PWA.

import { useEffect, useState, type ReactNode } from 'react';

function formatNow(): string {
  // Uses the device's local timezone (which on a phone follows the user's
  // location) and the user's locale (12h vs 24h).
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(formatNow);

  useEffect(() => {
    let interval = 0;
    const timeout = window.setTimeout(() => {
      setNow(formatNow());
      interval = window.setInterval(() => setNow(formatNow()), 60000);
    }, 60000 - (Date.now() % 60000));
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="frame-wrap">
      <div className="phone">
        <div className="phone-inner">
          <div className="dynamic-island" aria-hidden="true" />
          <div className="status-bar">
            <span>{now}</span>
            <span className="status-right">
              <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5" width="3" height="7" rx="1" />
                <rect x="10" y="2" width="3" height="10" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" opacity=".3" />
              </svg>
              <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="22" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
                <rect x="3" y="3" width="18" height="6" rx="1" fill="currentColor" />
                <rect x="24" y="4" width="1.5" height="4" rx=".5" fill="currentColor" />
              </svg>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
