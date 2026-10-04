// Fresh Playlogue frontend. Demo fixtures are never live research or provider results.
import { createDemoAdapter, createHttpAdapter, currentQuestion, modeGroup, validateSpan, eligibilityMode } from "./adapter.js";
import { themes } from "./fixtures.js";
import {totalProbeBudget} from "../shared/routing.mjs";
const $ = (s) => document.querySelector(s);
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icons = { grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z", list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01", spark: "m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z", arrow: "M5 12h14 m-6-6 6 6-6 6", chevron: "m9 5 7 7-7 7", back: "M19 12H5 m6-6-6 6 6 6", check: "m5 12 4 4L19 6", mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3", text: "M4 5h16 M12 5v15 M8 20h8", play: "m9 5 11 7-11 7Z", link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2", close: "m6 6 12 12 M18 6 6 18", lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4", clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0", menu: "M4 6h16 M4 12h16 M4 18h16", file: "M14 2H5v20h14V7Z M14 2v5h5 M8 12h8 M8 16h8", pause: "M8 4v16 M16 4v16", headphones: "M3 14v-2a9 9 0 0 1 18 0v2 M3 13h4v8H3z M17 13h4v8h-4z" };
const icon = (name, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.grid}"/></svg>`;
const btn = (label, action, cls = "secondary", attrs = "") => `<button class="button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (text, cls = "") => `<span class="badge ${cls}">${esc(text)}</span>`;
const date = (x) => Number.isNaN(Date.parse(x)) ? "Date not returned" : new Date(x).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const labelOrigin = (x) => ({ demo_fixture: "Fictional example", demo_live: "Fictional practice", real_self_report: "Self-reported experience", imported: "Imported" })[x] || x;
const labelMode = (x) => ({ text_only: "Text", voice_only: "Voice", mixed: "Mixed modes", no_answers: "No answers" })[x] || x;
const demoAdapter = createDemoAdapter({ storage: sessionStorage });
const adapter = window.playlogueAdapter || (new URLSearchParams(location.search).get("adapter") === "api" ? createHttpAdapter() : demoAdapter);
const state = { view: "start", recoverableSession: null, loading: true, busy: false, error: null, guide: null, sessions: [], session: null, analysis: null, selected: [], mode: new URLSearchParams(location.search).get("mode") === "voice" ? "voice" : "text", draft: "", modal: null, source: null, filter: "all", modeBasis: "eligible", origin: "demo_fixture", tab: "transcript", menu: false, notice: null, media: "idle", voiceDraft: "", editedTranscript: false, participantRecord: false, audioMaxSeconds: 90, voiceSourceTask: null, mediaError: null, playbackReturn: null, playedQuestion: null, recovered: false };
const demo = adapter.kind === "demo";
let restoreFocus = null;
function rememberFocus(el) {
  restoreFocus = el?.dataset?.action ? { action: el.dataset.action, id: el.dataset.id, index: el.dataset.index } : null;
}
function restoreActionFocus() {
  const candidates = [...document.querySelectorAll("[data-action]")];
  const match = candidates.find((el) => el.dataset.action === restoreFocus?.action && el.dataset.id === restoreFocus?.id && el.dataset.index === restoreFocus?.index && el.getClientRects().length);
  if (match) match.focus({ preventScroll: true });
  else focusHeading();
}
function brand() {
  return `<a href="/?adapter=api#start" class="brand" data-action="home" aria-label="Playlogue home"><span class="brand-mark"><i></i><i></i><i></i></span>Playlogue<span class="brand-dot">.</span></a>`;
}
function sidebar() {
  const nav = (id, label, glyph, active = state.view === id) => `<a href="#${id}" data-action="nav-${id}" class="nav-item ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${icon(glyph)}${label}</a>`;
  return `<aside class="sidebar ${state.menu ? 'open' : ''}">${brand()}<div class="workspace-label">${state.publicDemo&&!state.researcher?'PRACTICE WORKSPACE':'RESEARCH WORKSPACE'}</div><nav aria-label="Workspace">${nav('start', 'Start', 'play')}${nav('sessions', 'Sessions', 'list', ['sessions', 'detail'].includes(state.view))}${nav('analysis', 'Evidence & analysis', 'spark')}</nav><div class="sidebar-study"><span class="eyebrow">THIS STUDY</span><strong>${esc(state.guide?.title || 'No study selected')}</strong><span>${state.guide ? esc(state.guide.themes.length + ' main questions · English') : 'Choose a study to begin'}</span>${nav('study', 'Study details', 'file')}</div><div class="sidebar-bottom">${state.researcher && !demo ? nav('settings', 'Researcher settings', 'lock') : ''}${nav('example', 'Fictional example', 'link')}<div class="profile"><span class="avatar">P</span><div><strong>${demo || state.publicDemo&&!state.researcher ? 'Practice workspace' : 'Research workspace'}</strong><span>${demo || state.publicDemo&&!state.researcher ? 'Your fictional records' : 'Private research'}</span></div>${icon('lock')}</div></div></aside>`;
}
function prepareHref(preset = '', mode = '') {
  const q = new URLSearchParams();
  if (state.guide) q.set('guide_id', state.guide.id);
  if (preset) q.set('preset', preset);
  if (mode) q.set('mode', mode);
  return '/client/custom-research.html' + (q.size ? '?' + q.toString() : '');
}
function start() {
  const g = state.guide, total = g.themes.length + totalProbeBudget(g);
  return `${header('START', "AI interviews that follow the player's answers.", "Ask targeted follow-ups when more detail is needed, then trace findings back to the player's words.")}<div class="research-flow"><section class="flow-study" aria-labelledby="flow-study-title"><div class="flow-step">01</div><div class="flow-study-body"><span class="eyebrow">READY TO INTERVIEW</span><h2 id="flow-study-title">${esc(g.title)}</h2><p>${g.themes.length} main questions · Up to ${total} questions total · English</p><div class="flow-study-actions">${btn('About this study', 'nav-study', 'text-button')}</div></div></section><section class="flow-interview"><div class="flow-step">02</div><div><span class="eyebrow">YOUR INTERVIEW</span><h2>Interview</h2><p>Type or speak. Review each answer before submitting.</p></div>${btn('Start interview ' + icon('arrow'), 'choose-interview', 'primary')}</section><section class="flow-analysis"><div class="flow-step">03</div><div><span class="eyebrow">AFTER YOUR INTERVIEW</span><h2>Evidence & analysis</h2><p>Review transcripts and trace findings to their sources.</p></div>${btn('Review evidence ' + icon('arrow'), 'nav-analysis', 'secondary')}</section></div><div class="start-secondary">${!demo && state.researcher ? '<a class="button text-button" href="' + esc(prepareHref('blank')) + '">Create a custom study →</a>' : ''}${demo ? '<p class="flow-note">Fictional practice. No AI or audio calls.</p>' : !state.live ? '<p class="flow-note">'+(state.publicDemo?practiceAvailability():'Live interviews are paused.')+'</p>' : ''}</div>`;
}
function settings() {
  return header('RESEARCHER SETTINGS', 'Manage interview availability.', 'Only the study owner can enable or pause AI processing. Participants give their own consent before an interview.') + (state.researcher ? ownerServicePanel() : empty('Researcher access required.', 'Return to Start to explore the available interview and evidence paths.', btn('Back to Start', 'nav-start', 'primary')));
}
function practiceAvailability(){return state.publicAvailability==='closed'?'This practice is closed.':state.publicAvailability==='paused'?'Practice is paused. Your saved answers are safe.':'Practice is temporarily unavailable. Please try again later.';}
function status() {
  return `<div class="environment-strip"><span class="status-dot"></span><strong>${demo ? 'FICTIONAL PRACTICE' : state.localEngineering ? 'LOCAL TEST' : state.publicDemo ? 'AI PRACTICE' : 'PRIVATE WORKSPACE'}</strong><span>${demo ? 'No AI or audio calls' : state.publicDemo ? 'Fictional answers. Your own records only.' : 'Your study and interview records'}</span><a href="#example" data-action="nav-example">Fictional example${icon('arrow')}</a></div>`;
}
function header(kicker, title, description, actions2 = "") {
  return `<header class="page-heading"><div><div class="eyebrow">${kicker}</div><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ""}</div><div class="heading-actions">${actions2}</div></header>`;
}
function error() {
  return state.error ? `<div class="alert error" role="alert">${icon("file")}<div><strong>${esc(state.error.message)}</strong><span>${state.error.code === "STATE_CONFLICT" ? "Reload the latest question. Your draft stays here." : state.error.retryable ? "Saved answers kept. Try again when ready." : "Your saved answers are safe. Continue or end the interview."}</span>${state.error.diagnostic_id ? `<span>Reference: ${esc(state.error.diagnostic_id)}</span>` : ""}</div>${btn("Dismiss", "dismiss-error", "quiet")}${["STATE_CONFLICT", "QUESTION_CONFLICT", "ANSWER_CONFLICT"].includes(state.error.code) ? btn("Reload session", "reload-session", "secondary") : state.error.retryable ? btn("Retry", "retry", "secondary") : ""}</div>` : "";
}
function empty(title, copy, action = "") {
  return `<div class="empty"><span class="empty-symbol">${icon("file")}</span><h3>${title}</h3><p>${copy}</p>${action}</div>`;
}
function unavailableStudy(){
  if(state.guideUnavailable&&state.researcher&&adapter.initializeStudy)return empty('Initialize this private study.','The prescribed study is not yet present. Create its fixed guide first; provider calls stay paused.',btn('Initialize prescribed study','initialize-study','primary'));
  return empty('The study is unavailable.','Check the connection and try loading the workspace again.',btn('Retry','reload','primary'));
}
function protocol() {
  return `<div class="protocol-list">${state.guide.themes.map((t, i) => `<section class="protocol-row"><div class="question-code">0${i + 1}</div><div><span class="eyebrow">${esc(t.name)}</span><h3>${esc(t.text)}</h3><div class="protocol-meta"><span>Main question</span><span>Up to ${t.budget} follow-ups</span></div></div></section>`).join("")}</div>`;
}
function serviceBudget(service) {
  const budget = service?.budget;
  if (!budget || !Number.isSafeInteger(budget.approved_cap_micro_usd) || !Number.isSafeInteger(budget.known_spend_micro_usd)) return null;
  const held = (budget.reservations || []).filter(r => ["reserved", "unknown"].includes(r.status)).reduce((sum, r) => sum + (Number.isSafeInteger(r.ceiling_micro_usd) ? r.ceiling_micro_usd : 0), 0);
  return { cap: budget.approved_cap_micro_usd, accounted: budget.known_spend_micro_usd, held, available: Math.max(0, budget.approved_cap_micro_usd - budget.known_spend_micro_usd - held) };
}
function dollars(micro) { return micro === undefined ? "Not reported" : (micro / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function cutoffLabel(service) {
  const value = service?.limits?.cutoff;
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not reported";
}
function ownerServicePanel() {
  if (demo || !state.researcher || !state.service) return "";
  const service = state.service, budget = serviceBudget(service);
  return `<section class="owner-service"><div><span class="eyebrow">RESEARCHER SERVICE CONTROL</span><h2>${service.live_enabled ? "AI processing is enabled." : "AI processing is paused."}</h2><p>You control whether this study can make new AI requests. Review the processing and approved budget before turning it on.</p><div class="inline-meta">${badge(service.live_enabled ? "Enabled" : "Paused", service.live_enabled ? "status-active" : "neutral")}${badge(service.speech_ready ? "Speech ready" : "Speech not enabled", "outline")}<span>${esc(cutoffLabel(service))}</span></div></div><div class="owner-service-budget"><span class="eyebrow">AVAILABLE APPROVED BUDGET</span><strong>${dollars(budget?.available)}</strong><span>Within ${dollars(budget?.cap)} approved limit · pending costs are already set aside</span><div class="owner-service-actions">${service.live_enabled ? btn("Pause new calls", "pause-provider", "secondary") : btn("Review and enable " + icon("arrow"), "review-activation", "primary")}${btn("Refresh status", "refresh-owner-service", "quiet")}</div></div></section>`;
}
function activationReview() {
  const service = state.service, budget = serviceBudget(service);
  const passedCutoff = service?.limits?.cutoff && Date.now() >= Date.parse(service.limits.cutoff);
  const ready = service?.transport === "bounded_explicit_gates" && budget?.available > 0 && !passedCutoff && !service?.budget?.overrun_detected;
  return `<span class="eyebrow">OWNER REVIEW · PRIVATE STUDY</span><h2 id="modal-title" tabindex="-1">Enable AI for this study?</h2><p>OpenAI will process submitted interview text and analysis requests. If voice is enabled, OpenAI also transcribes recordings and generates question audio. These requests use this study’s approved budget. Participants must still agree before starting their own interview.</p><p class="activation-summary">Available: <strong>${dollars(budget?.available)}</strong> of the ${dollars(budget?.cap)} approved limit. New calls stop at ${esc(cutoffLabel(service))}.</p><details class="activation-details"><summary>Models, spending and limits</summary><dl class="activation-facts"><div><dt>Interview decisions</dt><dd>${esc(service?.models?.decision || "Not reported")}</dd></div><div><dt>Individual analysis</dt><dd>${esc(service?.models?.analysis || "Not reported")}</dd></div><div><dt>Transcription / speech</dt><dd>${esc(service?.models?.stt || "Not reported")} / ${esc(service?.models?.tts || "Not reported")}</dd></div><div><dt>AI voice</dt><dd>${esc(service?.models?.voice || "Not reported")}</dd></div><div><dt>Approved cap</dt><dd>${dollars(budget?.cap)}</dd></div><div><dt>Recorded / pending costs</dt><dd>${dollars(budget?.accounted)} / ${dollars(budget?.held)}</dd></div><div><dt>Available approved budget</dt><dd>${dollars(budget?.available)}</dd></div><div><dt>New requests stop at</dt><dd>${esc(cutoffLabel(service))}</dd></div></dl><div class="demo-callout">Before enabling, the service checks earlier and pending costs. This balance is an estimate, not an invoice or guaranteed final charge. Budget, request limits and the cutoff remain enforced.</div></details>${!ready ? '<div class="voice-error" role="status"><strong>AI cannot be enabled yet. Check the available budget, cutoff time and service readiness.</strong></div>' : ""}<label class="activation-confirm"><input id="activation-confirm" type="checkbox"><span>I authorize OpenAI processing for this study within the approved budget and limits.</span></label><div class="modal-actions">${btn("Keep calls paused", "close-modal", "secondary")}${btn("Enable AI processing", "activate-provider", "primary", "disabled")}</div><p class="small muted">You can pause new requests in Researcher settings. Requests already sent may finish and incur costs.</p>`;
}
async function loadOwnerService() {
  if (demo || !adapter.ownerService) return;
  const result = await adapter.ownerService();
  state.researcher = true;
  state.service = result.service;
}

function study() {
  const g = state.guide;
  if(g.kind==='custom')return `${header('CUSTOM STUDY','Study details',esc(g.game+' / '+g.game_build),btn('Preview interview '+icon('arrow'),'nav-consent','primary'))}<section class="section"><h2>${esc(g.title)}</h2><p class="goal">${esc(g.goal)}</p><p>Target players: ${esc(g.target_players)}</p><p>English · ${g.themes.length} main questions · up to ${g.themes.length+totalProbeBudget(g)} questions total</p>${protocol()}<p>Up to ${totalProbeBudget(g)} follow-ups across the interview, within the limits shown for each topic. This saved guide cannot be edited.</p><a class="button secondary" href="${esc(prepareHref())}">Create a custom study</a></section>`;
  return `${header("SELECTED STUDY", "Study details", "A focused interview about the choices players make in Heichao Baopo.", btn("Preview interview " + icon("arrow"), "nav-consent", "primary"))}<div class="study-banner"><div class="game-emblem" aria-hidden="true"><div class="emblem-ring"></div><span>DF</span><small>FIELD STUDY 01</small></div><div class="study-title"><div class="eyebrow">DELTA FORCE · PC · MAINLAND CHINA</div><h2>${esc(g.title)}</h2><p>Heichao Baopo <span lang="zh">黑潮爆破</span></p><div class="inline-meta">${badge("Guide v" + g.version, "dark")}${badge("English", "outline")}${badge("Build: " + g.game_build, "outline")}</div></div><div class="study-banner-side"><span class="eyebrow">INTERVIEW FORMAT</span><strong>One round.<br>Three perspectives.</strong><span>Text & voice · at your pace</span></div></div><div class="study-grid"><div><section class="section"><div class="section-heading"><div><span class="eyebrow">THE RESEARCH QUESTION</span><h2>What shapes the next decision?</h2></div>${btn("Edit guide", "edit-guide", "quiet")}</div><p class="goal">${esc(g.goal)}</p></section><section class="section"><div class="section-heading"><div><span class="eyebrow">INTERVIEW GUIDE</span><h2>Three anchors. Room to explore.</h2></div><span class="muted small">Questions and optional follow-ups</span></div>${protocol()}<div class="protocol-footer">${icon("lock")}Follow-ups stay within the selected topic and limits.</div></section></div><aside class="study-aside"><section class="aside-block"><div class="eyebrow">AT A GLANCE</div><dl class="facts"><div><dt>Main questions</dt><dd>3</dd></div><div><dt>Follow-up budget</dt><dd>${totalProbeBudget(g)} maximum</dd></div><div><dt>Total questions</dt><dd>Up to ${g.themes.length + totalProbeBudget(g)}</dd></div><div><dt>Participation</dt><dd>Stop at any time</dd></div><div><dt>App access</dt><dd>Up to 7 days</dd></div></dl></section><section class="aside-block"><div class="eyebrow">PARTICIPANT CONTROL</div><p>Skip a question, decline a topic, pause, or end at any time.</p><p>Submitted transcripts can be corrected. Sessions can be deleted.</p></section><section class="aside-block next-step"><div class="eyebrow">NEXT STEP</div><h3>Listen first.<br>Keep the evidence.</h3><p>${demo ? "Explore two hand-authored fictional transcripts and see how a finding links back to its source." : "Review session transcripts before drawing conclusions."}</p>${btn("Open sessions " + icon("arrow"), "nav-sessions", "text-button")}</section></aside></div>`;
}
function selectionCheck() {
  const selected = state.sessions.filter(s => state.selected.includes(s.id));
  if (selected.length < 2) return 'Compare at least 2 sessions. You can analyze this one on its own.';
  if (selected.length > 10) return 'Compare up to 10 sessions at a time.';
  const groups = new Set(selected.map(s => [s.guide_id, s.origin, state.modeBasis === 'actual' ? s.mode_group || modeGroup(s) : eligibilityMode(s)].join('/')));
  return groups.size === 1 ? '' : 'Choose sessions from the same study, source and answer mode.';
}
function sessionGuide(s) { return s.guide_snapshot || (s.guide_id === state.guide?.id ? state.guide : null); }
function sessionRow(s) {
  return `<tr><td><label class="table-check"><input type="checkbox" data-select="${s.id}" ${state.selected.includes(s.id) ? "checked" : ""} aria-label="Select session ${esc(s.id.slice(0, 10))}"></label></td><td><button class="session-link" data-action="open-session" data-id="${s.id}"><span class="session-symbol">${icon(s.mode_group === "voice_only" ? "mic" : "text")}</span><span><strong>${s.id.startsWith("fixture") ? "Example " + s.id.slice(-1) : "Session " + s.id.slice(0, 6)}</strong><small>${date(s.created_at)} · ${s.answers.length} submitted responses</small></span>${icon("chevron")}</button></td><td>${badge(labelOrigin(s.origin), "neutral")}</td><td>${labelMode(s.mode_group || modeGroup(s))}</td><td>${badge(s.status === "ended" ? "Ended" : s.status, "status-" + s.status)}</td><td>${sessionGuide(s) ? esc(sessionGuide(s).title) + '<small class="session-guide-version">Version ' + esc(sessionGuide(s).version) + '</small>' : 'Study ' + esc(s.guide_id.slice(0, 12))}</td></tr>`;
}
function sessions() {
  if(state.publicDemo&&!state.researcher)return header('YOUR PRACTICE','Your practice sessions','Only records opened with your private session link appear here.',btn('Start a new practice '+icon('arrow'),'nav-consent','primary'))+(state.sessions.length?'<div class="table-wrap"><table><thead><tr><th>SESSION</th><th>SOURCE</th><th>MODE</th><th>STATUS</th><th>STUDY</th></tr></thead><tbody>'+state.sessions.map(s=>sessionRow(s).replace(/<td><label class="table-check">[\s\S]*?<\/td>/,'')).join('')+'</tbody></table></div>':empty('No practice yet.','Complete an interview to see your transcript, analysis and linked quotes.',btn('Start practice','nav-consent','primary')));
  const visible = state.sessions.filter((s) => state.filter === "all" || (state.modeBasis === "actual" ? s.mode_group || modeGroup(s) : eligibilityMode(s)) === state.filter);
  return `${header("SESSION LIBRARY", "Interview sessions", "Keep fictional practice and self-reported experience separate.", (state.recoverableSession ? btn("Return to interview", "recover-interview", "secondary") : "") + btn("New interview " + icon("arrow"), "nav-consent", "primary"))}<div class="toolbar"><div class="tabs" aria-label="Session mode filter">${[["all", "All sessions"], ["text_only", "Text"], ["voice_only", "Voice"], ["mixed", "Mixed"]].map(([id, name]) => `<button data-action="filter" data-id="${id}" class="${state.filter === id ? "active" : ""}" aria-pressed="${state.filter === id}">${name}${id === "all" ? ` <span>${state.sessions.length}</span>` : ""}</button>`).join("")}</div><label class="provenance-filter">Mode basis<select id="mode-basis"><option value="eligible" ${state.modeBasis === "eligible" ? "selected" : ""}>Initial eligibility</option><option value="actual" ${state.modeBasis === "actual" ? "selected" : ""}>Submitted answers</option></select></label><span class="small muted">${visible.length} ${visible.length === 1 ? "session" : "sessions"} · version and source preserved</span></div>${state.selected.length ? `<div class="selection-bar"><span><strong>${state.selected.length}</strong> selected</span><span id="selection-hint">${selectionCheck() || "Ready to compare these sessions."}</span>${state.selected.length === 1 ? btn("Analyze this session " + icon("arrow"), "analyze-single-selection", "primary") : ""}${btn("Compare sessions " + icon("arrow"), "analyze-selection", state.selected.length === 1 ? "secondary" : "primary", `aria-describedby="selection-hint" ${selectionCheck() ? "disabled" : ""}`)}${btn("Clear", "clear-selection", "quiet")}</div>` : ""}${state.accessError ? `<div class="alert info"><div><strong>Researcher access is required.</strong><span>The server denied study-wide session access. Participant records remain private.</span></div>${btn("Retry access check", "reload", "secondary")}</div>` : ""}${visible.length ? `<div class="table-wrap"><table><thead><tr><th><span class="sr-only">Select</span></th><th>SESSION</th><th>SOURCE</th><th>MODE</th><th>STATUS</th><th>STUDY</th></tr></thead><tbody>${visible.map(sessionRow).join("")}</tbody></table></div>` : empty("No sessions in this mode.", "Text, voice, and mixed sessions appear separately here.", btn("Show all sessions", "filter", "secondary", 'data-id="all"'))}<div class="note-line">${icon("lock")}Session counts describe records, not unique players. Examples are never treated as player research.</div>`;
}
function detail() {
  const s = state.session, themes = s.guide_snapshot?.themes || (s.guide_id===state.guide?.id?state.guide.themes:[]);
  return `${header("SESSION / " + esc(s.id.slice(0, 10)), s.id.startsWith("fixture") ? "Fictional example " + s.id.slice(-1) : "Your interview record", "Read the actual questions and confirmed answers in order.", btn(icon("back") + (state.participantRecord ? " Back to interview" : " All sessions"), state.participantRecord ? "resume-view" : "nav-sessions", "quiet") + btn("Export JSON", "export-session", "secondary") + (adapter.recoveryLink ? btn("Copy private recovery link", "copy-recovery", "quiet") : ""))}<div class="record-meta">${badge(labelOrigin(s.origin), "neutral")}${badge(labelMode(s.mode_group || modeGroup(s)), "outline")}${badge(s.status, "status-" + s.status)}<span>${sessionGuide(s) ? "Guide v" + esc(sessionGuide(s).version) : "Study " + esc(s.guide_id.slice(0, 12))} · Build ${esc(s.guide_snapshot?.game_build || "UNKNOWN")}</span><span>Content revision ${s.content_revision}</span></div><div class="toolbar"><div class="tabs">${[["transcript", "Transcript"], ["coverage", "Coverage"], ["record-analysis", "Candidate findings"]].map(([id, label]) => `<button data-action="record-tab" data-id="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`).join("")}</div>${s.status === "active" || s.status === "paused" ? btn("Continue interview " + icon("arrow"), "resume-view", "primary") : ""}</div>${state.tab === "coverage" ? coverage(s) : state.tab === "record-analysis" ? analysisContent() : `<div class="transcript-layout"><div class="transcript">${s.questions.map((q) => {
    const a = s.answers.find((a2) => a2.question_id === q.id);
    return `<article class="transcript-item" id="answer-${esc(a?.id || q.id)}"><div class="transcript-index">${String(q.sequence).padStart(2, "0")}</div><div class="transcript-body"><div class="transcript-question"><span class="eyebrow">${q.kind === "probe" ? "Follow-up" : "Question"} · ${esc(themes.find((t) => t.id === q.theme_id)?.name)}</span><h3>${esc(q.actual_text)}</h3></div><div class="transcript-answer"><div class="answer-meta"><span>${icon(a?.input_mode === "voice" ? "mic" : "text")}${a?.input_mode === "voice" ? "Confirmed transcript" : "Submitted text"}</span><span>${a ? "Revision " + a.revision : "No response"}</span></div>${a?.response_status === "valid" ? `<p>${esc(a.final_text)}</p>${a.edited_transcript ? '<span class="small muted">Transcript edited before submission</span>' : ""}${btn("Correct answer", "correct-answer", "quiet small-button", `data-id="${a.id}"`)}` : `<p class="muted">${{ skipped: "Question skipped", refused: "Participant declined this topic", technical_failure: "Technical failure", unrecognizable: "Unrecognizable response" }[a?.response_status] || "Question not answered"}</p>`}</div></div></article>`;
  }).join("") || empty("No retained responses.", "This session has no transcript to review.")}</div><aside class="transcript-aside"><span class="eyebrow">READ WITH CARE</span><h3>A record, before a conclusion.</h3><p>${s.origin === "demo_fixture" ? "This is a fictional frontend example. It contains no real participant or model output." : s.origin === "demo_live" ? "This AI-powered practice uses invented answers. Its findings are not player research." : "Answers reflect one self-reported account, within this study’s scope."}</p><p>Corrections preserve a new answer revision and invalidate earlier source references.</p>${btn("View candidate findings " + icon("arrow"), "record-tab", "text-button", 'data-id="record-analysis"')}<div class="aside-divider"></div>${btn("Delete this session", "delete-session", "danger-text")}</aside></div>`}`;
}
function coverage(s) {
  const themes = s.guide_snapshot?.themes || (s.guide_id===state.guide?.id?state.guide.themes:[]);
  return `<div class="coverage"><h2>Fixed question coverage</h2><p class="muted">Presence of a valid response does not establish full question exposure.</p>${themes.map((t) => {
    const q = s.questions.find((q2) => q2.fixed_question_id === t.fixed_id), a = s.answers.find((a2) => a2.question_id === q?.id);
    return `<div class="coverage-row"><strong>${esc(t.name)}</strong><span>${s.exposures?.some(e=>e.question_id===q?.id&&["start","partial","full"].includes(e.state)) ? "Question reached" : "Not reached"}</span>${badge(a?.response_status || "Unanswered", "neutral")}<span>Exposure: ${s.exposures?.some((e) => e.question_id === q?.id && e.state === "full") ? "full" : "not recorded"}</span></div>`;
  }).join("")}<p class="note-line">${icon("file")}Missing answers are kept as missing. No score or research claim is inferred.</p></div>`;
}
function analysisContent() {
  if(state.savedAnalysisError)return empty('Saved analysis could not be loaded.','Reload the saved result before requesting a new analysis.',btn('Reload saved analysis','reload-saved-analysis','primary'));
  const scopeGuide=state.analysis?.input_manifest?.[0]?.guide_id;
  const topicThemes=state.analysis?.guide?.themes || state.analysis?.source_sessions?.[0]?.guide_snapshot?.themes || (scopeGuide?state.sessions.find(s=>s.guide_id===scopeGuide&&s.guide_snapshot)?.guide_snapshot.themes || (state.guide?.id===scopeGuide?state.guide.themes:[]):(state.guide?.themes||themes));
  if (!state.analysis) return empty("No analysis loaded.", "Choose saved sessions to analyze, or explore the clearly labeled fictional example.", ((state.view === "detail" || state.selected.length) ? btn(demo ? "Load example findings" : "Run analysis", "load-analysis", "primary") : btn("Choose sessions", "nav-sessions", "primary")) + btn("View fictional example", "nav-example", "quiet"));
  const a = state.analysis;
  if(a.status==='awaiting_provider'&&state.view==='detail')return empty('Analysis is pending.','Reloading only checks the saved result. It does not send another analysis request.',btn('Reload saved analysis','reload-saved-analysis','secondary'));
  if (a.status === "blocked_live_disabled") return `<div class="analysis-context"><span class="eyebrow">SOURCE SNAPSHOT SAVED</span><p>${esc(a.note)}</p></div>${empty("Analysis has not run.", "AI analysis is paused. Your selected source records are saved.")}`;
  return `<div class="analysis-context"><span class="eyebrow">${demo || a.origin === "demo_fixture" ? "HAND-AUTHORED FICTIONAL EXAMPLE" : "ANALYSIS RUN"}</span><p>${esc(a.note || "Candidate findings require researcher review.")}</p></div>${a.findings.length ? `<div class="findings">${a.findings.map((f, i) => `<article class="finding"><div class="finding-number">${String(i + 1).padStart(2, "0")}</div><div class="finding-body"><div class="finding-top"><span class="eyebrow">${f.theme_ids.map((id) => esc(topicThemes.find((t) => t.id === id)?.name || id)).join(" · ")}</span>${badge(f.stale ? "Source changed" : { pending: "Pending review", confirmed: "Confirmed", rejected: "Rejected" }[f.review_status] || "Pending review", f.stale ? "warning" : f.review_status === "confirmed" ? "status-ended" : "neutral")}</div><h2>${esc(f.claim)}</h2><div class="evidence-quote"><span class="quote-mark">“</span><blockquote>${esc(f.supporting_spans[0]?.exact_quote || "No supporting quote")}</blockquote></div><div class="finding-actions">${f.supporting_spans.map((span, j) => btn(icon("link") + " View source", "view-source", "source-button", `data-id="${f.id}" data-index="${j}"`)).join("")}${f.counter_spans.map((span,j)=>btn(icon('link')+' View counterexample','view-source','source-button',`data-id="${f.id}" data-index="${j}" data-kind="counter"`)).join('')}<span class="small muted">${f.supporting_spans.length} supporting ${f.supporting_spans.length === 1 ? "source" : "sources"}</span></div><div class="unknowns"><strong>Limits & unknowns</strong>${f.unknowns.map((u) => `<p>${esc(u)}</p>`).join("")}<p>Counterevidence: ${f.counter_spans.length ? "available for review" : "not found / not fully assessed"}</p></div>${state.view !== "example" && !state.participantRecord && (!state.publicDemo || state.researcher) ? `<div class="review-actions"><span>Researcher review</span>${btn(icon("check") + " Confirm", "review-finding", "secondary small-button", `data-id="${f.id}" data-status="confirmed" ${f.stale || !adapter.capabilities.review ? "disabled" : ""}`)}${btn("Reject", "review-finding", "quiet small-button", `data-id="${f.id}" data-status="rejected" ${f.stale || !adapter.capabilities.review ? "disabled" : ""}`)}${btn("Reset to pending", "review-finding", "quiet small-button", `data-id="${f.id}" data-status="pending" ${!adapter.capabilities.review ? "disabled" : ""}`)}</div>` : ""}</div></article>`).join("")}</div>` : empty("Not enough evidence for a finding.", "No supported candidate finding is available in the selected records.")}`;
}
function analysis() {
  if(state.publicDemo&&!state.researcher){const s=state.session?.public_demo_version?state.session:state.sessions.at(-1);return header('YOUR PRACTICE','Your practice analysis','AI findings describe fictional answers from your own interview.')+(s?'<div class="scope-bar"><span>'+s.answers.length+' submitted practice answers</span>'+btn('View my practice','analyze-my-practice','primary','data-id="'+esc(s.id)+'"')+'</div>'+analysisContent():empty('Start with an interview.','Your analysis will link back to your own fictional answers.',btn('Start practice','nav-consent','primary')));}
  return `${header("EVIDENCE WORKSPACE", "Evidence & analysis", "Candidate findings stay linked to exact answer revisions.", btn("Choose sessions " + icon("arrow"), "nav-sessions", "primary"))}<div class="scope-bar">${icon("list")}<div><strong>${state.selected.length ? state.selected.length + " selected sessions" : "No sessions selected"}</strong><span>${state.selected.length ? "Grouped by guide version, source, and input mode" : "Select comparable records in the session library."}</span></div>${state.selected.length ? btn(demo ? "Load example findings" : "Run analysis", "load-analysis", "secondary") : ""}</div>${analysisContent()}`;
}
function example() {
  return `${header("PUBLIC EXAMPLE", "Detonation: gameplay feedback example", "Fictional records showing how findings link to their sources.", '<a class="button primary" href="/?adapter=api#start">Try an interview</a>')}<div class="alert info">${icon("file")}<div><strong>Hand-authored fictional records</strong><span>This public example illustrates source linking. No real participant data or AI output is included.</span></div></div>${analysisContent()}`;
}
function consent() {
  let html = `<div class="participant-top">${brand()}<span class="small muted">Delta Force · PC · English</span>${btn("Back to Start", "nav-start", "quiet")}</div><main id="main-content" class="welcome"><div class="welcome-intro"><span class="eyebrow">PLAYLOGUE / PARTICIPANT INTERVIEW</span><h1 tabindex="-1">Tell us about<br>one round.</h1><p class="welcome-lead">The choices you made. The equipment you picked. What would bring you back.</p><div class="welcome-specs"><span>${icon("clock")}You may stop at any time</span><span>${icon("list")}${state.guide.themes.length} main questions · Up to ${state.guide.themes.length + totalProbeBudget(state.guide)} total</span><span>${icon("headphones")}Type or use voice</span></div><div class="welcome-game"><span class="eyebrow">THIS STUDY</span><strong>Delta Force</strong><span>Heichao Baopo (黑潮爆破) · Mainland China · PC</span><span>Game build: UNKNOWN</span>${!demo && state.researcher ? `<a class="button text-button" href="${esc(prepareHref('', state.mode))}">Create a custom study →</a>` : ""}</div><p class="welcome-control">You’re in control. Skip a question, pause, end the interview, or delete your record.</p></div><section class="consent-panel"><span class="eyebrow">BEFORE WE BEGIN</span><h2>Before you start.</h2><div class="consent-copy"><p>This is a voluntary interview with an AI assistant for adults aged 18 or older. The study owner can review your submitted answers. Skip any question or stop at any time. Do not include names, contact details or other private information.</p><p>${demo ? "This practice stays in this browser tab. No AI, microphone or cloud processing is active." : "OpenAI processes text you submit. Voice recordings go to OpenAI for transcription; question text is used for AI-generated speech. These requests use the study owner’s approved budget."}</p><details><summary>Storage, deletion and voice details</summary><p>Review and correct a voice transcript before submitting it. The app does not keep raw recordings. OpenAI has separate retention rules.</p><p>Your answers and analysis remain available to the study owner for up to 7 days. They are not public. Use your private session link to review or delete your record. Deleting it here does not delete OpenAI logs or backups.</p></details></div>${demo ? '<div class="demo-callout"><strong>This is a local fictional practice.</strong><span>No AI, microphone, or cloud processing is active. Answers remain in this browser tab’s demo storage.</span></div>' : ""}${state.localEngineering ? '<fieldset class="origin-choice"><legend>Engineering test only</legend><label><input type="radio" name="origin" value="demo_live" checked disabled><span><strong>Synthetic nonpersonal answers only</strong><small>${state.localSpeechEngineering ? "Provider engineering test only; synthetic nonpersonal test inputs, not human research." : "Real text model calls; this is not human research. Audio remains off."}</small></span></label></fieldset>' : `<fieldset class="origin-choice"><legend>Your experience</legend><label><input type="radio" name="origin" value="demo_fixture" ${demo ? "checked" : "disabled"}><span><strong>Fictional practice</strong><small>Explore the interview with an imagined round.</small></span></label><label><input type="radio" name="origin" value="real_self_report" ${demo ? "disabled" : "checked"}><span><strong>I have played this mode</strong><small>${demo ? "Available after live integration." : "Use your own recent round."}</small></span></label></fieldset>`}<input type="hidden" name="mode" value="text"><div id="voice-consent-note" class="voice-consent-note"><strong>Typing and voice share one interview.</strong><p>Recording starts only when you choose Record answer. Review the transcript before submitting. Listening to a question is optional and uses an AI-generated voice.</p></div><div class="consent-checks"><label><input id="adult" type="checkbox"><span>I am 18 or older.</span></label><label><input id="research" type="checkbox"><span>I agree to participate in this voluntary research interview.</span></label><label><input id="cloud" type="checkbox"><span>${demo ? "I understand this is fictional practice stored in this browser tab." : "I agree to the OpenAI processing described above."}</span></label></div>${btn((demo ? "Start fictional practice" : "Start interview") + " " + icon("arrow"), "start-interview", "primary full", "disabled")}${!demo && !state.live ? '<div class="demo-callout">Live interviews are paused. You can still view the fictional example.</div>' : ""}<p class="small muted centered">${demo ? "Fictional practice — no AI calls." : "Confirm all three statements to open your first question."}</p></section></main>`;
  if(state.publicDemo){
    html=html.replace('Live interviews are paused. You can still view the fictional example.',practiceAvailability());
    html=html.replace(/<fieldset class="origin-choice">[\s\S]*?<\/fieldset>/,'<fieldset class="origin-choice"><legend>AI-powered practice</legend><label><input type="radio" name="origin" value="demo_live" checked disabled><span><strong>Try a fictional interview</strong><small>Use invented, nonpersonal answers. Your record and findings are labeled as practice, not player research.</small></span></label></fieldset>')
      .replace('This is a voluntary interview with an AI assistant for adults aged 18 or older.','This is a fictional practice interview with an AI assistant for adults aged 18 or older.')
      .replace('I agree to participate in this voluntary research interview.','I understand that this is a fictional practice interview.')
      .replace('These requests use the study owner’s approved budget.','')
      .replace('Start interview','Start practice');
  }
  if(state.guide?.kind!=='custom')return html;
  const g=state.guide;
  return html.replace('Delta Force · PC · English',()=>esc(g.game)+' · English').replace('Tell us about<br>one round.','Share your game experience.').replace('The choices you made. The equipment you picked. What would bring you back.',()=>esc(g.title)).replace('3 questions + follow-ups',g.themes.length+' questions + up to '+totalProbeBudget(g)+' follow-ups').replace('<strong>Delta Force</strong>', ()=>'<strong>'+esc(g.game)+'</strong>').replace('Heichao Baopo (黑潮爆破) · Mainland China · PC',()=>'<details class="participant-brief"><summary>Study purpose and who it is for</summary><p>'+esc(g.goal)+'</p><p>'+esc(g.target_players)+'</p></details>').replace('Game build: UNKNOWN',()=>'Game build: '+esc(g.game_build));
}
function interview() {
  const s = state.session, g = s.guide_snapshot || state.guide, themes = g.themes, q = currentQuestion(s), t = themes.find((t2) => t2.id === q?.theme_id);
  return `<div class="participant-top">${brand()}<span class="participant-study">${esc(g.kind==='custom'?g.game:'Delta Force')}</span>${badge(demo || s.origin?.startsWith("demo_") ? "Fictional practice" : "Private session", "neutral")}</div><main id="main-content" class="interview-shell"><aside class="interview-rail"><span class="eyebrow">YOUR INTERVIEW</span><h2>One round.<br>Your perspective.</h2><div class="interview-progress">${themes.map((t2, i) => {
    const answered = s.answers.some((a) => s.questions.find((q2) => q2.id === a.question_id)?.fixed_question_id === t2.fixed_id);
    return `<div class="progress-step ${answered && q?.theme_id !== t2.id ? "done" : ""} ${q?.theme_id === t2.id ? "current" : ""}"><span>${answered && q?.theme_id !== t2.id ? icon("check") : i + 1}</span><div><strong>${esc(t2.name)}</strong><small>${q?.theme_id === t2.id ? "Current topic" : answered ? "Answered" : "Not started"}</small></div></div>`;
  }).join("")}</div><div class="rail-bottom"><span>${icon("clock")}You may stop at any time</span><p>There are no right or wrong answers. A specific moment is a useful place to start.</p>${btn("View saved transcript", "participant-transcript", "text-button")}${btn("Back to Start", "nav-start", "quiet small-button")}</div></aside><section class="interview-main">${state.recovered ? '<div class="recovery-note" role="status">Interview restored. Unsubmitted drafts were not recovered.</div>' : ""}${error()}${s.status === "paused" ? `<div class="pause-state"><span class="empty-symbol">${icon("pause")}</span><span class="eyebrow">TAKE YOUR TIME</span><h1 tabindex="-1">Interview paused.</h1><p>Your submitted answers are saved. Resume when you’re ready.</p>${btn("Resume interview " + icon("arrow"), "resume-interview", "primary")}${btn("End interview", "end-interview", "quiet")}</div>` : s.status === "ended" ? `<div class="completion"><div class="completion-mark">${icon("check")}</div><span class="eyebrow">${s.end_reason === "completed" ? "INTERVIEW COMPLETE" : "INTERVIEW ENDED"}</span><h1 tabindex="-1">Thanks for sharing<br>your perspective.</h1><p>${s.answers.length} submitted responses. Your interview record is ready to review.</p><div class="completion-actions">${btn("Review my transcript " + icon("arrow"), "participant-transcript", "primary")}${s.public_demo_version ? btn("View my analysis", "practice-analysis", "secondary") : ""}${btn("Back to Start", "nav-start", "secondary")}</div><div class="completion-note">${icon("lock")}You can correct submitted text or delete this session. ${demo || s.origin?.startsWith("demo_") ? "This practice is fictional and is not player research." : "App access expires after 7 days."}</div></div>` : `<div class="question-bar"><span class="eyebrow">${q?.kind === "fixed" ? "QUESTION" : "FOLLOW-UP"}</span><span class="small muted">Question ${q?.sequence} of up to ${g.themes.length + totalProbeBudget(g)}</span></div><div class="question-display"><span class="topic-label">${esc(t?.name)}</span><h1 tabindex="-1">${esc(q?.actual_text || "Preparing your next question…")}</h1>${questionPlayback(s, q)}<p>${q?.kind === "fixed" ? "Take a moment. A concrete example is more useful than a general impression." : demo ? "Fictional practice follow-up." : "You can skip this follow-up or decline the topic at any time."}</p></div>${voicePanel(s, q)}<div class="interview-controls">${btn("Skip question", "skip-question", "quiet")}${btn("Prefer not to discuss this topic", "refuse-topic", "quiet")}${q?.kind === "probe" ? btn("Skip this topic’s follow-ups", "skip-topic", "quiet") : ""}<div class="control-end">${btn(icon("pause") + " Pause", "pause-interview", "quiet")}${btn("End interview", "end-interview", "quiet")}</div></div>`}</section></main>`;
}
function sourcePanel() {
  if (!state.source) return "";
  const span = state.source;
  const sourceSessions = state.view === "example" ? (state.analysis?.source_sessions || []) : state.sessions;
  const s = sourceSessions.find(session => session.id === span.session_id);
  const a = s?.answers.find(answer => answer.id === span.answer_id);
  const q = s?.questions.find(question => question.id === span.question_id);
  const valid = validateSpan(span, s);
  return `<div class="drawer-backdrop" data-action="close-source"></div><aside class="source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-title"><div class="drawer-heading"><span class="eyebrow">SOURCE EVIDENCE</span>${btn(icon("close"), "close-source", "icon-button", 'aria-label="Close source"')}</div><h2 id="source-title" tabindex="-1">The answer behind the finding.</h2><div class="inline-meta">${badge(labelOrigin(s?.origin), "neutral")}${badge("Answer revision " + span.answer_revision, "outline")}</div>${valid ? `<div class="source-context"><span class="eyebrow">${q?.kind === "probe" ? "FOLLOW-UP" : "QUESTION"}</span><h3>${esc(q?.actual_text)}</h3><span class="eyebrow">CONFIRMED ANSWER</span><p>${esc(a.final_text.slice(0, span.start_utf16))}<mark>${esc(span.exact_quote)}</mark>${esc(a.final_text.slice(span.end_utf16))}</p></div>` : `<div class="alert error"><strong>This source changed or is unavailable. Regenerate the analysis before reviewing this finding.</strong></div>`}<details class="source-metadata"><summary>Source details</summary><dl class="facts"><div><dt>Session</dt><dd>${esc(span.session_id.slice(0, 12))}</dd></div><div><dt>Answer</dt><dd>${esc(span.answer_id.slice(0, 16))}</dd></div><div><dt>Exact span</dt><dd>${esc(span.start_utf16)}–${esc(span.end_utf16)} UTF-16</dd></div><div><dt>Content revision</dt><dd>${esc(span.input_content_revision)}</dd></div></dl></details>${s && state.view !== "example" ? btn("Open full transcript " + icon("arrow"), "source-transcript", "primary full", `data-id="${s.id}"`) : ""}<p class="small muted">Highlighted in its original answer context.</p></aside>`;
}
function questionPlayback(s, q) {
  const played = state.playedQuestion === `${s.id}:${q?.id}`;
  const preparing = state.media === 'preparingSpeech', playing = state.media === 'speaking';
  return `<div class="question-playback">${preparing || playing ? btn(preparing ? 'Cancel playback' : 'Stop playback', 'stop-playback', 'secondary') : btn(icon('play') + (played ? ' Replay question' : ' Play question'), 'play-question', 'quiet', !adapter.capabilities.voice || !['idle','review'].includes(state.media) ? 'disabled' : '')}<span>AI-generated voice${!adapter.capabilities.voice ? ' · unavailable now' : ''}</span></div>`;
}
function voicePanel(s, q) {
  const reviewing = state.media === 'review' || (['speaking','preparingSpeech'].includes(state.media) && state.playbackReturn === 'review');
  const lastInput = [...s.answers].reverse().find(a => a.response_status === 'valid' && ['text','voice'].includes(a.input_mode))?.input_mode || 'text';
  const capturing = ['requestingMic','recording','transcribing'].includes(state.media);
  const unavailable = !adapter.capabilities.voice || !adapter.voice;
  const message = state.media === 'recording' ? 'Recording · up to ' + (state.audioMaxSeconds || 90) + ' seconds' : state.media === 'transcribing' ? 'Preparing transcript · not submitted' : state.media === 'requestingMic' ? 'Allow microphone access to record' : reviewing ? 'Review transcript · not submitted' : state.busy ? 'Saving…' : lastInput === 'voice' ? 'Voice ready · tap Record to answer' : 'Not submitted';
  let controls = '';
  if (state.media === 'recording') controls = btn('Stop recording', 'stop-recording', 'primary');
  else if (['requestingMic','transcribing'].includes(state.media)) controls = btn('Cancel recording', 'cancel-media', 'secondary');
  else if (state.media === 'transcriptionError') controls = (pendingRecording ? btn('Retry transcription', 'retry-transcription', 'primary') : '') + btn('Record again', 'rerecord-answer', 'secondary');
  else if (reviewing) controls = btn('Record again', 'rerecord-answer', 'secondary', state.media !== 'review' ? 'disabled' : '');
  else controls = btn(icon('mic') + ' Record answer', 'record-answer', lastInput === 'voice' && !state.draft.trim() ? 'primary' : 'secondary', unavailable || !['idle'].includes(state.media) ? 'disabled' : '');
  const value = reviewing ? state.voiceDraft : state.draft;
  return `<div class="voice-panel answer-composer" data-input-preference="${lastInput}"><div class="composer-status" role="status" tabindex="-1">${esc(message)}</div>${state.mediaError ? '<div class="voice-error" role="alert"><strong>' + esc(state.mediaError.message) + '</strong><span>Saved answers kept.</span></div>' : ''}<label class="field-label" for="${reviewing ? 'voice-transcript' : 'answer'}">${reviewing ? 'Your transcript · review and edit' : 'Your answer'}</label><textarea id="${reviewing ? 'voice-transcript' : 'answer'}" maxlength="1500" placeholder="Type your answer, or use the microphone below." ${state.busy || capturing ? 'disabled' : ''}>${esc(value)}</textarea><div class="answer-hint ${reviewing ? 'transcript-review-meta' : ''}"><span>${reviewing ? (state.editedTranscript ? 'Edits included' : 'Check the words before submitting') : 'Avoid names and private information.'}</span><span id="${reviewing ? 'voice-count' : 'answer-count'}">${value.length} / 1,500</span></div><div class="composer-actions"><div class="recording-controls">${controls}${reviewing || capturing || state.mediaError || s.mode === 'voice' ? btn(state.draft.trim() && reviewing ? 'Use typed draft' : 'Use text', 'switch-text', 'quiet') : ''}</div>${btn('Submit answer ' + icon('arrow'), reviewing ? 'submit-voice' : 'submit-answer', 'primary', state.busy || capturing || !value.trim() || reviewing && state.media !== 'review' ? 'disabled' : '')}</div>${unavailable ? '<p class="composer-note">No microphone access requested. Voice is unavailable; type your answer.</p>' : ''}</div>`;
}

let mediaGeneration = 0;
let pendingRecording = null;
function stopQuestionPlayback() {
  mediaGeneration++;
  adapter.voice?.stopPlayback?.();
  state.media = state.playbackReturn === "review" ? "review" : "idle";
  state.playbackReturn = null;
}
function cancelMedia() {
  mediaGeneration++;
  adapter.voice?.cancel?.();
  adapter.voice?.stopPlayback?.();
  pendingRecording = null;
  state.media = "idle";
  state.mediaError = null;
  state.playbackReturn = null;
  state.voiceSourceTask = null;
  state.voiceDraft = "";
  state.editedTranscript = false;
}
function mediaContext() {
  return { sessionId: state.session.id, questionId: state.session.current };
}
function mediaIsCurrent(generation, context) {
  return generation === mediaGeneration && state.session?.status === "active" && state.session.mode === "voice" && state.session.id === context.sessionId && state.session.current === context.questionId;
}
function describeMediaError(error) {
  const code = error.code || error.name || "AUDIO_ERROR";
  const messages = {
    NotAllowedError: "Microphone permission was denied. You can use text, or change this site’s browser permission and try again.",
    MIC_DENIED: "Microphone permission was denied. You can use text, or change this site’s browser permission and try again.",
    NotFoundError: "No microphone is available. Connect a microphone or continue with text.",
    NotReadableError: "The microphone could not be opened. Close other recording apps or continue with text.",
    SecurityError: "This browser cannot request microphone access here. Continue with text.",
    LIVE_DISABLED: "Voice is currently unavailable. Continue with text in this session.",
    AUDIO_LIMIT: "The recording exceeded the audio limit. Record a shorter answer or use text.",
    AUDIO_REQUIRED: "No recording was captured. Try recording again or use text.",
    REQUEST_LIMIT: "Speech requests are temporarily limited. You can wait or continue with text.",
    EMPTY_TRANSCRIPT: "No speech was recognized. Record again, edit the blank preview, or use text."
  };
  return { code, message: messages[code] || "Audio could not be completed. You can retry or use text without losing your saved answers." };
}
async function mediaAction(operation) {
  if (!adapter.capabilities.voice || !adapter.voice || state.busy || state.session?.status !== "active" || state.session.mode !== "voice") return;
  const generation = ++mediaGeneration;
  const context = mediaContext();
  state.error = null;
  state.mediaError = null;
  try {
    await operation(generation, context);
  } catch (error) {
    if (mediaIsCurrent(generation, context)) {
      const failedState = state.media;
      if (["requestingMic", "recording", "transcribing"].includes(failedState) && !pendingRecording) adapter.voice?.cancel?.();
      state.media = failedState === "transcribing" ? "transcriptionError" : state.playbackReturn === "review" ? "review" : "idle";
      state.playbackReturn = null;
      state.mediaError = describeMediaError(error);
      render();
      focusVoiceHeading();
    }
  }
}
function focusVoiceHeading() {
  const target = $(".composer-status");
  if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
}
async function transcribePending(generation, context) {
  if (!mediaIsCurrent(generation, context) || !pendingRecording) return;
  state.media = "transcribing";
  render();
  const transcript = await adapter.voice.transcribe(pendingRecording, context);
  if (!mediaIsCurrent(generation, context)) return;
  if (typeof transcript?.text !== "string") throw Object.assign(new Error("Invalid transcript response"), { code: "TRANSCRIPT_UNAVAILABLE" });
  state.voiceDraft = transcript.text;
  state.voiceSourceTask = transcript.provider_task_id || null;
  state.editedTranscript = false;
  pendingRecording = null;
  state.media = "review";
  if (!state.voiceDraft.trim()) state.mediaError = describeMediaError({ code: "EMPTY_TRANSCRIPT" });
  render();
  $("#voice-transcript")?.focus({ preventScroll: true });
}

function deciding() {
  const processing=state.decisionInFlight===true,claimed=state.session.task?.provider_attempt?.claimed===true||state.decisionUnavailableTask===state.session.task?.id;
  return `<div class="participant-top">${brand()}${badge("Saved interview", "neutral")}</div><main id="main-content" class="pending-question">${error()}<span class="eyebrow">ANSWER SAVED</span><h1 tabindex="-1">${processing?"Preparing your next question.":"Your next question is pending."}</h1><p>${processing?"Answer saved. You can pause or end while you wait.":claimed?"Answer saved. The next question is unavailable. Continue with the guide or end.":state.decisionFailed?"Answer saved. Retry the next question, continue with the guide, or end.":"Answer saved. Continue when you’re ready."}</p><div class="pending-actions">${processing?'<span class="spinner" role="status" aria-label="Preparing next question"></span>':(claimed?"":btn(state.decisionFailed?"Retry next question":"Continue interview", "retry-decision", "primary"))+btn((state.session.phase === "fixed" || state.session.phase === "interleaved") ? "Continue with the guide" : "Finish without more follow-ups", "continue-fixed", "secondary")}${btn("Pause", "pause-interview", "quiet")}${btn("End interview", "end-interview", "quiet")}</div></main>`;
}

function participantDetail() {
  const s=state.session;
  return `<div class="participant-top">${brand()}${badge(demo ? "Fictional practice" : "Private session", "neutral")}${btn("Back to interview", "resume-view", "quiet")}</div><main id="main-content" class="main-content participant-record">${error()}${detail()}</main>`;
}
function modal() {
  const m = state.modal;
  if (!m) return "";
  let content = "";
  if (m.type === "end") content = `<span class="eyebrow">YOUR CHOICE</span><h2 id="modal-title" tabindex="-1">End this interview?</h2><p>Your submitted responses stay available. You can review, correct, or delete them.</p><div class="modal-actions">${btn("Keep going", "close-modal", "secondary")}${btn("End interview", "confirm-end", "primary")}</div>`;
  if (m.type === "delete") content = `<span class="eyebrow">DELETE SESSION</span><h2 id="modal-title">Remove this record?</h2><p>This removes the interview and its retained answers from ${demo ? "this local demo" : "the app"}. The action cannot be undone. Provider logs and backups have separate retention rules.</p><div class="modal-actions">${btn("Keep session", "close-modal", "secondary")}${btn("Delete session", "confirm-delete", "danger")}</div>`;
  if (m.type === "correct") {
    const a = state.session.answers.find((a2) => a2.id === m.id);
    content = `<span class="eyebrow">ANSWER CORRECTION</span><h2 id="modal-title">Keep the record accurate.</h2><p>A correction creates a new answer revision. Earlier findings will need a fresh source check.</p><label class="field-label" for="correction">Confirmed answer</label><textarea id="correction" maxlength="1500">${esc(a.final_text)}</textarea><label class="field-label" for="reason">Reason for correction</label><input id="reason" placeholder="e.g. Clarify a detail in the original answer" maxlength="300"><div class="modal-actions">${btn("Cancel", "close-modal", "secondary")}${btn("Save correction", "save-correction", "primary")}</div>`;
  }
  if (m.type === "guide") content = `<span class="eyebrow">STUDY SETUP</span><h2 id="modal-title">A guide with clear boundaries.</h2><p>Fixed wording and order are locked. A published change creates a new guide version.</p><label class="field-label" for="guide-title">Study title</label><input id="guide-title" value="${esc(state.guide.title)}" maxlength="120"><label class="field-label" for="guide-goal">Research goal</label><textarea id="guide-goal" maxlength="600">${esc(state.guide.goal)}</textarea><label class="field-label" for="guide-build">Exact game build</label><input id="guide-build" value="${esc(state.guide.game_build)}" maxlength="80"><p class="small muted">Keep UNKNOWN unless verified against the game client.</p><fieldset class="budget-fields"><legend>Follow-ups per theme · 0–2</legend>${state.guide.themes.map((t) => `<label>${esc(t.name)}<select id="budget-${t.id}">${[0, 1, 2].map((n) => `<option ${n === t.budget ? "selected" : ""}>${n}</option>`).join("")}</select></label>`).join("")}</fieldset><div class="demo-callout">${demo ? "Publishing updates only this local demo. No server is contacted." : "Publishing requires the authorized study API."}</div><div class="modal-actions">${btn("Cancel", "close-modal", "secondary")}${btn("Publish new version", "publish-guide", "primary", !adapter.capabilities.publish ? "disabled" : "")}</div>`;
  if (m.type === "activation") content=activationReview();
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-close">${btn(icon("close"), "close-modal", "icon-button", 'aria-label="Close dialog"')}</div>${content}</section></div>`;
}
function render() {
  const participant = ["consent", "interview"].includes(state.view) || state.view === "detail" && state.participantRecord;
  $("#app").innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a>${participant ? `${state.view === "detail" ? participantDetail() : state.view === "consent" ? consent() : state.session.status === "active" && state.session.step === "deciding" ? deciding() : interview()}` : `${sidebar()}<div class="workspace"><div class="mobile-top">${brand()}${btn(icon("menu"), "toggle-menu", "icon-button", 'aria-label="Toggle navigation" aria-expanded="' + state.menu + '"')}</div>${status()}<main id="main-content" class="main-content">${error()}${state.loading ? '<div class="loading-state" role="status"><span class="spinner"></span><h2>Opening your workspace…</h2><p>Loading study and session records.</p></div>' : !state.guide ? unavailableStudy() : { start, study, settings, sessions, detail, analysis, example }[state.view]?.() || start()}</main><footer class="workspace-footer"><span>PLAYLOGUE / GAME UX RESEARCH</span><span>Listen carefully. Trace the evidence.</span></footer></div>`}${state.notice ? `<div class="toast" role="status">${icon("check")}${esc(state.notice)}</div>` : ""}${sourcePanel()}${modal()}`;
  if (state.busy) document.querySelectorAll('button:not([data-action="close-modal"]):not([data-action="close-source"]):not([data-action="pause-interview"]):not([data-action="end-interview"]):not([data-action="confirm-end"]):not([data-action="confirm-delete"])').forEach((b) => b.disabled = true);
}
function focusHeading() {
  ($('[role="dialog"] h2') || $("h1"))?.focus({ preventScroll: true });
}
function notice(text) {
  state.notice = text;
  render();
  setTimeout(() => {
    state.notice = null;
    render();
  }, 4e3);
}
let lastOperation = null;
async function run(operation) {
  if (state.busy) return;
  const generation = mutationGeneration;
  state.error = null;
  state.busy = true;
  lastOperation = operation;
  render();
  try {
    await operation();
  } catch (e) {
    if (generation === mutationGeneration) state.error = { code: e.code || "NETWORK_ERROR", message: e.message || "Something interrupted this request.", diagnostic_id:e.diagnostic_id||null, retryable: e.retryable ?? true };
  } finally {
    state.busy = false;
    render();
    focusHeading();
    if (state.pendingRecovery) { const id = state.pendingRecovery; state.pendingRecovery = null; queueMicrotask(() => recoverFromLink(id)); }
  }
}
async function refresh() {
  state.loading = true;
  render();
  try {
    const study2 = await adapter.loadStudy();
    state.guide = study2.guide;
    state.guideUnavailable = false;
    state.live = study2.live_enabled;
    state.publicDemo = study2.public_demo === true;
    state.publicAvailability = study2.availability;
 state.audioMaxSeconds = Number.isFinite(study2.audio_max_seconds) ? Math.max(1, Math.min(90, study2.audio_max_seconds)) : 90;
  state.localSpeechEngineering = study2.local_speech_engineering === true;
      try { await loadOwnerService(); } catch { state.researcher=false;state.service=null; }
 state.localEngineering = study2.local_synthetic_engineering === true;
    try {
      state.sessions = await adapter.listSessions();
      state.accessError = null;
    } catch (e) {
      if (demo) throw e;
      state.sessions = [];
      state.accessError = e.message;
    }
    state.loading = false;
  } catch (e) {
    state.loading = false;
    state.guideUnavailable=e.code==='GUIDE_UNAVAILABLE';
    if(state.guideUnavailable){try{await loadOwnerService();}catch{state.researcher=false;state.service=null;}}
    throw e;
  }
}
let pendingCommand = null, mutationGeneration = 0;
async function command(type, body = {}) {
  const generation = mutationGeneration, s = state.session;
  const signature = JSON.stringify({ id: s.id, type, ...body });
  if (!pendingCommand || pendingCommand.signature !== signature) pendingCommand = { signature, payload: { type, request_id: crypto.randomUUID(), expected_state_version: s.state_version, ...body } };
  const attempt = pendingCommand;
  const response = await adapter.command(s.id, attempt.payload);
  if (pendingCommand === attempt) pendingCommand = null;
  if (generation !== mutationGeneration) return state.session;
  state.session = response;
  const saved = state.session;
  state.sessions = saved.status === "withdrawn" ? state.sessions.filter((x) => x.id !== saved.id) : state.sessions.map((x) => x.id === saved.id ? saved : x);
  return saved;
}
const pendingDecisions=new Map();
async function requestNextQuestion(remaining=4){
  const session=state.session,task=session?.task,generation=mutationGeneration;
  if(!adapter.decide||!task?.id)throw Object.assign(new Error('Reload the saved session before requesting the next question.'),{code:'STALE_TASK',retryable:false});
  if(session.status!=='active'||session.step!=='deciding')return;
  if(task.provider_attempt?.claimed===true||state.decisionUnavailableTask===task.id)throw Object.assign(new Error('This next-question attempt is already recorded. Continue within the fixed protocol or end.'),{code:'ATTEMPT_ALREADY_CLAIMED',retryable:false});
  const key=session.id+':'+task.id;
  state.decisionInFlight=true;state.decisionFailed=false;state.notice=null;
  lastOperation=()=>requestNextQuestion();
  render();
  let pending=pendingDecisions.get(key);
  if(!pending){pending=adapter.decide(session.id,task);pendingDecisions.set(key,pending);}
  try{const saved=await pending;if(generation===mutationGeneration&&state.session?.id===session.id&&state.session.status==='active'&&state.session.task?.id===task.id){state.session=saved;state.sessions=state.sessions.map(s=>s.id===saved.id?saved:s);if(saved.step==='deciding'&&saved.task?.id&&saved.task.id!==task.id&&remaining>1)await requestNextQuestion(remaining-1);}}
  catch(e){if(generation===mutationGeneration){state.decisionFailed=true;if(['ATTEMPT_ALREADY_CLAIMED','PROVIDER_UNAVAILABLE','PROVIDER_HTTP_ERROR','PROVIDER_STRUCTURE','PROVIDER_RESPONSE_LIMIT','USAGE_UNVERIFIED','RESERVATION_OVERRUN','PROVIDER_INCOMPLETE','PROVIDER_REFUSAL','INVALID_DECISION','INVALID_PROBE'].includes(e.code)){state.decisionUnavailableTask=task.id;e.retryable=false;}}throw e;}
  finally{if(pendingDecisions.get(key)===pending)pendingDecisions.delete(key);state.decisionInFlight=false;}
}
async function continueAfterNewAnswer(){if(!demo&&state.live&&adapter.decide&&state.session?.status==='active'&&state.session.step==='deciding'&&state.session.task?.id)await requestNextQuestion();}
async function priorityControl(type) {
  lastOperation = () => priorityControl(type);
  mutationGeneration++;
  cancelMedia();
  state.error = null;
  state.controlBusy = true;
  render();
  try {
    await command(type);
    state.modal = null;
    if (type === "withdraw") {
      state.selected = state.selected.filter((id) => id !== state.session.id);
      state.analysis = null;
      await navigate("sessions");
      state.notice = "Session deleted from " + (demo ? "the local demo." : "the app.");
    }
  } catch (e) {
    state.error = { code: e.code || "CONTROL_ERROR", message: e.message, diagnostic_id:e.diagnostic_id||null, retryable: e.retryable ?? true };
  } finally {
    state.controlBusy = false;
    render();
    focusHeading();
    if (state.pendingRecovery) { const id = state.pendingRecovery; state.pendingRecovery = null; queueMicrotask(() => recoverFromLink(id)); }
  }
}
function validDetailSelection(saved){return saved?.adapter===adapter.kind&&typeof saved.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(saved.id);}
function sourceSelection(){
  const s=state.session,a=state.analysis,span=state.source;
  if(state.view!=='detail'||!s||a?.scope!=='single'||a.requester_id!==s.id||span?.session_id!==s.id||!validateSpan(span,s))return null;
  for(const f of a.findings)for(const kind of ['supporting_spans','counter_spans']){const index=f[kind].indexOf(span);if(index>=0)return {run_id:a.id,finding_id:f.id,kind,index,session_id:s.id};}
  return null;
}
function rememberDetail(){
  if(state.view!=='detail'||!state.session)return;
  const saved={id:state.session.id,tab:state.tab,adapter:adapter.kind,source:sourceSelection()};
  try{sessionStorage.setItem('playlogue.detail.v1',JSON.stringify(saved));}catch{}
  // IDs and the span selector only: no capability, quote text or URL parameters.
  if(location.hash==='#detail')history.replaceState({playlogueDetail:saved},'',location.href);
}
function restoreDetailSource(saved){
  const choice=saved.source,s=state.session,a=state.analysis;
  if(!choice||saved.id!==s?.id||choice.session_id!==s.id||a?.scope!=='single'||a.requester_id!==s.id||a.id!==choice.run_id||a.stale||!['supporting_spans','counter_spans'].includes(choice.kind)||!Number.isInteger(choice.index)||choice.index<0)return;
  const finding=a.findings.find(f=>f.id===choice.finding_id),span=finding?.[choice.kind]?.[choice.index];
  if(span?.session_id===s.id&&!finding.stale&&validateSpan(span,s))state.source=span;
}
async function loadSavedAnalysis(){
  state.savedAnalysisError=false;
  if(!adapter.getSavedAnalysis)return;
  try{state.analysis=await adapter.getSavedAnalysis(state.session.id);}catch(error){state.savedAnalysisError=true;throw error;}
}
async function navigate(view,detailTab='transcript') {
  if (view === "start" && new URLSearchParams(location.search).has("guide_id")) { location.assign(demo ? "/?adapter=demo#start" : "/?adapter=api#start"); return; }
  if (state.view === "interview" && view !== "interview") cancelMedia();
  state.view = view;
  if (view !== "detail") state.participantRecord = false;
  state.menu = false;
  state.error = null;
  state.source = null;
  state.modal = null;
  state.savedAnalysisError=false;
  if (view === "detail") {state.tab=detailTab;state.analysis=null;rememberDetail();await loadSavedAnalysis();}
  if (view === "sessions") {
    try { state.sessions = await adapter.listSessions(); state.accessError = null; state.selected = state.selected.filter(id => state.sessions.some(s => s.id === id)); }
    catch (error) { state.sessions = []; state.selected = []; state.accessError = error.message; }
  }
  if (view === "consent") { const url = new URL(location.href); url.searchParams.set("mode", state.mode); history.replaceState(null, "", url.pathname + url.search + url.hash); }
  window.scrollTo({ top: 0, behavior: "instant" });
  if (view === "example") {
    state.analysis = adapter.publicExample ? await adapter.publicExample() : null;
  }
  if (view === "analysis" && !state.selected.length) state.analysis = null;
  if(view==='analysis'&&state.publicDemo&&!state.researcher){
    const saved=state.session?.public_demo_version?state.session:state.sessions.at(-1);
    state.analysis=null;
    if(saved){state.session=await adapter.getSession(saved.id);await loadSavedAnalysis();}
  }
  history.replaceState(null, "", "#" + view);
  if(view==='detail')rememberDetail();
  render();
  focusHeading();
}
async function recoverFromLink(id) {
  state.recoverableSession = id;
  if (state.busy || state.controlBusy) { state.pendingRecovery = id; return; }
  await run(async () => {
    const recovered = await adapter.getSession(id);
    if (state.session?.id !== id) { cancelMedia(); state.draft = ''; pendingCommand = null; }
    state.session = recovered;
    state.recovered = true;
    state.sessions = [...state.sessions.filter(s => s.id !== id), recovered];
    await navigate('interview');
  });
}
const actions = {
  "home": () => { location.assign(demo ? "/?adapter=demo#start" : "/?adapter=api#start"); },
  "choose-interview": () => { state.mode = 'text'; run(() => navigate('consent')); },
  "recover-interview": () => run(async () => { state.session = await adapter.getSession(state.recoverableSession); state.recovered = true; state.draft = ''; state.sessions = [...state.sessions.filter(s => s.id !== state.session.id), state.session]; await navigate('interview'); }),
  "initialize-study": () => {if(!state.researcher||!state.guideUnavailable)return;const requestId=crypto.randomUUID();run(async()=>{await adapter.initializeStudy(requestId);await refresh();state.notice='Prescribed study initialized. Review the service status below.';});},
  "refresh-owner-service": () => run(async()=>{await loadOwnerService();}),
  "review-activation": () => run(async()=>{await loadOwnerService();openModal({type:"activation",requestId:crypto.randomUUID()});}),
  "activate-provider": () => {if(!state.researcher||!$("#activation-confirm")?.checked)return;const requestId=state.modal.requestId;run(async()=>{const result=await adapter.activateProvider(requestId);await refresh();state.modal=null;state.notice=result.live_enabled===true&&state.live?"AI processing enabled within the approved limits.":"The service remains paused. Review current status before activating again.";});},
  "pause-provider": () => run(async()=>{await adapter.pauseProvider(crypto.randomUUID());await refresh();state.notice="New AI requests are paused.";}),
 "copy-recovery":()=>run(async()=>{await navigator.clipboard.writeText(adapter.recoveryLink(state.session.id));notice("Private recovery link copied. Keep it private: anyone with this link can access this session.");}),
  "record-answer": async () => {
    if (state.busy || state.session?.status !== 'active' || !adapter.capabilities.voice) return;
    if (state.session.mode !== 'voice') await run(() => command('switch_mode', { mode: 'voice' }));
    if (state.session.mode === 'voice') return actions['capture-answer']();
  },
  "capture-answer": () => mediaAction(async (generation, context) => {
    if (state.media !== "idle") return;
    pendingRecording = null;
    state.voiceSourceTask = null;
    state.media = "requestingMic";
    render();
    await adapter.voice.record({
      maxSeconds: state.audioMaxSeconds || 90,
      maxBytes: 8 * 1024 * 1024,
      onAutoStop: () => {
        if (mediaIsCurrent(generation, context) && state.media === "recording") actions["stop-recording"]();
      }
    });
    if (!mediaIsCurrent(generation, context)) return;
    state.media = "recording";
    render();
    focusVoiceHeading();
  }),
  "stop-recording": () => mediaAction(async (generation, context) => {
    if (state.media !== "recording") return;
    state.media = "transcribing";
    render();
    const recording = await adapter.voice.stop();
    if (!mediaIsCurrent(generation, context)) return;
    pendingRecording = recording;
    await transcribePending(generation, context);
  }),
  "retry-transcription": () => mediaAction((generation, context) => transcribePending(generation, context)),
  "play-question": async () => {
    if (state.busy || state.session?.status !== 'active' || !adapter.capabilities.voice) return;
    // Use the existing speech gate. Answer provenance is chosen independently at submission.
    if (state.session.mode !== 'voice') await run(() => command('switch_mode', { mode: 'voice' }));
    if (state.session.mode === 'voice') return actions['play-question-audio']();
  },
  "play-question-audio": () => mediaAction(async (generation, context) => {
    if (!["idle", "review"].includes(state.media)) return;
    state.playbackReturn = state.media;
    state.media = "preparingSpeech";
    render();
    await adapter.voice.playQuestion(currentQuestion(state.session).actual_text, {
      ...context,
      onPlaybackStart: () => {
        if (mediaIsCurrent(generation, context)) {
          state.playedQuestion = `${context.sessionId}:${context.questionId}`;
          state.media = "speaking";
          render();
          focusVoiceHeading();
        }
      }
    });
    if (mediaIsCurrent(generation, context)) {
      state.media = state.playbackReturn === "review" ? "review" : "idle";
      state.playbackReturn = null;
      render();
    }
  }),
  "stop-playback": () => { stopQuestionPlayback(); render(); },
  "cancel-media": () => { cancelMedia(); render(); },
  "discard-transcript": () => { cancelMedia(); render(); },
  "rerecord-answer": () => { cancelMedia(); return actions["record-answer"](); },
  "submit-voice": () => {
    if (state.media !== "review" || !state.voiceDraft.trim() || state.busy) return;
    const final_text = state.voiceDraft;
    const edited_transcript = state.editedTranscript;
    const transcript_source_task_id = state.voiceSourceTask;
    run(async () => {
      await command("answer", { question_id: state.session.current, final_text, response_status: "valid", input_mode: "voice", edited_transcript, transcript_source_task_id });
      state.draft = "";
      cancelMedia();
      await continueAfterNewAnswer();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  },
  "retry-decision": () => run(requestNextQuestion),
  "continue-fixed": () => run(() => command("continue")),
  "reload-session": () => run(async () => {
    state.session = await adapter.getSession(state.session.id);
    pendingCommand = null;
  }),
  "toggle-menu": () => {
    state.menu = !state.menu;
    render();
  },
  "dismiss-error": () => {
    state.error = null;
    render();
  },
  retry: () => run(lastOperation || refresh),
  reload: () => run(refresh),
  "filter": (el) => {
    state.filter = el.dataset.id;
    render();
  },
  "clear-selection": () => {
    state.selected = [];
    render();
  },
  "open-session": (el) => run(async () => {
    state.participantRecord = false;
    state.session = await adapter.getSession(el.dataset.id);
    state.analysis = null;
    await navigate("detail");
  }),
  "record-tab": (el) => run(async () => {
    state.tab = el.dataset.id;
    rememberDetail();
    if(state.tab==='record-analysis')await loadSavedAnalysis();
  }),
  "edit-guide": () => openModal({ type: "guide" }),
  "publish-guide": () => {
    const title = $("#guide-title").value.trim(), goal = $("#guide-goal").value.trim(), game_build = $("#guide-build").value.trim();
    const draft = { ...state.guide, title, goal, game_build, themes: state.guide.themes.map((t) => ({ ...t, budget: Number($("#budget-" + t.id).value) })) };
    if (!title || !goal || !game_build) {
      state.error = { message: "Study title, goal, and game build are required.", code: "INVALID_GUIDE" };
      render();
      return;
    }
    run(async () => {
      state.guide = await adapter.publish(draft);
      state.modal = null;
      state.notice = "Guide v" + state.guide.version + " published in local demo.";
    });
  },
  "start-interview": () => {
    const consent2 = { adult_confirmed: $("#adult").checked, research_agreed: $("#research").checked, cloud_agreed: $("#cloud").checked };
    if (!consent2.adult_confirmed || !consent2.research_agreed || !consent2.cloud_agreed) return;
    const mode = 'text';
    const origin = $('input[name="origin"]:checked').value;
    const request_id = crypto.randomUUID();
    run(async () => {
      state.session = await adapter.startSession({ consent: consent2, mode, origin, guide_id: state.guide.id, request_id });
      state.draft = "";
      if (demo) state.sessions = await adapter.listSessions();
      else state.sessions.push(state.session);
      state.recoverableSession = state.session.id;
      await navigate("interview");
    });
  },
  "switch-text": () => run(async () => {
    cancelMedia();
    await command("switch_mode", { mode: "text" });
  }),
  "switch-voice": () => run(async () => {
    cancelMedia();
    await command("switch_mode", { mode: "voice" });
  }),
  "submit-answer": () => {
    if (!state.draft.trim()) return;
    const draft = state.draft;
    run(async () => {
      cancelMedia();
      if (state.session.mode !== "text") await command("switch_mode", { mode: "text" });
      await command("answer", { question_id: state.session.current, final_text: draft, response_status: "valid", input_mode: "text", edited_transcript: false });
      state.draft = "";
      await continueAfterNewAnswer();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  },
  "skip-question": () => run(async () => {
    cancelMedia();
    await command("answer", { question_id: state.session.current, final_text: "", response_status: "skipped", input_mode: state.session.mode });
    state.draft = "";
  }),
  "refuse-topic": () => run(async () => {
    cancelMedia();
    await command("answer", { question_id: state.session.current, final_text: "", response_status: "refused", input_mode: state.session.mode });
    state.draft = "";
  }),
  "skip-topic": () => run(async () => {
    cancelMedia();
    await command("skip_topic");
    state.draft = "";
  }),
  "pause-interview": () => priorityControl("pause"),
  "resume-interview": () => run(() => command("resume")),
  "end-interview": () => openModal({ type: "end" }),
  "confirm-end": () => priorityControl("end"),
  "resume-view": () => navigate("interview"),
  "participant-transcript": () => {
    state.participantRecord = true;
    state.analysis = null;
    state.tab = "transcript";
    navigate("detail");
  },
  "delete-session": () => openModal({ type: "delete" }),
  "confirm-delete": () => priorityControl("withdraw"),
  "correct-answer": (el) => openModal({ type: "correct", id: el.dataset.id }),
  "save-correction": () => {
    const a = state.session.answers.find((a2) => a2.id === state.modal.id), final_text = $("#correction").value.trim(), reason = $("#reason").value.trim();
    if (!final_text || !reason) {
      $("#reason").setCustomValidity("Add a reason for this correction.");
      $("#reason").reportValidity();
      return;
    }
    run(async () => {
      await command("correct", { answer_id: a.id, answer_revision: a.revision, final_text, reason });
      state.analysis = null;
      state.modal = null;
      state.notice = "Correction saved. Earlier source references require a fresh check.";
    });
  },
  "close-modal": closeModal,
  "close-source": () => {
    state.source = null;
    rememberDetail();
    render();
    restoreActionFocus();
  },
  "practice-analysis": () => run(async () => {state.participantRecord=true;await navigate('detail','record-analysis');}),
  "reload-saved-analysis": () => run(loadSavedAnalysis),
  "analyze-my-practice": el => run(async () => {state.session=await adapter.getSession(el.dataset.id);state.participantRecord=true;await navigate('detail','record-analysis');}),
  "analyze-single-selection": () => run(async () => {
    if (state.selected.length !== 1) return;
    state.analysis = await adapter.analysis(state.selected, { scope: 'single', modeBasis: state.modeBasis });
    await navigate('analysis');
  }),
  "analyze-selection": () => run(async () => {
    if (selectionCheck()) return;
    const selected = state.sessions.filter((s) => state.selected.includes(s.id));
    if (new Set(selected.map((s) => [s.guide_id, s.origin, state.modeBasis === "actual" ? s.mode_group || modeGroup(s) : eligibilityMode(s)].join("/"))).size !== 1) throw Object.assign(new Error("Select sessions with the same guide version, source, and mode."), { code: "GROUP_MISMATCH", retryable: false });
    state.analysis = await adapter.analysis(state.selected, { scope: "cross", modeBasis: state.modeBasis });
    await navigate("analysis");
  }),
  "load-analysis": () => run(async () => {
    const ids = state.view === "detail" ? [state.session.id] : state.selected;
    if (!ids.length) throw Object.assign(new Error("Select sessions before requesting analysis."), { code: "GROUP_REQUIRED", retryable: false });
    state.analysis = await adapter.analysis(ids, { scope: ids.length === 1 ? "single" : "cross", modeBasis: state.modeBasis });
  }),
  "review-finding": (el) => run(async () => {
    const status2 = await adapter.review(el.dataset.id, el.dataset.status);
    state.analysis.findings.find((f) => f.id === el.dataset.id).review_status = status2;
  }),
  "view-source": (el) => {
    rememberFocus(el);
    state.source = state.analysis.findings.find((f) => f.id === el.dataset.id)[el.dataset.kind==='counter'?'counter_spans':'supporting_spans'][Number(el.dataset.index)];
    rememberDetail();
    render();
    focusHeading();
  },
  "source-transcript": (el) => run(async () => {
    const session=await adapter.getSession(el.dataset.id);
    if(sourceSelection()){rememberDetail();history.pushState(null,'','#detail');}
    state.session = session;
    state.source = null;
    await navigate("detail");
  }),
  "export-session": () => {
    const s = state.session;
    const blob = new Blob([JSON.stringify({ schema_version: "1.1", frontend_demo: demo, source_origin: s.origin, guide_id: s.guide_id, session_id: s.id, status: s.status, mode_group: s.mode_group || modeGroup(s), content_revision: s.content_revision, evidence_revision: s.evidence_revision, questions: s.questions, answers: s.answers }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "playlogue-" + s.id + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    notice("JSON exported with source and revision labels.");
  }
};
function openModal(m) {
  if (["end", "delete"].includes(m.type)) cancelMedia();
  rememberFocus(document.activeElement);
  state.modal = m;
  render();
  focusHeading();
}
function closeModal() {
  state.modal = null;
  render();
  restoreActionFocus();
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.preventDefault();
  const action = el.dataset.action;
  if (action.startsWith("nav-")) {
    if (!state.guide) return;
    run(() => navigate(action.slice(4)));
  } else actions[action]?.(el);
});
document.addEventListener("input", (e) => {
  if(e.target.id==="activation-confirm"){const b=serviceBudget(state.service),s=state.service;const ready=s?.transport==="bounded_explicit_gates"&&b?.available>0&&!(s?.limits?.cutoff&&Date.now()>=Date.parse(s.limits.cutoff))&&!s?.budget?.overrun_detected;$('[data-action="activate-provider"]').disabled=!e.target.checked||!ready||state.busy;}
  if (e.target.id === "voice-transcript") {
    state.voiceDraft = e.target.value;
    state.editedTranscript = true;
    $("#voice-count").textContent = state.voiceDraft.length + " / 1,500";
    const hint=$(".transcript-review-meta span");if(hint)hint.textContent="Edits included in your confirmed answer";
    $('[data-action="submit-voice"]').disabled = !state.voiceDraft.trim() || state.busy || state.media!=="review";
  }
  if (e.target.id === "answer") {
    state.draft = e.target.value;
    $("#answer-count").textContent = state.draft.length + " / 1,500";
    $('[data-action="submit-answer"]').disabled = !state.draft.trim() || state.busy;
  }
  if (["adult", "research", "cloud"].includes(e.target.id)) $('[data-action="start-interview"]').disabled = !$("#adult").checked || !$("#research").checked || !$("#cloud").checked || !demo && !state.live;
});
document.addEventListener("change", (e) => {
  if (e.target.id === "mode-basis") {
    state.modeBasis = e.target.value;
    state.selected = [];
    state.analysis = null;
    render();
  }
  if (e.target.dataset.select) {
    const id = e.target.dataset.select;
    state.selected = e.target.checked ? [.../* @__PURE__ */ new Set([...state.selected, id])] : state.selected.filter((x) => x !== id);
    state.analysis = null;
    render();
  }
  if (e.target.name === "mode") {
    state.mode = e.target.value;
      const voiceNote=$("#voice-consent-note");if(voiceNote)voiceNote.hidden=state.mode!=="voice";
    document.querySelectorAll(".mode-choice label").forEach((l) => l.classList.toggle("selected", l.querySelector("input").checked));
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state.modal) closeModal();
    else if (state.source) {
      state.source = null;
      rememberDetail();
      render();
      restoreActionFocus();
    } else if (state.menu) {
      state.menu = false;
      render();
    }
  }
  if (e.key === "Tab" && (state.modal || state.source)) {
    const dialog = $('[role="dialog"]'), focusable = [...dialog.querySelectorAll("button,input,textarea,select,a[href]")].filter((x) => !x.disabled);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      e.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener("beforeunload", (e) => {
  if (state.draft.trim() || state.voiceDraft.trim() || pendingRecording || ["recording", "requestingMic", "transcribing"].includes(state.media)) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("pagehide", () => cancelMedia());
window.addEventListener('popstate',()=>{
  // These two detail entries share a URL. Reload on traversal to re-authorize and
  // validate the saved quote against fresh session/run data, without a new POST.
  if(location.hash==='#detail'&&validDetailSelection(history.state?.playlogueDetail))location.reload();
});
window.addEventListener("hashchange", () => {
  const view=location.hash.slice(1);
  if (["start","study","settings","sessions","analysis","example","consent"].includes(view) && view!==state.view) run(()=>navigate(view));
});
window.playlogueFrontend = { adapter, state, navigate, recoverFromLink };
render();
run(async () => {
  let savedDetail=null;
  if(location.hash==='#detail'){
    if(validDetailSelection(history.state?.playlogueDetail))savedDetail=history.state.playlogueDetail;
    else try{const saved=JSON.parse(sessionStorage.getItem('playlogue.detail.v1')||'null');if(validDetailSelection(saved))savedDetail=saved;}catch{}
    savedDetail||=window.playlogueRecoveredSession?{id:window.playlogueRecoveredSession,tab:'record-analysis'}:null;
  }
  try { await refresh(); } catch (error) {
    // A valid private session remains recoverable if its creation experiment is now off.
    if (!savedDetail&&(!window.playlogueRecoveredSession || !window.playlogueAutoResume)) throw error;
  }
  try { const saved = JSON.parse(sessionStorage.getItem('playlogue.study-saved.v1') || 'null'); if (saved?.id === state.guide?.id) { state.notice = saved.replayed ? 'Study saved and selected. No duplicate created.' : 'Study saved and selected.'; sessionStorage.removeItem('playlogue.study-saved.v1'); } } catch {}
  state.recoverableSession = window.playlogueRecoveredSession || null;
  if(savedDetail){state.session=await adapter.getSession(savedDetail.id);state.guide ||= state.session.guide_snapshot;state.sessions=[...state.sessions.filter(s=>s.id!==state.session.id),state.session];state.participantRecord=!state.researcher;await navigate('detail',['transcript','coverage','record-analysis'].includes(savedDetail.tab)?savedDetail.tab:'record-analysis');restoreDetailSource(savedDetail);rememberDetail();return;}
  if(window.playlogueRecoveredSession && window.playlogueAutoResume){state.recovered=true;state.session=await adapter.getSession(window.playlogueRecoveredSession);state.guide ||= state.session.guide_snapshot;state.sessions=[...state.sessions.filter(s=>s.id!==state.session.id),state.session];window.playlogueRecoveredSession=null;await navigate("interview");return;}
  const view = location.hash.slice(1);
  if (["start", "study", "settings", "sessions", "analysis", "example", "consent"].includes(view)) await navigate(view);
});
