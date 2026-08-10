# Murder Mystery AI 🕵️

A voice-based AI interrogation game: you're the detective, and you question AI suspects to find the killer before time runs out.

**Play it live:** https://murder-mystery-ai.onrender.com

Built by [Nandika Divi](https://github.com/nandikadivi-max) and [Buland Choudhary](https://github.com/Buland-Choudhary) at the Rebuild x ElevenLabs hackathon in New York City.

## The game

Pick a case, interrogate 3-4 suspects by voice or text, cross-check their alibis, and make your accusation. One suspect is the killer and adapts to your questioning; the innocents have their own secrets, lies, and real clues. Name the right killer to solve the case — name the killer *and* the motive for a perfect solve.

- **9 hand-crafted cases** across 3 difficulty levels (easy / medium / hard) — from a locked-study manor murder to a killing in an escape room
- **Real-time AI suspects** powered by Claude, each with a distinct personality and their own private knowledge
- **A unique voice per suspect** via ElevenLabs text-to-speech, with streamed replies and live captions
- **Voice input** through the Web Speech API
- Progressive **hint system** (3 per case), live **timer**, and **scoring**

## The design problem: how do you stop a suspect from leaking the killer?

Prompt instructions like "don't spoil the ending" aren't reliable. We made leaks structurally impossible instead:

- **The truth is precomputed; the lies are live.** Each case file (`server/caseFile.js`) is the frozen ground truth of a round — killer, weapon, motive, full timeline, and every suspect's private knowledge, secrets, and lies. The facts never change, so deduction actually works; only each suspect's evasion adapts in the moment.
- **Per-suspect context isolation** (`server/promptBuilder.js`). Each suspect is a completely separate Claude conversation whose system prompt contains *only* their slice of the case file plus shared public facts. Innocent suspects never receive the killer's identity — you can't leak what you were never told. `node test.js` verifies this.
- **A shared timeline means cross-checkable alibis.** Every suspect cites the same fixed timeline, so two honest accounts agree — which is what lets a sharp detective catch the killer in a contradiction.

## How it works

Browser (mic + playback + UI, Web Speech API for speech-to-text) sends each question to `POST /api/interrogate`, which runs through the game engine and prompt builder to Claude for a streamed reply. `POST /api/speak` turns the reply into audio in the suspect's own voice via ElevenLabs TTS, and `POST /api/accuse` resolves your accusation into a verdict.

The game engine (`server/gameEngine.js`) holds per-session state in memory, keeps each suspect's isolated conversation history, and resolves accusations. The AI layer (`server/ai.js`) streams Claude replies and ElevenLabs audio, so captions appear before the audio finishes and the interrogation never feels dead.

## Run it locally

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY
npm start              # http://localhost:3000
```

Without API keys the server still boots and the game logic runs (`node test.js`), but live suspect replies and voices need the two keys.

## Tech stack

Node.js · Anthropic API (streaming) · ElevenLabs TTS · Web Speech API · vanilla JS frontend

## What we'd build next

- Streaming STT (e.g. ElevenLabs STT) to replace the browser Web Speech API
- WebSockets with barge-in, so you can interrupt a suspect mid-sentence
- LLM-generated cases, validated against the case-file schema
- A consistency validator that checks each reply against the case file before audio plays
- Multiplayer shared sessions
