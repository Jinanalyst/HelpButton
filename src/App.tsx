// Root component. State-based routing — no react-router dependency.
// Each screen is rendered inside a PhoneFrame for desktop preview;
// on mobile the frame disappears and the screen fills the viewport.

import { useCallback, useEffect, useState } from 'react';
import { PhoneFrame } from './components/PhoneFrame';
import type { Tab } from './components/BottomTabs';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Chat } from './screens/Chat';
import { Result } from './screens/Result';
import { History } from './screens/History';
import { HistoryDetail } from './screens/HistoryDetail';
import { Guardian } from './screens/Guardian';
import { Payment } from './screens/Payment';
import { hasOnboarded, getSettings } from './lib/storage';
import { stopSpeaking } from './lib/speech';
import type { ClassifyResult, HistoryItem } from './lib/types';

type Screen =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'chat' }
  | { name: 'result'; transcript: string; result: ClassifyResult }
  | { name: 'history' }
  | { name: 'history-detail'; item: HistoryItem }
  | { name: 'guardian' }
  | { name: 'payment' };

export default function App() {
  const [screen, setScreen] = useState<Screen>(
    hasOnboarded() ? { name: 'home' } : { name: 'onboarding' },
  );

  // Apply persisted font-scale setting to <html> via a data attribute.
  useEffect(() => {
    const s = getSettings();
    document.documentElement.dataset.fontScale = s.fontScale;
  }, [screen]);

  // Stop any in-flight TTS when the user navigates away.
  useEffect(() => {
    return () => stopSpeaking();
  }, [screen.name]);

  const goTab = useCallback((tab: Tab) => {
    if (tab === 'home') setScreen({ name: 'home' });
    if (tab === 'history') setScreen({ name: 'history' });
    if (tab === 'guardian') setScreen({ name: 'guardian' });
  }, []);

  const content = (() => {
    switch (screen.name) {
      case 'onboarding':
        return <Onboarding onDone={() => setScreen({ name: 'home' })} />;
      case 'home':
        return (
          <Home
            onResult={(transcript, result) =>
              setScreen({ name: 'result', transcript, result })
            }
            onTab={goTab}
            onStartChat={() => setScreen({ name: 'chat' })}
          />
        );
      case 'chat':
        return <Chat onBack={() => setScreen({ name: 'home' })} />;
      case 'result':
        return (
          <Result
            result={screen.result}
            onBack={() => setScreen({ name: 'home' })}
            onRetry={() => setScreen({ name: 'home' })}
          />
        );
      case 'history':
        return (
          <History
            onBack={() => setScreen({ name: 'home' })}
            onTab={goTab}
            onOpen={(item) => setScreen({ name: 'history-detail', item })}
          />
        );
      case 'history-detail':
        return (
          <HistoryDetail item={screen.item} onBack={() => setScreen({ name: 'history' })} />
        );
      case 'guardian':
        return (
          <Guardian
            onBack={() => setScreen({ name: 'home' })}
            onTab={goTab}
            onOpenPayment={() => setScreen({ name: 'payment' })}
          />
        );
      case 'payment':
        return <Payment onBack={() => setScreen({ name: 'guardian' })} />;
    }
  })();

  return <PhoneFrame>{content}</PhoneFrame>;
}
