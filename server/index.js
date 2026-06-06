const path = require("path");
// Load env from CWD first (common in deploy setups), then fall back to project root.
require("dotenv").config();
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
  override: false,
});
const express = require("express");
const { createSession, getSession, getSuspect, recordTurn, getHint, resolveAccusation, CASES } = require("./gameEngine");
const { generateSuspectReply, synthesizeSpeech } = require("./ai");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
// Narrator voice — deep, cinematic. Change this voice ID to any ElevenLabs voice you prefer.
const NARRATOR_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George — deep British narrator

// List cases (no solutions).
app.get("/api/cases", (req, res) => {
  res.json(CASES.map(c => ({
    id: c.id, title: c.title, setting: c.setting,
    emoji: c.emoji, difficulty: c.difficulty, suspectCount: c.suspects.length,
  })));
});

// Start session.
app.post("/api/session", (req, res) => {
  const { caseId } = req.body || {};
  res.json(createSession(caseId));
});

// Interrogate a suspect.
app.post("/api/interrogate", async (req, res) => {
  const { sessionId, suspectId, question } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "Unknown session." });
  if (session.over) return res.status(400).json({ error: "Round is over." });
  const suspect = getSuspect(sessionId, suspectId);
  if (!suspect) return res.status(404).json({ error: "Unknown suspect." });
  try {
    const reply = await generateSuspectReply(suspect, question);
    recordTurn(sessionId, suspectId, question, reply);
    res.json({ suspectId, name: suspect.name, reply, voiceId: suspect.voiceId, questionsAsked: session.questionsAsked, turnsCount: suspect.turnsCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate reply." });
  }
});

// Get hint.
app.post("/api/hint", (req, res) => {
  const result = getHint(req.body.sessionId);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// Narrate the case intro using ElevenLabs.
app.post("/api/narrate", async (req, res) => {
  const { text } = req.body;
  if (!ELEVENLABS_KEY) return res.status(503).json({ error: "No ElevenLabs key." });
  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${NARRATOR_VOICE_ID}/stream`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.72, similarity_boost: 0.6, style: 0.3 },
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("Narrator TTS error:", err);
      return res.status(500).json({ error: "Narration failed." });
    }
    res.setHeader("Content-Type", "audio/mpeg");
    const reader = r.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Narration failed." });
  }
});

// Suspect TTS.
app.post("/api/speak", async (req, res) => {
  const { text, voiceId } = req.body;
  try {
    const audioStream = await synthesizeSpeech(text, voiceId);
    res.setHeader("Content-Type", "audio/mpeg");
    const reader = audioStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "TTS failed." });
  }
});

// Accuse.
app.post("/api/accuse", (req, res) => {
  const { sessionId, suspectId, motive } = req.body;
  const result = resolveAccusation(sessionId, suspectId, motive || "");
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Murder Mystery AI → http://localhost:${PORT}`));
