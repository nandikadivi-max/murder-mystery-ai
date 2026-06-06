const { v4: uuidv4 } = require("uuid");
const { CASES, getCaseById } = require("./caseFile");
const { buildSuspectSystemPrompt } = require("./promptBuilder");

const sessions = new Map();

function createSession(caseId) {
  const sessionId = uuidv4();
  const caseFile = getCaseById(caseId);

  const suspects = {};
  for (const s of caseFile.suspects) {
    suspects[s.id] = {
      id: s.id, name: s.name, role: s.role, voiceId: s.voiceId,
      systemPrompt: buildSuspectSystemPrompt(caseFile, s),
      history: [],
      turnsCount: 0,   // how many questions asked to THIS suspect
    };
  }

  sessions.set(sessionId, {
    sessionId,
    caseFile,
    suspects,
    questionsAsked: 0,
    hintsUsed: 0,
    solved: false,
    over: false,
    startedAt: Date.now(),
  });

  return {
    sessionId,
    title: caseFile.title,
    premise: caseFile.premise,
    difficulty: caseFile.difficulty,
    publicFacts: caseFile.publicFacts,
    suspects: caseFile.suspects.map((s) => ({ id: s.id, name: s.name, role: s.role })),
  };
}

function getSession(sessionId) { return sessions.get(sessionId); }

function getSuspect(sessionId, suspectId) {
  const s = sessions.get(sessionId);
  return s ? (s.suspects[suspectId] || null) : null;
}

function recordTurn(sessionId, suspectId, userText, assistantText) {
  const suspect = getSuspect(sessionId, suspectId);
  if (!suspect) return;
  suspect.history.push({ role: "user", content: userText });
  suspect.history.push({ role: "assistant", content: assistantText });
  suspect.turnsCount += 1;
  sessions.get(sessionId).questionsAsked += 1;
}

function getSuspectTurns(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return {};
  const result = {};
  for (const [id, s] of Object.entries(session.suspects)) result[id] = s.turnsCount;
  return result;
}

function getHint(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Unknown session." };
  if (session.over) return { error: "Round is over." };
  const MAX = 3;
  if (session.hintsUsed >= MAX) return { error: "No hints remaining.", hintsUsed: session.hintsUsed, maxHints: MAX };
  const hint = session.caseFile.hints[session.hintsUsed];
  session.hintsUsed += 1;
  return { hint, hintsUsed: session.hintsUsed, maxHints: MAX, hintsRemaining: MAX - session.hintsUsed };
}

function resolveAccusation(sessionId, accusedId, statedMotive = "") {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Unknown session." };

  const cf = session.caseFile;
  const correctKiller = cf.solution.killerId;
  const isRight = accusedId === correctKiller;
  const motiveWords = cf.solution.motive.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  const motiveHit = isRight && motiveWords.some(k => statedMotive.toLowerCase().includes(k));
  const elapsed = Math.round((Date.now() - session.startedAt) / 1000);

  session.over = true;
  session.solved = isRight;

  return {
    correct: isRight,
    fullSolve: isRight && motiveHit,
    killerId: correctKiller,
    killerName: cf.suspects.find(s => s.id === correctKiller).name,
    weapon: cf.solution.weapon,
    motive: cf.solution.motive,
    questionsAsked: session.questionsAsked,
    hintsUsed: session.hintsUsed,
    difficulty: cf.difficulty,
    elapsedSeconds: elapsed,
    suspectTurns: getSuspectTurns(sessionId),
  };
}

module.exports = { createSession, getSession, getSuspect, recordTurn, getHint, resolveAccusation, CASES };
