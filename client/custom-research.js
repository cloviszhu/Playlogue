import {validateCustomStudy, customStudyLimits} from '/shared/custom-study.mjs';
const $ = s => document.querySelector(s), key = 'playlogue.custom-research.draft.v1';
const query = new URLSearchParams(location.search);
const mode = ['text', 'voice'].includes(query.get('mode')) ? query.get('mode') : null;
const emptyDraft = () => ({title:'', goal:'', game:'', game_build:'', target_players:'', questions:[{text:'', allow_followups:false, followup_limit:0}]});
let draft = emptyDraft(), attempt = null, preview = null, busy = false, recoveredDraft = false;
try { const saved = JSON.parse(sessionStorage.getItem(key) || 'null'); if (saved) { draft = saved.draft; attempt = saved.attempt; recoveredDraft = true; } } catch {}
const status = (text, error = false) => { $('#status').textContent = text; $('#status').dataset.error = String(error); };
const persist = () => { try { sessionStorage.setItem(key, JSON.stringify({draft, attempt})); } catch { status('This browser cannot keep a draft. Keep this page open until you finish saving.', true); } };
const destination = id => '/?adapter=api&guide_id=' + encodeURIComponent(id) + '&mode=' + (mode || 'text') + '#consent';
function progress(step) { document.querySelectorAll('[data-step]').forEach(el => { if (el.dataset.step === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); }); }
async function api(method = 'GET', body) {
  const r = await fetch('/api/research/custom-studies', {method, credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, ...(body ? {body:JSON.stringify(body)} : {})});
  const value = await r.json();
  if (!r.ok) throw new Error(value.error?.code || 'API_ERROR');
  return value;
}
function read() {
  for (const name of ['title', 'goal', 'game', 'game_build', 'target_players']) draft[name] = $(`[name=${name}]`).value;
  draft.questions = [...document.querySelectorAll('.question')].map(row => ({text:row.querySelector('textarea').value, allow_followups:row.querySelector('[type=checkbox]').checked, followup_limit:row.querySelector('[type=checkbox]').checked ? Number(row.querySelector('select').value) : 0}));
}
function budget() {
  const count = draft.questions.reduce((n, q) => n + 1 + q.followup_limit, 0);
  $('#budget').textContent = `${draft.questions.length} main + up to ${count - draft.questions.length} follow-ups = up to ${count} questions (limit: ${customStudyLimits.total}).${count > customStudyLimits.total ? ' Remove a question or reduce follow-ups before reviewing.' : ''}`;
  $('#budget').dataset.error = String(count > customStudyLimits.total);
  $('#add-question').disabled = draft.questions.length >= customStudyLimits.fixed;
}
function render() {
  for (const name of ['title', 'goal', 'game', 'game_build', 'target_players']) $(`[name=${name}]`).value = draft[name] || '';
  $('#questions').replaceChildren();
  draft.questions.forEach((q, i) => {
    const row = document.createElement('div'); row.className = 'question';
    row.innerHTML = `<label>Main question ${i + 1}<textarea maxlength="${customStudyLimits.question}" required></textarea></label><div class="question-options"><label><input type="checkbox">Allow follow-ups for this question</label><label>Maximum follow-ups<select><option value="1">1</option><option value="2">2</option></select></label><button type="button" class="button remove">Remove question</button></div>`;
    row.querySelector('textarea').value = q.text;
    row.querySelector('input').checked = q.allow_followups;
    row.querySelector('select').value = String(q.followup_limit || 1);
    row.querySelector('select').disabled = !q.allow_followups;
    row.querySelector('.remove').disabled = draft.questions.length === 1;
    row.querySelector('.remove').onclick = () => { read(); draft.questions.splice(i, 1); attempt = null; persist(); render(); };
    $('#questions').append(row);
  }); budget();
}
function showPreview(value, recovered = false) {
  preview = value; $('#fields').disabled = true; $('#research-form').hidden = true;
  $('#preview').hidden = false; $('#saved').hidden = true; $('#confirmed').checked = false; $('#save').disabled = true;
  $('#preview-content').replaceChildren();
  for (const [label, k] of [['Study name','title'],['Research goal','goal'],['Game','game'],['Game build','game_build'],['Target players','target_players']]) {
    const section = document.createElement('div'), heading = document.createElement('h3'), p = document.createElement('p');
    heading.textContent = label; p.textContent = value[k]; section.append(heading, p); $('#preview-content').append(section);
  }
  const list = document.createElement('ol');
  value.questions.forEach(q => { const li = document.createElement('li'), p = document.createElement('p'), small = document.createElement('small'); p.textContent = q.text; small.textContent = q.allow_followups ? `Up to ${q.followup_limit} follow-ups` : 'No follow-ups'; li.append(p, small); list.append(li); });
  $('#preview-content').append(list);
  const p = document.createElement('p'); p.className = 'form-help';
  p.textContent = `English · ${value.questions.length} main questions · Up to ${value.questions.reduce((n,q) => n + 1 + q.followup_limit, 0)} questions total. Saved guides cannot be edited.`;
  $('#preview-content').append(p); progress('preview');
  status(recovered ? 'Save result not confirmed. Your guide and original request are restored. Review and confirm to retry safely; nothing is sent automatically.' : 'Not saved yet. Review the guide, then confirm below.');
  $('#save-hint').textContent = 'Check the confirmation above to enable Save.';
  $('#preview-title').focus();
}
function unlock() {
  preview = null; attempt = null; $('#fields').disabled = false; $('#research-form').hidden = false;
  $('#preview').hidden = true; $('#saved').hidden = true; progress('choose'); persist();
}
$('#research-form').addEventListener('input', e => { read(); attempt = null; preview = null; const row = e.target.closest('.question'); if (row) row.querySelector('select').disabled = !row.querySelector('input').checked; persist(); budget(); });
$('#add-question').onclick = () => { read(); if (draft.questions.length >= customStudyLimits.fixed) return; draft.questions.push({text:'', allow_followups:false, followup_limit:0}); attempt = null; persist(); render(); };
$('#research-form').onsubmit = e => { e.preventDefault(); read(); try { showPreview(validateCustomStudy(draft)); persist(); } catch { status('Complete every field. Each question allows 400 characters and at most 2 follow-ups. The full guide allows 9 questions including follow-ups, and 16,000 UTF-8 bytes.', true); $('#status').focus(); } };
$('#confirmed').onchange = () => { $('#save').disabled = !$('#confirmed').checked || busy; $('#save-hint').textContent = $('#confirmed').checked ? 'Ready to save and select this study.' : 'Check the confirmation above to enable Save.'; };
$('#research-form').addEventListener('invalid', e => { e.target.setAttribute('aria-invalid', 'true'); status('Complete the highlighted required field, then review your guide.', true); }, true);
$('#research-form').addEventListener('input', e => { e.target.removeAttribute('aria-invalid'); });
$('#edit').onclick = () => { if (!busy) { unlock(); status('Unsaved draft. Review the full guide again after editing.'); $('[name=title]').focus(); } };
$('#save').onclick = async () => {
  if (busy || !preview || !$('#confirmed').checked) return;
  busy = true; $('#save').disabled = true; $('#edit').disabled = true;
  attempt ??= {request_id:crypto.randomUUID(), confirmed:true, draft:preview}; persist(); status('Saving your study… Wait for confirmation before leaving.');
  try {
    const result = await api('POST', attempt);
    try { sessionStorage.removeItem(key); sessionStorage.setItem('playlogue.study-saved.v1', JSON.stringify({id:result.guide.id, replayed:result.replayed})); } catch {}
    attempt = null; preview = null; $('#preview').hidden = true; $('#saved').hidden = false; progress('saved');
    $('#saved-summary').textContent = `${result.guide.title} · ${result.guide.themes.length} main questions · Saved and selected`;
    $('#interview-link').href = destination(result.guide.id);
    status(result.replayed ? 'Saved result recovered. No duplicate was created. Opening your study…' : 'Study saved and selected. Opening your next step…');
    location.assign(destination(result.guide.id));
  } catch (e) { status('Save not confirmed. Your draft is kept. Try again to check the same save without creating a duplicate.', true); $('#status').focus(); }
  finally { busy = false; $('#save').disabled = !$('#confirmed').checked; $('#edit').disabled = false; }
};
$('#prep-menu').onclick = () => { const open = $('#prep-sidebar').classList.toggle('open'); $('#prep-menu').setAttribute('aria-expanded', String(open)); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#prep-sidebar').classList.remove('open'); $('#prep-menu').setAttribute('aria-expanded', 'false'); } });
if (mode) $('#intent-copy').textContent = `Create your ${mode} interview guide, then review participation before starting.`;
render();
try {
  await api();
  if (attempt) showPreview(validateCustomStudy(attempt.draft), true);
  else { unlock(); render(); status(recoveredDraft ? 'Unsaved draft restored.' : 'Unsaved custom draft.'); }
} catch (e) { status(e.message === 'EXPERIMENT_DISABLED' ? 'Custom studies are unavailable. Return to Start for the default interview.' : 'Researcher access is required to create a custom study. Return to Start for the default interview.', true); }
