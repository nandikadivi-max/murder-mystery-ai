/**
 * AI LAYER — LLM turn (Anthropic) + ElevenLabs text-to-speech.
 *
 * Flow per interrogation turn:
 *   detective text  ->  suspect LLM reply (constrained by their case slice)
 *                   ->  ElevenLabs TTS in that suspect's voice  ->  audio
 *
 * Both calls stream so the suspect can begin speaking before the full reply is
 * generated — non-negotiable for voice; otherwise pauses feel dead.
 */

const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;

/**
 * Generate a suspect's reply. Returns the full text (and you can stream tokens
 * to the client via the onToken callback for live captions).
 */
async function generateSuspectReply(suspect, detectiveText, onToken) {
  const messages = [
    ...suspect.history,
    { role: "user", content: detectiveText },
  ];

  let full = "";
  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-20250514",
    max_tokens: 300, // replies are short spoken dialogue
    system: suspect.systemPrompt,
    messages,
  });

  stream.on("text", (delta) => {
    full += delta;
    if (onToken) onToken(delta);
  });

  await stream.finalMessage();
  return full.trim();
}

/**
 * Convert a suspect's reply to speech in their own voice via ElevenLabs.
 * Returns a ReadableStream of audio bytes you can pipe to the client.
 */
async function synthesizeSpeech(text, voiceId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5", // low-latency model for conversational use
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail}`);
  }
  return res.body; // stream of audio/mpeg bytes
}

module.exports = { generateSuspectReply, synthesizeSpeech };
