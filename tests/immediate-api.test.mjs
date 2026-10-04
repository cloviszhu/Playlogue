// Every provider response in this file is a synthetic test double. No network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,Repository,sha256,decisionInput,validateDecision,analysisInput,validateAnalysis} from '../work/test-api.mjs';
import {localD1} from './sqlite-d1.mjs';
import {builtinDefaultGuide,builtinDefaultGuideId} from '../shared/default-guide.mjs';
import {customGuide} from '../shared/custom-study.mjs';
import {legacyDetonationDraft} from '../shared/detonation-case.mjs';
import {createSession,transition} from '../shared/session.mjs';
import worker from '../dist/server/index.js';

const origin='http://localhost:4175',token='I'.repeat(43),consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
const response=value=>Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const probeValue={action:'probe',theme_id:'T2',question_text:'Can you describe one specific moment from that session?',reason:'Synthetic: missing concrete event'};
async function harness(send=()=>{throw Error('NETWORK_FORBIDDEN');}){
 const DB=localD1(),repo=new Repository(DB),env={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'owner',LOCAL_ENGINEERING_TEXT:true,LOCAL_OPENAI_API_KEY:'offline-fixture-only',LOCAL_PROVIDER_FETCH:send};
 const call=async(path,data,method=data?'POST':'GET',asOwner=false)=>{const r=await api(new Request(origin+path,{method,headers:{Origin:origin,Authorization:'Bearer '+token,...asOwner?{'oai-authenticated-user-id':'owner'}:{},...data?{'Content-Type':'application/json'}:{}},...data?{body:JSON.stringify(data)}:{}}),env);return {status:r.status,data:await r.json()};};
 const start=async()=>{await repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));return call('/api/sessions',{guide_id:builtinDefaultGuideId,request_id:'start-default',consent,origin:'demo_live',initial_mode:'text'});};
 const moment=async()=>{const created=await start();assert.equal(created.status,201);let s=(await repo.get(created.data.session.session_id)).session;const g=await repo.guide(s.guide_id);s=(await repo.mutate(s,g,{request_id:'skip-trigger',expected_version:s.state_version,type:'answer',question_id:s.current,response_status:'skipped',input_mode:'text'})).session;const a=await call('/api/sessions/'+s.id+'/answers',{request_id:'moment-answer',expected_state_version:s.state_version,question_id:s.current,response_status:'valid',final_text:'Synthetic: matchmaking was bad; everyone was unskilled.',input_mode:'text'});assert.equal(a.status,200);return {s:(await repo.get(s.id)).session,g};};
 return {DB,repo,env,call,start,moment};
}

test('bare public study serves three-topic English builtin even before initialization and with old pin/custom disabled',async()=>{
 const h=await harness();try{
  h.env.DEFAULT_STUDY_GUIDE_ID='old-pinned-guide';h.env.CUSTOM_RESEARCH_ENABLED='false';const r=await h.call('/api/public/study');assert.equal(r.status,200);assert.equal(r.data.guide.id,builtinDefaultGuideId);assert.equal(r.data.guide.language,'en');assert.equal(r.data.guide.routing_policy,'immediate-probes-v1');assert.equal(r.data.guide.themes.length,3);assert.equal(r.data.live_enabled,false);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM guide_versions').get().n,0);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
  const denied=await h.call('/api/sessions',{guide_id:builtinDefaultGuideId,request_id:'denied',consent,origin:'demo_live',initial_mode:'text'});assert.equal(denied.status,503);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM guide_versions').get().n,0);assert.equal(await h.repo.providerAttemptCount(),0);
 }finally{h.DB.close();}
});
test('first consented create atomically presets one immutable snapshot; concurrent starts/retries remain bounded',async()=>{
 const h=await harness();try{
  const [a,b]=await Promise.all([h.start(),h.start()]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.data.session.session_id,b.data.session.session_id);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM guide_versions').get().n,1);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM studies').get().n,1);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);assert.deepEqual(await h.repo.guide(builtinDefaultGuideId),builtinDefaultGuide());
  const recovered=await h.call('/api/sessions/'+a.data.session.session_id);assert.equal(recovered.data.phase,'interleaved');assert.equal(recovered.data.session.routing_policy,'immediate-probes-v1');assert.equal(recovered.data.guide.id,builtinDefaultGuideId);assert.equal((await h.repo.budget()).reservations.length,0);assert.equal(await h.repo.providerAttemptCount(),0);
 }finally{h.DB.close();}
});
test('invalid consent, foreign origin and researcher access gates do not create a builtin snapshot',async()=>{
 const h=await harness();try{
  await h.repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));const r=await h.call('/api/sessions',{guide_id:builtinDefaultGuideId,request_id:'no-consent',consent:{...consent,cloud_agreed:false},origin:'demo_live',initial_mode:'text'});assert.equal(r.status,422);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM guide_versions').get().n,0);
  const foreign=await api(new Request(origin+'/api/sessions',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:'{}'}),h.env);assert.equal(foreign.status,403);assert.equal((await h.call('/api/research/fixtures',{guide_id:builtinDefaultGuideId,request_id:'unauthorized',consent})).status,403);
 }finally{h.DB.close();}
});
test('immediate provider input and output validation target the just-saved current topic, not later answers',async()=>{
 const h=await harness();try{
  const {s,g}=await h.moment(),input=JSON.parse(decisionInput(s,g));assert.equal(input.current_theme,'T2');assert.equal(input.trigger_question_id,s.current);assert.equal(input.routing_policy,'immediate-probes-v1');assert.equal(input.probe_allowance.remaining,1);assert.equal(input.answers.length,2);assert.match(input.instruction,/before the next main question/);assert.match(input.instruction,/Sufficient concrete detail means advance/);assert.match(input.instruction,/Never invent map features/);assert.match(input.instruction,/cannot remember or declines/);assert.doesNotMatch(input.instruction,/must finish before any probe/);assert.equal(validateDecision(probeValue,s,g),probeValue);
  for(const value of [{...probeValue,theme_id:'T3'},{...probeValue,question_text:s.questions.at(-1).actual_text},{action:'advance',theme_id:'T2',question_text:null,reason:'Wrong shape'}])assert.throws(()=>validateDecision(value,s,g));
  const old=customGuide(legacyDetonationDraft,'legacy');delete old.routing_policy;let historical=createSession(old,consent);historical=transition(historical,old,{type:'answer',request_id:'legacy-answer',expected_version:0,question_id:historical.current,response_status:'valid',final_text:'Synthetic old answer',input_mode:'text'}).session;assert.match(JSON.parse(decisionInput(historical,old)).instruction,/must finish before any probe/);assert.throws(()=>validateDecision({...probeValue,theme_id:'T1'},historical,old),/INVALID_PROBE/);
 }finally{h.DB.close();}
});
test('concurrent provider decision and retry issue one attempt, one accounted charge and one immediate probe',async()=>{
 let sends=0,release,entered;const started=new Promise(resolve=>entered=resolve);const h=await harness(async()=>{sends++;entered();return new Promise(resolve=>release=resolve);});try{
  const {s,g}=await h.moment(),path='/api/sessions/'+s.id+'/decision',body={task_id:s.task.id};const first=h.call(path,body);await started;const second=await h.call(path,body);assert.ok([409,503].includes(second.status));release(response(probeValue));const result=await first;assert.equal(result.status,200);assert.equal(result.data.session.questions.at(-1).kind,'probe');assert.equal(result.data.session.questions.at(-1).theme_id,'T2');assert.equal(result.data.session.questions.length,3);assert.equal((await h.call(path,body)).status,200);assert.equal(sends,1);assert.equal(await h.repo.providerAttemptCount(),1);const budget=await h.repo.budget();assert.equal(budget.reservations.filter(r=>r.accounted_micro_usd>0).length,1);assert.equal(budget.known_spend_micro_usd,budget.reservations.reduce((n,r)=>n+(r.accounted_micro_usd||0),0));assert.ok(budget.reservations.every(r=>r.lease_released===true));assert.equal((await h.repo.get(s.id)).session.used.T2,1);
  const saved=(await h.repo.get(s.id)).session,q=saved.questions.at(-1);assert.equal(q.parent_question_id,s.current);assert.equal(q.trigger_question_id,s.current);const recovered=await h.call('/api/sessions/'+s.id);assert.equal(recovered.data.current,q.id);assert.equal(recovered.data.guide.routing_policy,g.routing_policy);
 }finally{h.DB.close();}
});
test('skip while provider is pending prevents late probe; completed usage remains accounted once',async()=>{
 let release,entered;const started=new Promise(resolve=>entered=resolve);const h=await harness(async()=>{entered();return new Promise(resolve=>release=resolve);});try{
  const {s}=await h.moment();const pending=h.call('/api/sessions/'+s.id+'/decision',{task_id:s.task.id});await started;const skipped=await h.call('/api/sessions/'+s.id+'/control',{action:'skip_topic',request_id:'skip-pending',expected_state_version:s.state_version});assert.equal(skipped.status,200);release(response(probeValue));assert.equal((await pending).status,409);const fresh=(await h.repo.get(s.id)).session;assert.equal(fresh.used.T2,0);assert.equal(fresh.questions.at(-1).fixed_question_id,'F3');assert.equal(h.DB.sqlite.prepare('SELECT status FROM provider_calls').get().status,'completed');assert.equal((await h.repo.budget()).reservations.length,1);
 }finally{h.DB.close();}
});
test('interleaved probe evidence retains exact source mapping and revision validation',async()=>{
 const h=await harness(async()=>response(probeValue));try{
  const {s}=await h.moment();await h.call('/api/sessions/'+s.id+'/decision',{task_id:s.task.id});const before=(await h.repo.get(s.id)).session;await h.call('/api/sessions/'+s.id+'/answers',{request_id:'probe-answer',expected_state_version:before.state_version,question_id:before.current,response_status:'valid',final_text:'Synthetic: I stayed at the site while two teammates left.',input_mode:'text'});const fresh=(await h.repo.get(s.id)).session;const payload=JSON.parse(analysisInput([fresh]));const span=payload.sessions[0].answers.at(-1).available_span;assert.equal(span.question_id,before.current);const finding={id:'synthetic-finding',claim:'Synthetic observation',theme_ids:['T2'],supporting_spans:[span],counter_spans:[],unknowns:['Offline fixture']};assert.equal(validateAnalysis({findings:[finding]},[fresh]).findings.length,1);assert.throws(()=>validateAnalysis({findings:[{...finding,supporting_spans:[{...span,question_id:s.current}]}]},[fresh]));
 }finally{h.DB.close();}
});
test('historical preset and seven-question custom sessions remain pinned when bare default changes',async()=>{
 const h=await harness();try{
  const old=await h.repo.initialize('owner');const g={...customGuide(legacyDetonationDraft,'old-seven'),routing_policy:'fixed-first-v1'};await h.DB.prepare('INSERT INTO studies (id,owner_site_user_id,title,draft_json,created_at) VALUES (?,?,?,?,?)').bind(g.study_id,'owner',g.title,'{}',g.published_at).run();await h.DB.prepare('INSERT INTO guide_versions (id,study_id,version,guide_json,published_at) VALUES (?,?,?,?,?)').bind(g.id,g.study_id,g.version,JSON.stringify(g),g.published_at).run();const s=await h.repo.create(g,consent,'demo_fixture','text',await sha256(token),'old-seven-session','fixture');const snapshot=JSON.stringify(s),oldGuide=JSON.stringify(await h.repo.guide(old.id));await h.start();h.env.CUSTOM_RESEARCH_ENABLED='true';assert.equal((await h.call('/api/public/study?guide_id='+g.id)).data.guide.id,g.id);const restored=await h.call('/api/sessions/'+s.id);assert.equal(restored.data.phase,'fixed');assert.equal(restored.data.guide.themes.length,7);assert.equal(JSON.stringify((await h.repo.get(s.id)).session),snapshot);assert.equal(JSON.stringify(await h.repo.guide(old.id)),oldGuide);
 }finally{h.DB.close();}
});
test('built worker serves routing dependency required by browser custom/default imports',async()=>{
 for(const asset of ['routing.mjs','default-guide.mjs','custom-study.mjs']){const r=await worker.fetch(new Request(origin+'/shared/'+asset),{});assert.equal(r.status,200,asset);assert.match(r.headers.get('Content-Type'),/javascript/);}
});
