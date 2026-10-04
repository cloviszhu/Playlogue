import {modeGroup,eligibilityGroup,readable} from './session.mjs';
export function selectGroup(sessions,filter,now=Date.now()){
  if(!filter.guide_id||!filter.origin||!filter.mode_group)throw Object.assign(new Error('GROUP_REQUIRED'),{code:'GROUP_REQUIRED'});
  if(filter.mode_basis!==undefined&&!['eligible','actual'].includes(filter.mode_basis))throw Object.assign(new Error('MODE_BASIS_REQUIRED'),{code:'MODE_BASIS_REQUIRED'});
  return sessions.filter(s=>readable(s,now)&&s.guide_id===filter.guide_id&&s.origin===filter.origin&&(filter.mode_basis==='actual'||filter.mode_group==='no_answers'?modeGroup(s):eligibilityGroup(s))===filter.mode_group);
}
export function denominators(sessions,themeId){
  const records=sessions.map(s=>{const q=s.questions.find(q=>q.kind==='fixed'&&q.theme_id===themeId);const e=s.exposures.filter(e=>e.question_id===q?.id);const a=s.answers.find(a=>a.question_id===q?.id);return {q,a,full:e.some(e=>e.state==='full'),partial:e.some(e=>e.state==='partial'||e.state==='start'),failed:e.some(e=>e.state==='failed')};});
  const n=f=>records.filter(f).length;
  return {N:records.length,E:n(x=>x.full),A_any:n(x=>x.a?.response_status==='valid'),A_full:n(x=>x.full&&x.a?.response_status==='valid'),partial_valid:n(x=>!x.full&&x.partial&&x.a?.response_status==='valid'),skip:n(x=>x.a?.response_status==='skipped'),refuse:n(x=>x.a?.response_status==='refused'),not_reached:n(x=>!x.full&&!x.partial&&!x.failed),generated_unpresented:n(x=>x.q&&!x.full&&!x.partial&&!x.failed),unanswered:n(x=>!x.a),failed_without_presentation:n(x=>!x.full&&!x.partial&&x.failed)};
}
export function manifest(sessions){return [...sessions].sort((a,b)=>a.id.localeCompare(b.id)).map(s=>({session_id:s.id,guide_id:s.guide_id,content_revision:s.content_revision,evidence_revision:s.evidence_revision,origin:s.origin,mode_group:modeGroup(s),answers:s.answers.map(a=>({answer_id:a.id,revision:a.revision}))}));}
export function stale(run,sessions,now=Date.now()){return run.input_manifest.some(old=>{const s=sessions.find(s=>s.id===old.session_id);return !s||!readable(s,now)||JSON.stringify(manifest([s])[0])!==JSON.stringify(old);});}
export function validateSpan(span,sessions,now=Date.now()){
  const s=sessions.find(s=>s.id===span.session_id);if(!s||!readable(s,now)||s.content_revision!==span.input_content_revision)return false;
  const a=s.answers.find(a=>a.id===span.answer_id);if(!a||a.response_status!=='valid'||a.question_id!==span.question_id||a.revision!==span.answer_revision)return false;
  const {start_utf16:start,end_utf16:end,exact_quote:quote}=span;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>a.final_text.length||typeof quote!=='string'||!quote.length)return false;
  const splitsSurrogate=i=>i>0&&i<a.final_text.length&&/[\uD800-\uDBFF]/.test(a.final_text[i-1])&&/[\uDC00-\uDFFF]/.test(a.final_text[i]);
  return !splitsSurrogate(start)&&!splitsSurrogate(end)&&a.final_text.slice(start,end)===quote;
}
export function sourceSpan(s,a,start=0,end=a.final_text.length){return {session_id:s.id,question_id:a.question_id,answer_id:a.id,answer_revision:a.revision,start_utf16:start,end_utf16:end,exact_quote:a.final_text.slice(start,end),input_content_revision:s.content_revision};}
export function invalidateWithdrawn(runs,sessionId){return runs.map(run=>run.input_manifest.some(i=>i.session_id===sessionId)?{id:run.id,status:'source_withdrawn',input_manifest:[],findings:[],deleted:true}:structuredClone(run));}
export function exportSession(s){return {...(s.public_demo_version?{public_demo_version:s.public_demo_version}:{}),...(s.topic_ids?{topic_ids:s.topic_ids}:{}),schema_version:'1.1',routing_policy:s.routing_policy||'fixed-first-v1',source_origin:s.origin,guide_id:s.guide_id,session_id:s.id,status:s.status,created_at:s.created_at,expires_at:s.expires_at,mode:s.mode,used:s.used,blocked:s.blocked,end_reason:s.end_reason,initial_mode:s.initial_mode||s.mode_history?.[0],eligibility_mode_group:eligibilityGroup(s),mode_group:modeGroup(s),content_revision:s.content_revision,evidence_revision:s.evidence_revision,questions:s.questions,answers:s.answers,exposures:s.exposures};}
