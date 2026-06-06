// Verifies the two correctness-critical guarantees without any live API call:
//   1. No innocent suspect's prompt contains the killer's identity (no leakage).
//   2. Accusation logic resolves right/wrong + full-solve correctly.

const { SAMPLE_CASE } = require("./server/caseFile");
const { buildSuspectSystemPrompt } = require("./server/promptBuilder");
const { createSession, getSession, resolveAccusation } = require("./server/gameEngine");

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};

console.log("\n— Prompt isolation —");
const killer = SAMPLE_CASE.solution.killerId;
const killerName = SAMPLE_CASE.suspects.find(s => s.id === killer).name;
for (const s of SAMPLE_CASE.suspects) {
  const prompt = buildSuspectSystemPrompt(SAMPLE_CASE, s);
  if (s.isKiller) {
    check(`${s.name} (killer) is told they are guilty`, /YOU ARE THE KILLER/.test(prompt));
  } else {
    // an innocent's prompt must never name the killer or reveal the solution
    const namesKiller = prompt.includes(killerName);
    check(`${s.name} (innocent) prompt does NOT name the killer`, !namesKiller);
    check(`${s.name} (innocent) is framed as innocent`, /You are INNOCENT/.test(prompt));
  }
  // no suspect prompt should contain the raw solution motive text
  check(`${s.name} prompt excludes the solution block`,
    !prompt.includes(SAMPLE_CASE.solution.motive));
}

console.log("\n— Session creation hides the solution from the client —");
const session = createSession();
check("client payload has suspects", Array.isArray(session.suspects) && session.suspects.length === 4);
check("client payload has NO solution field", session.solution === undefined);
check("client payload has NO isKiller flags",
  session.suspects.every(s => s.isKiller === undefined));

console.log("\n— Accusation logic —");
const wrong = resolveAccusation(session.sessionId, "james", "loyalty");
check("wrong accusation marked incorrect", wrong.correct === false);
check("wrong accusation still reveals true killer", wrong.killerId === killer);

const s2 = createSession();
const rightNoMotive = resolveAccusation(s2.sessionId, killer, "");
check("right killer, no motive => correct but not full solve",
  rightNoMotive.correct === true && rightNoMotive.fullSolve === false);

const s3 = createSession();
const fullSolve = resolveAccusation(s3.sessionId, killer, "she was embezzling from the trust");
check("right killer + right motive => full solve",
  fullSolve.correct === true && fullSolve.fullSolve === true);

console.log(`\nResult: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
