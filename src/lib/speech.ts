// Web Speech API wrappers — STT (recognition) + TTS (synthesis).
// Korean (ko-KR) primary. Gracefully degrades when unsupported (Firefox, older Safari).

// The DOM lib in TS doesn't ship SpeechRecognition types — declare what we use.
type RecognitionResult = { transcript: string; confidence: number };

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<RecognitionResult>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface ListenOptions {
  lang?: string;
  onPartial?: (text: string) => void;
  onError?: (code: string) => void;
}

export interface ListenHandle {
  promise: Promise<string>;
  cancel: () => void;
}

/**
 * Start a single-shot voice recognition. Resolves with the best Korean transcript
 * when the user stops speaking, or rejects with an Error if unsupported / errored.
 */
export function listenOnce(opts: ListenOptions = {}): ListenHandle {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return {
      promise: Promise.reject(new Error('speech_recognition_unsupported')),
      cancel: () => {},
    };
  }

  const rec = new Ctor();
  rec.lang = opts.lang ?? 'ko-KR';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  let cancelled = false;

  const promise = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      let combined = '';
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (alt) combined += alt.transcript;
      }
      finalText = combined;
      opts.onPartial?.(combined);
    };
    rec.onerror = (e) => {
      opts.onError?.(e.error);
      reject(new Error(`speech_error:${e.error}`));
    };
    rec.onend = () => {
      if (cancelled) {
        reject(new Error('cancelled'));
        return;
      }
      const trimmed = finalText.trim();
      if (!trimmed) {
        reject(new Error('no_speech_detected'));
        return;
      }
      resolve(trimmed);
    };

    try {
      rec.start();
    } catch (err) {
      reject(err instanceof Error ? err : new Error('start_failed'));
    }
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Map the persisted voiceVolume setting to a 0–1 utterance volume. */
export function volumeFor(setting: 'low' | 'normal' | 'loud'): number {
  if (setting === 'low') return 0.35;
  if (setting === 'loud') return 1.0;
  return 0.7;
}

/** Speak Korean text aloud via SpeechSynthesis. Safe no-op when unsupported. */
export function speak(text: string, opts: { rate?: number; volume?: number } = {}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = opts.rate ?? 0.95; // slightly slower for seniors
    u.volume = opts.volume ?? 1.0;
    // Cancel any in-flight utterance so we don't queue up.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
