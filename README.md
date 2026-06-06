# The Blackwood Affair — a voice-based AI murder-mystery

A working prototype of your concept: a single detective (the player) interrogates
3–4 AI suspects by voice. One suspect is secretly the killer and adapts to your
questioning; the innocents have their own secrets, lies, and real clues. Web-based.

## Run it

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY
npm start                 # http://localhost:3000
```

Open the page, pick a suspect, and either type or click **● Speak** to question
them. When ready, hit **Make Your Accusation**.

> Without API keys the server still boots and the game logic runs (see
> `node test.js`), but live suspect replies and voices need the two keys.

## How it's built (and why)

**The truth is precomputed; the lies are live.** A *case file* (`server/caseFile.js`)
is the frozen ground truth of a round — killer, weapon, motive, a full timeline,
and each suspect's private knowledge/secrets/lies. The facts never change, so
deduction actually works; only each suspect's *evasion* adapts in the moment.
That's where "every round feels different" really comes from.

**Per-suspect context isolation** (`server/promptBuilder.js`). Each suspect is a
separate LLM conversation whose system prompt contains ONLY their slice of the
case file plus shared public facts. Innocents literally never receive the
killer's identity, so they can't leak it. `node test.js` verifies this.

**Shared timeline = cross-checkable alibis.** Because every suspect cites the same
fixed timeline, two honest accounts agree — which is what lets a sharp detective
catch the killer in a contradiction.

**Game engine** (`server/gameEngine.js`) holds per-session state in memory, keeps
each suspect's isolated conversation history, and resolves accusations (right
killer = solved; right killer + right motive = a "perfect solve").

**AI layer** (`server/ai.js`): Anthropic for the suspect reply (streamed),
ElevenLabs for text-to-speech in each suspect's own voice (streamed). Captions
appear from the LLM before audio finishes, so it never feels dead.

## Architecture at a glance

```
browser (mic + playback + UI)
   │  speech-to-text  (Web Speech API in this prototype)
   ▼
POST /api/interrogate ──► gameEngine ──► promptBuilder ──► Anthropic (reply)
                                                              │
POST /api/speak ───────────────────────► ElevenLabs TTS ◄────┘ (suspect voice)
POST /api/accuse  ──► resolveAccusation ──► verdict
```

## Roadmap / what to harden next

- **STT upgrade.** The prototype uses the browser's Web Speech API. Swap in
  ElevenLabs STT or another streaming STT for quality + consistency.
- **WebSockets + barge-in.** Move to a socket so audio streams both directions
  and the player can interrupt a suspect mid-sentence.
- **Generated cases.** Author more cases by hand, or generate one per round with
  a strong LLM call validated against the case-file schema.
- **Consistency validator.** Optional cheap check of each reply against the case
  file to flag hard contradictions before audio plays.
- **Difficulty dial.** How much innocents volunteer vs. how hard the killer
  deflects is your main knob — it already lives in the suspect prompts.
- **Multiplayer (later).** Ship single-player first; add shared sessions after.

## A note on ElevenLabs

This uses ElevenLabs for TTS (a distinct voice per suspect) while keeping the
suspect logic in your own backend — you need that control over per-character
game state, which is the whole game. ElevenLabs also has a bundled
Conversational AI / Agents product; it's lower-latency but makes injecting and
isolating per-character state harder, so own the orchestration yourself. Check
their current docs before committing either way.
