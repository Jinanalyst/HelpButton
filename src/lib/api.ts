// Client-side wrapper for the /api/classify serverless function.
// Never fabricates classifications — if the server is unreachable we throw
// a typed error and let the UI tell the user honestly. A fake "this looks
// like phishing" or "this is safe" response would be dangerous.

import type { ClassifyEnvelope, ClassifyResult } from './types';

const ENDPOINT = '/api/classify';

export type ClassifyErrorReason = 'offline' | 'server' | 'rate_limited' | 'unknown';

export class ClassifyUnavailableError extends Error {
  readonly reason: ClassifyErrorReason;
  constructor(reason: ClassifyErrorReason) {
    super(`classify_unavailable:${reason}`);
    this.name = 'ClassifyUnavailableError';
    this.reason = reason;
  }
}

export async function classify(transcript: string): Promise<ClassifyResult> {
  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
  } catch {
    throw new ClassifyUnavailableError('offline');
  }

  if (!resp.ok) {
    if (resp.status === 429) throw new ClassifyUnavailableError('rate_limited');
    if (resp.status >= 500 || resp.status === 404) throw new ClassifyUnavailableError('server');
    throw new ClassifyUnavailableError('unknown');
  }

  const payload = (await resp.json()) as ClassifyEnvelope;
  if (!payload?.result) throw new ClassifyUnavailableError('server');
  return payload.result;
}
