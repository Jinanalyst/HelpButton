// Vercel serverless function — runs on Node 22.
// POST /api/stt  body: multipart/form-data, field "audio" = recorded blob
// Returns: { text: string }
//
// Uses OpenAI Whisper (whisper-1). Far better at Korean senior speech
// (slow cadence, dialect, background noise) than the browser Web Speech API.

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

export const config = { runtime: 'nodejs' };

const client = new OpenAI();

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!process.env.OPENAI_API_KEY) return json({ error: 'api_key_missing' }, 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'invalid_form' }, 400);
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob)) return json({ error: 'audio_required' }, 400);

  // Cap: ~25MB (Whisper limit) and refuse anything obviously oversized.
  if (audio.size > 25 * 1024 * 1024) return json({ error: 'audio_too_large' }, 413);
  if (audio.size < 200) return json({ error: 'audio_too_short' }, 400);

  // Infer filename extension from MIME so Whisper accepts the upload.
  const mime = audio.type || 'audio/webm';
  const ext = mime.includes('mp4')
    ? 'mp4'
    : mime.includes('ogg')
      ? 'ogg'
      : mime.includes('wav')
        ? 'wav'
        : mime.includes('mpeg')
          ? 'mp3'
          : 'webm';

  try {
    const file = await toFile(audio, `recording.${ext}`, { type: mime });
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ko',
      // Faster, single-shot; no segments needed.
      response_format: 'json',
    });

    const text = (transcription.text || '').trim();
    if (!text) return json({ error: 'no_speech_detected' }, 200);
    return json({ text }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'stt_failed', detail: message }, 502);
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
