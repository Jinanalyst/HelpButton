// Vercel serverless function — runs on Node 22.
// POST /api/tts  body: { text: string, voice?: 'alloy'|'shimmer'|'nova' }
// Returns: audio/mpeg (mp3 bytes). Voice defaults to 'alloy'.
//
// Uses OpenAI tts-1. Cheap (~$15/1M chars) and produces natural Korean
// audio that's clearly better than the browser SpeechSynthesis voices,
// which is the main UX win for senior users.

import OpenAI from 'openai';

export const config = { runtime: 'nodejs' };

const client = new OpenAI(); // reads OPENAI_API_KEY

type VoiceId = 'alloy' | 'shimmer' | 'nova';
const ALLOWED_VOICES: VoiceId[] = ['alloy', 'shimmer', 'nova'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { text?: unknown; voice?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'text_required' }, 400);
  if (text.length > 800) return json({ error: 'text_too_long' }, 400);

  const requestedVoice = typeof body.voice === 'string' ? body.voice : 'alloy';
  const voice: VoiceId = (ALLOWED_VOICES as string[]).includes(requestedVoice)
    ? (requestedVoice as VoiceId)
    : 'alloy';

  if (!process.env.OPENAI_API_KEY) return json({ error: 'api_key_missing' }, 500);

  try {
    const speech = await client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3',
      // Slightly slower for seniors — easier to follow.
      speed: 0.95,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'tts_failed', detail: message }, 502);
  }
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}
