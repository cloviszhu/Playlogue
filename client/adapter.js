// Fresh Playlogue frontend. Demo fixtures are never live research or provider results.
import {gameplayExample}from'../shared/detonation-case.mjs';
import { demoGuide, fixtureSessions, fixtureFinding, probes } from "./fixtures.js";
const clone = (x) => structuredClone(x);
const modeGroup = (s) => {
  const modes = new Set(s.answers.map((a) => a.input_mode));
  return modes.size > 1 ? "mixed" : modes.has("voice") ? "voice_only" : modes.has("text") ? "text_only" : "no_answers";
};
const eligibilityMode = (s) => {
  if (s.eligibility_mode_group) return s.eligibility_mode_group;
  const actual = s.mode_group || modeGroup(s);
  if (actual !== "no_answers") return actual;
  const initial = s.initial_mode || s.mode_history?.[0];
  const unchanged = Array.isArray(s.mode_history) && s.mode_history.every(mode => mode === initial);
  return unchanged && ["text", "voice"].includes(initial) ? initial + "_only" : "no_answers";
};
const currentQuestion = (s) => s.questions.find((q) => q.id === s.current);
function validateSpan(span, s) {
  const a = s?.answers.find((a2) => a2.id === span.answer_id);
  const start = span.start_utf16, end = span.end_utf16;
  if (!a || s.content_revision !== span.input_content_revision || a.revision !== span.answer_revision || a.question_id !== span.question_id || a.response_status !== "valid" || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > a.final_text.length || !span.exact_quote) return false;
  const splits = (i) => i > 0 && i < a.final_text.length && /[\uD800-\uDBFF]/.test(a.final_text[i - 1]) && /[\uDC00-\uDFFF]/.test(a.final_text[i]);
  return !splits(start) && !splits(end) && a.final_text.slice(start, end) === span.exact_quote;
}
class AdapterError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
function createDemoAdapter({ storage, delay = 180 } = {}) {
  let guide = clone(demoGuide), sessions = fixtureSessions(), reviews = {};
  try {
    const saved = JSON.parse(storage?.getItem("playlogue.frontend.demo") || "null");
    if (saved) {
      sessions = saved.sessions;
      guide = saved.guide;
      reviews = saved.reviews || {};
    }
  } catch {
  }
  const persist = () => storage?.setItem("playlogue.frontend.demo", JSON.stringify({ sessions, guide, reviews }));
  let nextError = null;
  async function wait() {
    await new Promise((r) => setTimeout(r, delay));
    if (nextError) {
      const error = nextError;
      nextError = null;
      throw error;
    }
  }
  const find = (id) => {
    const s = sessions.find((s2) => s2.id === id);
    if (!s) throw new AdapterError("NOT_FOUND", "This session is unavailable.");
    return s;
  };
  function ask(s, t, kind, text) {
    const q = { id: crypto.randomUUID(), theme_id: t.id, kind, actual_text: text, sequence: s.questions.length + 1, ...kind === "fixed" ? { fixed_question_id: t.fixed_id } : { parent_question_id: s.questions.filter((q2) => q2.theme_id === t.id).at(-1)?.id } };
    s.questions.push(q);
    s.current = q.id;
    s.step = "awaiting_answer";
  }
  function advance(s) {
    const frozen = s.guide_snapshot || demoGuide;
    if (s.questions.filter((q) => q.kind === "fixed").length < 3) {
      const t = frozen.themes[s.questions.filter((q) => q.kind === "fixed").length];
      ask(s, t, "fixed", t.text);
      return;
    }
    s.phase = "exploration";
    for (const t of frozen.themes) {
      if (!s.blocked.includes(t.id) && s.used[t.id] < t.budget) {
        const text = probes[t.id][s.used[t.id]];
        s.used[t.id]++;
        ask(s, t, "probe", text);
        return;
      }
    }
    s.status = "ended";
    s.end_reason = "completed";
    s.current = null;
    s.step = "ready_to_finish";
  }
  return {
    kind: "demo",
    capabilities: { voice: false, analysis: false, publish: true, review: true },
    failNext(code = "NETWORK_ERROR") {
      nextError = new AdapterError(code, "Demo save interrupted. Your draft is still here.", true);
    },
    async loadStudy() {
      await wait();
      return { guide: clone(guide), live_enabled: false, processing: "Local frontend demo. No AI, audio, or server requests." };
    },
    async listSessions() {
      await wait();
      return clone(sessions.filter((s) => s.status !== "withdrawn"));
    },
    async getSession(id) {
      await wait();
      return clone(find(id));
    },
    async publish(draft) {
      await wait();
      guide = { ...clone(draft), id: crypto.randomUUID(), version: guide.version + 1, published_at: (/* @__PURE__ */ new Date()).toISOString() };
      persist();
      return clone(guide);
    },
    async startSession({ consent, mode = "text", origin = "demo_fixture" }) {
      await wait();
      if (!consent.adult_confirmed || !consent.research_agreed || !consent.cloud_agreed) throw new AdapterError("CONSENT_REQUIRED", "Please confirm both consent statements.");
      if (origin !== "demo_fixture") throw new AdapterError("DEMO_ONLY", "The local adapter accepts fictional practice only.");
      const s = { id: crypto.randomUUID(), guide_id: guide.id, guide_snapshot: clone(guide), origin, status: "active", phase: "fixed", step: "awaiting_answer", state_version: 0, content_revision: 0, evidence_revision: 0, created_at: (/* @__PURE__ */ new Date()).toISOString(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), mode, mode_history: [mode], questions: [], answers: [], used: { T1: 0, T2: 0, T3: 0 }, blocked: [], current: null };
      ask(s, guide.themes[0], "fixed", guide.themes[0].text);
      sessions.push(s);
      persist();
      return clone(s);
    },
    async command(id, c) {
      await wait();
      const s = find(id);
      if (!["pause", "end", "withdraw"].includes(c.type) && c.expected_state_version !== s.state_version) throw new AdapterError("STATE_CONFLICT", "The session changed. Reload it before continuing.", true);
      if (s.status === "ended" && !["correct", "withdraw"].includes(c.type)) throw new AdapterError("TERMINATED", "This interview has ended.");
      if (s.status === "paused" && !["resume", "end", "withdraw"].includes(c.type)) throw new AdapterError("PAUSED", "Resume the interview to continue.");
      if (c.type === "answer") {
        if (c.question_id !== s.current) throw new AdapterError("QUESTION_CONFLICT", "The question changed. Reload your session.", true);
        if (c.response_status === "valid" && (!c.final_text?.trim() || c.final_text.length > 1500)) throw new AdapterError("INVALID_ANSWER", "Enter an answer of up to 1,500 characters.");
        const q = currentQuestion(s);
        s.answers.push({ id: crypto.randomUUID(), question_id: q.id, revision: 1, final_text: c.response_status === "valid" ? c.final_text.trim() : "", response_status: c.response_status, input_mode: s.mode, edited_transcript: !!c.edited_transcript });
        if (c.response_status === "refused") s.blocked.push(q.theme_id);
        s.content_revision++;
        s.evidence_revision++;
        advance(s);
      } else if (c.type === "pause") {
        if (s.status !== "ended") s.status = "paused";
      } else if (c.type === "resume") s.status = "active";
      else if (c.type === "end") {
        s.status = "ended";
        s.current = null;
        s.end_reason = "participant_end";
      } else if (c.type === "switch_mode") {
        s.mode = c.mode;
        s.mode_history.push(c.mode);
      } else if (c.type === "skip_topic") {
        const q = currentQuestion(s);
        s.blocked.push(q.theme_id);
        if (q.kind === "probe") advance(s);
      } else if (c.type === "correct") {
        const a = s.answers.find((a2) => a2.id === c.answer_id);
        if (!a || a.revision !== c.answer_revision) throw new AdapterError("ANSWER_CONFLICT", "This answer has changed. Reload before editing.");
        if (!c.final_text?.trim() || c.final_text.length > 1500 || !c.reason?.trim()) throw new AdapterError("INVALID_ANSWER", "An answer and a correction reason are required.");
        a.final_text = c.final_text.trim();
        a.revision++;
        s.content_revision++;
        s.evidence_revision++;
      } else if (c.type === "withdraw") {
        s.status = "withdrawn";
        s.questions = [];
        s.answers = [];
        s.current = null;
      } else throw new AdapterError("UNSUPPORTED", "This action is not connected.");
      s.state_version++;
      s.mode_group = modeGroup(s);
      persist();
      return clone(s);
    },
    async analysis(ids) {
      await wait();
      return { id: "fixture-analysis", origin: "demo_fixture", status: "complete", findings: ids.map((id) => {
        const f = fixtureFinding(find(id));
        return f ? { ...f, review_status: reviews[f.id] || "pending" } : null;
      }).filter(Boolean), note: "Hand-authored fictional examples. No AI analysis has been run." };
    },
    async publicExample() {
      await wait();
      return gameplayExample();
    },
    async review(findingId, status) {
      await wait();
      reviews[findingId] = status;
      persist();
      return status;
    }
  };
}
function createHttpAdapter({ fetcher = fetch, tokenFor = () => null, guideId = null } = {}) {
  const sessions = /* @__PURE__ */ new Map(), runs = /* @__PURE__ */ new Map();
  let lastRun = null, publishAttempt = null, analysisAttempt = null, reviewAttempt = null;
  async function request(path, { method = "GET", body, sessionId } = {}) {
    const token = tokenFor(sessionId);
    const response = await fetcher(path, { method, credentials: "same-origin", headers: { ...body ? { "Content-Type": "application/json" } : {}, ...sessionId&&sessions.get(sessionId)?.current ? { "X-Workflow-Id":sessions.get(sessionId).current } : {}, ...token ? { Authorization: "Bearer " + token } : {} }, ...body ? { body: JSON.stringify(body) } : {} });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new AdapterError(data.error?.code || "API_ERROR", data.error?.message || "The request could not be completed.", !!data.error?.retryable),{diagnostic_id:data.error?.diagnostic_id||null});
    return data;
  }
  function normalize(data, overrides = {}) {
    const raw = data.session;
    if (!raw) throw new AdapterError("SESSION_SHAPE", "The server did not return a session aggregate.");
    const id = raw.id || raw.session_id, previous = sessions.get(id) || {};
    const incomingVersion = data.state_version ?? raw.state_version;
    // List responses may omit the command version; their fresh status/answers must still refresh the summary.
    if (incomingVersion !== undefined && previous.state_version > incomingVersion) return previous;
    const result = { ...previous, ...raw, id, origin: raw.origin || raw.source_origin, state_version: data.state_version ?? raw.state_version ?? previous.state_version, current: data.current !== void 0 ? data.current : raw.current ?? previous.current, phase: data.phase || raw.phase || previous.phase, step: data.step || raw.step || previous.step, task: data.task !== void 0 ? data.task : raw.task ?? previous.task, mode: raw.mode || previous.mode || "unknown", guide_snapshot: data.guide || raw.guide_snapshot || previous.guide_snapshot, used: raw.used || Object.fromEntries(["T1", "T2", "T3"].map((t) => [t, raw.questions.filter((q) => q.kind === "probe" && q.theme_id === t).length])), ...overrides };
    sessions.set(id, result);
    return result;
  }
  function normalizeRun(raw) {
    const run = { ...raw, findings: (raw.findings || []).map((f) => ({ ...f, stale: raw.stale || f.stale, review_status: f.review_status === "approved" ? "confirmed" : f.review_status })), note: raw.status === "blocked_live_disabled" ? "Source snapshot saved. Live AI analysis is disabled. No candidate findings have been produced." : raw.note };
    runs.set(run.id, run);
    lastRun = run.id;
    return run;
  }
  return {
    kind: "api",
    capabilities: { voice: false, analysis: true, publish: true, review: true },
    async ownerService() {
      const identity = await request("/api/whoami");
      if (identity.researcher !== true) throw new AdapterError("RESEARCHER_REQUIRED", "Researcher access is required for service controls.");
      return { service: await request("/api/research/service-control") };
    },
    async initializeStudy(requestId) {
      const identity=await request('/api/whoami');
      if(identity.researcher!==true)throw new AdapterError('RESEARCHER_REQUIRED','Researcher access is required to initialize the study.');
      return request('/api/research/study/initialize',{method:'POST',body:{request_id:requestId}});
    },
    async activateProvider(requestId) {
      return request("/api/research/provider/activate", { method: "POST", body: { request_id: requestId, live_enabled: true } });
    },
    async pauseProvider(requestId) {
      return request("/api/research/service-control", { method: "PATCH", body: { request_id: requestId, live_enabled: false } });
    },
    async loadStudy() {
      return request("/api/public/study"+(guideId?"?guide_id="+encodeURIComponent(guideId):""));
    },
    async publicExample() {
      return request("/api/public/example");
    },
    async listSessions() {
      const data = await request("/api/research/sessions");
      return data.sessions.map((raw) => normalize({ session: raw }));
    },
    async getSession(id) {
      return normalize(await request("/api/sessions/" + id, { sessionId: id }));
    },
    async decide(id,task){if(!task?.id)throw new AdapterError('STALE_TASK','Reload the saved session before requesting a decision.');return normalize(await request('/api/sessions/'+id+'/decision',{method:'POST',sessionId:id,body:{task_id:task.id}}));},
    async startSession(body) {
      const payload = { ...body, initial_mode: body.mode };
      delete payload.mode;
      return normalize(await request("/api/sessions", { method: "POST", body: payload,sessionId:'__pending_creation__' }), { mode: body.mode });
    },
    async command(id, c) {
      let path = "/api/sessions/" + id, method = "POST", body = { ...c };
      delete body.type;
      if (c.type === "answer") path += "/answers";
      else if(c.type === "exposure") path += "/exposures";
      else if (["pause", "resume", "end", "continue", "skip_topic", "switch_mode"].includes(c.type)) {
        path += "/control";
        body.action = c.type;
      } else if (c.type === "correct") {
        path += "/answers/" + c.answer_id;
        method = "PATCH";
      } else if (c.type === "withdraw") method = "DELETE";
      else throw new AdapterError("UNSUPPORTED", "This action is not connected.");
      const data = await request(path, { method, body, sessionId: id });
      if (c.type === "withdraw" && data.status === "withdrawn" && !data.session) return { id, status: "withdrawn", questions: [], answers: [], current: null };
      return normalize(data, c.type === "switch_mode" ? { mode: c.mode } : c.type === "answer" ? { mode: c.input_mode } : {});
    },
    async getSavedAnalysis(id) {
      const data=await request('/api/sessions/'+id+'/analysis',{sessionId:id});
      return data.analysis?normalizeRun(data.analysis):null;
    },
    async analysis(ids, { scope = "cross", modeBasis = "eligible" } = {}) {
      if (!ids?.length || ids.length > 10) throw new AdapterError("INVALID_SCOPE", "Select between one and ten comparable sessions.");
      const signature = JSON.stringify({ ids: [...ids].sort(), scope, modeBasis });
      if (!analysisAttempt || analysisAttempt.signature !== signature) analysisAttempt = { signature, requestId: crypto.randomUUID() };
      const requestId = analysisAttempt.requestId;
      if (scope === "single") {
        const run = await request("/api/sessions/" + ids[0] + "/analysis", { method: "POST", body: { request_id: requestId }, sessionId: ids[0] });
        analysisAttempt = null;
        return normalizeRun(run);
      }
      const selected = ids.map((id) => sessions.get(id));
      if (selected.some((s2) => !s2)) throw new AdapterError("GROUP_REQUIRED", "Load the selected sessions first.");
      const s = selected[0], filter = { guide_id: s.guide_id, origin: s.origin, mode_group: modeBasis === "actual" ? s.mode_group || modeGroup(s) : eligibilityMode(s), mode_basis: modeBasis };
      if (new Set(selected.map((s2) => [s2.guide_id, s2.origin, modeBasis === "actual" ? s2.mode_group || modeGroup(s2) : eligibilityMode(s2)].join("/"))).size !== 1) throw new AdapterError("GROUP_MISMATCH", "Select the same guide, source and mode provenance.");
      const raw = await request("/api/research/analysis", { method: "POST", body: { request_id: requestId, filter, session_ids: ids } });
      analysisAttempt = null;
      return normalizeRun(raw);
    },
    async publish(draft) {
      const { id, version, published_at, ...input } = draft;
      const signature = JSON.stringify(input);
      if (!publishAttempt || publishAttempt.signature !== signature) publishAttempt = { signature, input, saveId: crypto.randomUUID(), publishId: crypto.randomUUID(), stage: "read" };
      const attempt = publishAttempt;
      if (attempt.stage === "read") {
        const current = await request("/api/research/study/draft");
        attempt.expected = current.draft_revision;
        attempt.stage = "save";
      }
      if (attempt.stage === "save") {
        const saved = await request("/api/research/study/draft", { method: "PUT", body: { request_id: attempt.saveId, expected_draft_revision: attempt.expected, draft: attempt.input } });
        attempt.expected = saved.draft_revision;
        attempt.stage = "publish";
      }
      const published = await request("/api/research/study/publish", { method: "POST", body: { request_id: attempt.publishId, expected_draft_revision: attempt.expected } });
      publishAttempt = null;
      return published.guide;
    },
    async review(findingId, status) {
      const run = runs.get(lastRun);
      if (!run) throw new AdapterError("ANALYSIS_REQUIRED", "Load the analysis before reviewing it.");
      const signature = JSON.stringify({ run: run.id, findingId, status });
      if (!reviewAttempt || reviewAttempt.signature !== signature) reviewAttempt = { signature, body: { request_id: crypto.randomUUID(), expected_revision: run.revision, review_status: status === "confirmed" ? "approved" : status } };
      const updated = normalizeRun(await request("/api/research/analysis/" + run.id + "/findings/" + findingId, { method: "PATCH", body: reviewAttempt.body }));
      reviewAttempt = null;
      return updated.findings.find((f) => f.id === findingId)?.review_status || status;
    }
  };
}
export {
  AdapterError,
  createDemoAdapter,
  createHttpAdapter,
  currentQuestion,
  eligibilityMode,
  modeGroup,
  validateSpan
};
