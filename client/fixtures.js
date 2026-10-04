// Fresh Playlogue frontend. Demo fixtures are never live research or provider results.
const themes = [
  { id: "T1", fixed_id: "F1", name: "Decision clarity", text: "Think about one recent round of this mode. How did you decide what to do next?", budget: 2 },
  { id: "T2", fixed_id: "F2", name: "Equipment decisions", text: "Tell me about an equipment decision you made in that round.", budget: 2 },
  { id: "T3", fixed_id: "F3", name: "Return intention", text: "What would influence whether you play this mode again?", budget: 2 }
];
const demoGuide = { id: "fixture-guide-v1", version: 1, title: "Heichao Baopo play experience", goal: "Understand decisions, equipment choices and factors influencing whether to play again.", game: "Delta Force", platform: "PC", region: "Mainland China", mode: "Heichao Baopo (黑潮爆破)", game_build: "UNKNOWN", language: "en", themes, published_at: "2026-10-03T22:00:00Z" };
const probes = { T1: ["What information was available when you made that decision?", "What happened after you chose what to do?"], T2: ["What alternatives did you consider for that equipment decision?", "How did that choice affect the round?"], T3: ["Can you describe a specific experience behind that consideration?", "What, if anything, would change that decision?"] };
const answers = [
  ["I followed my squad toward the objective. I could see their markers, but I was not sure which route was safe.", "I chose a lighter loadout so I could keep up with my squad. I gave up some protection to move faster.", "I would play again with the same group. Alone, I would hesitate because I did not know which route to take."],
  ["I waited near the objective until I heard footsteps. The sound gave me more confidence than the map did.", "I kept the equipment I already knew. I did not want to learn a new setup in the middle of a round.", "I would return to try a different setup. Having time to practice it first would make that easier."]
];
function fixtureSessions() {
  return answers.map((texts, i) => ({ id: `fixture-${i + 1}`, guide_id: demoGuide.id, origin: "demo_fixture", status: "ended", phase: "exploration", step: "ready_to_finish", state_version: 7, content_revision: 6, evidence_revision: 6, created_at: `2026-10-03T22:${i ? "40" : "15"}:00Z`, expires_at: "2026-10-10T22:00:00Z", end_reason: "completed", mode: "text", mode_group: "text_only", used: { T1: 0, T2: 0, T3: 0 }, blocked: [], current: null, questions: themes.map((t, j) => ({ id: `fixture-${i + 1}-q${j + 1}`, theme_id: t.id, fixed_question_id: t.fixed_id, kind: "fixed", actual_text: t.text, sequence: j + 1 })), answers: texts.map((text, j) => ({ id: `fixture-${i + 1}-a${j + 1}`, question_id: `fixture-${i + 1}-q${j + 1}`, revision: 1, final_text: text, response_status: "valid", input_mode: "text", edited_transcript: false, submitted_at: `2026-10-03T22:${i ? "40" : "15"}:00Z` })) }));
}
function fixtureFinding(s) {
  const original = fixtureSessions().find((x) => x.id === s.id);
  if (!original) return null;
  const a = original.answers[0];
  return { id: `finding-${s.id}`, claim: s.id === "fixture-2" ? "In this fictional account, audio cues helped the participant decide when to act." : "In this fictional account, squad context helped the participant decide what to do next.", theme_ids: ["T1"], review_status: "pending", unknowns: ["This example does not establish how common the experience is.", "No counterevidence has been fully assessed."], supporting_spans: [{ session_id: s.id, question_id: a.question_id, answer_id: a.id, answer_revision: a.revision, start_utf16: 0, end_utf16: a.final_text.length, exact_quote: a.final_text, input_content_revision: original.content_revision }], counter_spans: [], stale: s.content_revision !== original.content_revision };
}
export {
  demoGuide,
  fixtureFinding,
  fixtureSessions,
  probes,
  themes
};
