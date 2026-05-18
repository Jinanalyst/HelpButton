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
  stopAiAudio();
}

// ---------------- OpenAI TTS (alloy) via /api/tts ----------------

let currentAiAudio: HTMLAudioElement | null = null;

export function stopAiAudio(): void {
  if (currentAiAudio) {
    try {
      currentAiAudio.pause();
      currentAiAudio.src = '';
    } catch {
      /* ignore */
    }
    currentAiAudio = null;
  }
}

/**
 * Speak Korean text using OpenAI tts-1 (alloy). Falls back to SpeechSynthesis
 * if the endpoint isn't reachable or fails. Always cancels any prior speech.
 */
export async function speakAi(
  text: string,
  opts: { volume?: number; voice?: 'alloy' | 'shimmer' | 'nova' } = {},
): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  try {
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: opts.voice ?? 'alloy' }),
    });
    if (!resp.ok) throw new Error(`tts_http_${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = opts.volume ?? 1.0;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAiAudio === audio) currentAiAudio = null;
    };
    currentAiAudio = audio;
    await audio.play();
  } catch {
    // Fall back to browser TTS so seniors still hear something.
    speak(text, { volume: opts.volume });
  }
}

// ---------------- Whisper STT via /api/stt ----------------

export interface RecordHandle {
  promise: Promise<string>;
  stop: () => void;
  cancel: () => void;
}

/**
 * Record from the mic until stop() is called, then upload to /api/stt and
 * resolve with the Whisper transcript. Rejects with Error('mic_denied'),
 * Error('no_speech_detected'), Error('stt_unavailable'), or Error('cancelled').
 */
export function recordToWhisper(): RecordHandle {
  let cancelled = false;
  let stopRequested = false;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;

  const promise = new Promise<string>(async (resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      reject(new Error('mic_unsupported'));
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      reject(new Error('mic_denied'));
      return;
    }
    const mime = pickRecorderMime();
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      cleanup();
      reject(new Error('mic_unsupported'));
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error('mic_error'));
    };
    recorder.onstop = async () => {
      cleanup();
      if (cancelled) {
        reject(new Error('cancelled'));
        return;
      }
      const blob = new Blob(chunks, { type: chunks[0]?.type || mime || 'audio/webm' });
      if (blob.size < 1000) {
        reject(new Error('no_speech_detected'));
        return;
      }
      try {
        const form = new FormData();
        form.append('audio', blob, `recording.${extFor(blob.type)}`);
        const resp = await fetch('/api/stt', { method: 'POST', body: form });
        if (!resp.ok) {
          reject(new Error('stt_unavailable'));
          return;
        }
        const payload = (await resp.json()) as { text?: string; error?: string };
        if (!payload.text) {
          reject(new Error(payload.error || 'no_speech_detected'));
          return;
        }
        resolve(payload.text);
      } catch {
        reject(new Error('stt_unavailable'));
      }
    };
    recorder.start();

    // Hard cap so seniors who forget to release don't burn the API.
    setTimeout(() => {
      if (!stopRequested && recorder && recorder.state === 'recording') {
        stopRequested = true;
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
    }, 30_000);
  });

  function cleanup() {
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
  }

  return {
    promise,
    stop: () => {
      stopRequested = true;
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
    },
    cancel: () => {
      cancelled = true;
      stopRequested = true;
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function extFor(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}
