import test from 'node:test';import assert from 'node:assert/strict';
import {api,Repository,sha256} from '../work/test-api.mjs';import {localD1} from './sqlite-d1.mjs';
import {builtinDefaultGuide} from '../shared/default-guide.mjs';import {sourceSpan} from '../shared/evidence.mjs';import {encodePcmWav} from '../client/voice-adapter.js';
const origin='https://anonymous-demo.invalid',tokenA='A'.repeat(43),tokenB='B'.repeat(43),consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
const envelope=value=>Response.json({status:'completed',usage:{input_tokens:80,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
async function withDemo(fn){
 const DB=localD1(),repo=new Repository(DB),native=globalThis.fetch,now=Date.now;
 const h={DB,repo,sends:[],decisions:0};
 h.env={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'owner',PUBLIC_DEMO_ENABLED:'true',HOSTED_PROVIDER_ENABLED:'true',HOSTED_IDENTITY_VERIFIED:'true',PROVIDER_PRICING_VERIFIED:'sol-standard-2026-10-04-engineering-buffer',OPENAI_API_KEY:'OFFLINE_STUB_ONLY',PRIOR_SPEND_UPPER_MICRO_USD:'0',PRIOR_UNKNOWN_MICRO_USD:'0',HOSTED_SPEECH_ENABLED:'true',SPEECH_PRICING_VERIFIED:'selected-speech-2026-10-04-engineering-buffer'};
 await repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));
 globalThis.fetch=async(url,init)=>{assert.ok(String(url).startsWith('https://api.openai.com/'));h.sends.push({url,body:init.body});
  if(String(url).endsWith('/speech')){const b=JSON.parse(init.body);h.spoken=b.input;const audio=new Uint8Array(20*96);for(let i=0;i<20;i++)audio.set([255,243,68,0],i*96);return new Response(audio,{headers:{'Content-Type':'audio/mpeg'}});}
  if(String(url).endsWith('/transcriptions'))return Response.json({text:'Invented voice practice answer.'});
  const input=JSON.parse(JSON.parse(init.body).input);
  if(input.sessions){assert.equal(input.sessions.length,1);assert.equal(input.sessions[0].origin,'demo_live');assert.match(input.instruction,/explicitly synthetic/);const s=(await repo.get(input.sessions[0].id)).session;return envelope({findings:[{id:'synthetic-demo-finding',claim:'A tentative interpretation of invented answers.',supporting_spans:[sourceSpan(s,s.answers[0])],counter_spans:[],unknowns:['Fictional inputs; no player research.'],theme_ids:['T1']}]});}
  const next=h.decisions++;return envelope([1,3].includes(next)?{action:'probe',theme_id:next===1?'T2':'T3',question_text:next===1?'What happened in one specific imagined moment?':'What shaped that imagined equipment choice?',reason:'Synthetic fixture'}:{action:'advance',theme_id:null,question_text:null,reason:'Synthetic fixture'});
 };
 h.call=async(path,{body,method=body?'POST':'GET',token=tokenA,headers={}}={})=>{const all={Origin:origin,'Content-Type':'application/json',...token?{Authorization:'Bearer '+token}:{},...headers};for(const k of Object.keys(all))if(all[k]===null)delete all[k];const r=await api(new Request(origin+path,{method,headers:all,...body!==undefined?{body:body instanceof ArrayBuffer?body:JSON.stringify(body)}:{}}),h.env);return {status:r.status,data:r.headers.get('Content-Type')?.startsWith('audio/')?{bytes:(await r.arrayBuffer()).byteLength}:await r.json()};};
 h.start=async(id='new-demo',extra={},options={})=>h.call('/api/sessions',{body:{request_id:id,guide_id:builtinDefaultGuide().id,consent,origin:'demo_live',initial_mode:'text',...extra},...options});
 h.saved=async id=>(await repo.get(id)).session;
 h.answer=async(s,extra={})=>h.call('/api/sessions/'+s.id+'/answers',{body:{request_id:'answer-'+s.current,expected_state_version:s.state_version,question_id:s.current,response_status:'valid',final_text:'Invented, nonpersonal demo answer.',input_mode:s.mode,...extra}});
 try{await fn(h);}finally{globalThis.fetch=native;Date.now=now;DB.close();}
}

test('anonymous default is ready without researcher access; only new marked demo source is persisted',()=>withDemo(async h=>{
 const read=await h.call('/api/public/study');assert.equal(read.status,200);assert.equal(read.data.public_demo,true);assert.equal(read.data.allowed_origin,'demo_live');assert.equal(read.data.live_enabled,true);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
 const r=await h.start();assert.equal(r.status,201,JSON.stringify(r));assert.equal(r.data.session.source_origin,'demo_live');assert.equal(r.data.session.public_demo_version,'public-demo-v1');assert.equal(r.data.guide.themes.length,3);assert.equal((await h.start()).data.session.session_id,r.data.session.session_id);assert.equal((await h.repo.budget()).creation_keys.length,1);assert.equal(h.sends.length,0);
 for(const path of ['/api/research/sessions','/api/research/export','/api/research/diagnostics','/api/research/service-control','/api/whoami'])assert.equal((await h.call(path)).status,403);
 for(const path of ['/api/research/analysis','/api/research/custom-studies','/api/research/provider/activate'])assert.equal((await h.call(path,{body:{request_id:'forged'}})).status,403);
}));
test('anonymous source escalation, arbitrary guide/prompt and invalid consent/origin fail without provider or session',()=>withDemo(async h=>{
 for(const extra of [{origin:'real_self_report'},{guide_id:'forged-guide'},{prompt:'Use my arbitrary provider prompt'},{model:'arbitrary-model'},{public_demo_version:'public-demo-v1'},{consent:{...consent,cloud_agreed:false}}])assert.ok((await h.start(crypto.randomUUID(),extra)).status>=400);
 assert.equal((await h.start('foreign',{}, {headers:{Origin:'https://foreign.invalid'}})).status,403);
 assert.equal((await h.start('no-cap',{}, {token:null})).status,404);
 assert.equal((await h.call('/api/public/study?guide_id=forged-guide')).status,404);
 assert.equal((await h.call('/api/research/sessions',{headers:{'oai-authenticated-user-id':'forged-nonowner'}})).status,403);
 assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);assert.equal(h.sends.length,0);
}));
test('old human/unmarked demo sessions do not acquire anonymous billing rights; fake and foreign capabilities deny',()=>withDemo(async h=>{
 const g=await h.repo.initialize('owner');
 for(const source of ['real_self_report','demo_live']){const old=await h.repo.create(g,consent,source,'text',await sha256(tokenB),'old-'+source,'legacy');
  for(const token of [null,tokenA])assert.equal((await h.call('/api/sessions/'+old.id,{token})).status,404);
  assert.equal((await h.call('/api/sessions/'+old.id,{token:tokenB})).status,200);
  const r=await h.call('/api/sessions/'+old.id+'/analysis',{token:tokenB,body:{request_id:'old-analysis'}});assert.equal(r.status,202);assert.equal(r.data.status,'blocked_live_disabled');
 }
 assert.equal((await h.call('/api/sessions/forged-session')).status,404);assert.equal(h.sends.length,0);
}));
test('two public sessions remain isolated for reads, writes, controls, analysis and citation runs',()=>withDemo(async h=>{
 const a=(await h.start('a')).data.session.session_id,b=(await h.start('b',{}, {token:tokenB})).data.session.session_id;
 for(const suffix of ['', '/analysis'])assert.equal((await h.call('/api/sessions/'+b+suffix,{...(suffix?{body:{request_id:'theft'}}:{})})).status,404);
 for(const suffix of ['/answers','/control'])assert.equal((await h.call('/api/sessions/'+b+suffix,{body:{request_id:'theft',expected_state_version:0,action:'end'}})).status,404);
 assert.equal((await h.call('/api/sessions/'+a+'/analysis',{body:{request_id:'mix',session_ids:[a,b]}})).status,422);
 const s=await h.saved(a);assert.equal((await h.answer(s,{origin:'real_self_report',public_demo_version:'forged'})).status,200);assert.equal((await h.saved(a)).origin,'demo_live');assert.equal((await h.saved(a)).public_demo_version,'public-demo-v1');
 const r=await h.call('/api/sessions/'+a+'/analysis',{body:{request_id:'own'}});assert.equal(r.status,200);assert.equal(r.data.input_manifest[0].session_id,a);
 assert.equal((await h.call('/api/sessions/'+b+'/analysis/'+r.data.id,{token:tokenB})).status,404);assert.equal((await h.call('/api/sessions/'+a+'/analysis/'+r.data.id,{token:tokenB})).status,404);assert.equal((await h.call('/api/sessions/'+a+'/analysis/'+r.data.id)).status,200);
 assert.equal((await h.call('/api/research/analysis/'+r.data.id)).status,403);
}));
test('anonymous full three-plus-two interview and single analysis retain exact own citations',()=>withDemo(async h=>{
 let s=await h.saved((await h.start()).data.session.session_id);const sequence=[];
 for(let i=0;i<5;i++){const q=s.questions.find(q=>q.id===s.current);sequence.push(q.kind==='fixed'?q.fixed_question_id:'P:'+q.theme_id);assert.equal((await h.answer(s)).status,200);s=await h.saved(s.id);const r=await h.call('/api/sessions/'+s.id+'/decision',{body:{task_id:s.task.id}});assert.equal(r.status,200,JSON.stringify(r));s=await h.saved(s.id);}
 assert.deepEqual(sequence,['F1','F2','P:T2','F3','P:T3']);assert.equal(s.status,'ended');assert.equal(s.origin,'demo_live');
 const r=await h.call('/api/sessions/'+s.id+'/analysis',{body:{request_id:'final'}});assert.equal(r.status,200);assert.deepEqual(r.data.findings[0].supporting_spans[0],sourceSpan(s,s.answers[0]));const count=h.sends.length;assert.equal((await h.call('/api/sessions/'+s.id+'/analysis',{body:{request_id:'final'}})).data.id,r.data.id);assert.equal(h.sends.length,count);assert.equal(count,6);
 assert.equal((await h.repo.budget()).approved_cap_micro_usd,20000000);assert.equal((await h.repo.budget()).counts[s.id+':analysis'],1);
}));
test('public gate, global stop, cutoff and USD20 exhaustion prevent anonymous provider sends',()=>withDemo(async h=>{
 h.env.PUBLIC_DEMO_ENABLED='false';assert.equal((await h.start()).status,503);h.env.PUBLIC_DEMO_ENABLED='true';
 const s=await h.saved((await h.start()).data.session.session_id);await h.answer(s);const pending=await h.saved(s.id);
 await h.repo.updateBudget(b=>({...b,known_spend_micro_usd:20000000,revision:b.revision+1}));let r=await h.call('/api/sessions/'+s.id+'/decision',{body:{task_id:pending.task.id}});assert.equal(r.data.error.code,'COST_CAP');assert.equal(h.sends.length,0);
 await h.repo.updateBudget(b=>({...b,live_enabled:false,revision:b.revision+1}));assert.equal((await h.start('stopped')).status,503);assert.equal((await h.call('/api/public/study')).data.live_enabled,false);
 await h.repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));Date.now=()=>Date.parse('2026-10-04T16:00:00Z');assert.equal((await h.start('cutoff')).status,503);assert.equal(h.sends.length,0);
}));
test('public daily creation and per-session analysis caps cannot be bypassed with fresh request IDs',()=>withDemo(async h=>{
 let first;for(let i=0;i<20;i++){const r=await h.start('session-'+i);assert.equal(r.status,201);first??=r.data.session.session_id;}
 assert.ok([429,503].includes((await h.start('session-21')).status));assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,20);
 await h.answer(await h.saved(first));
 for(let i=0;i<2;i++)assert.equal((await h.call('/api/sessions/'+first+'/analysis',{body:{request_id:'analysis-'+i}})).status,200);
 const blocked=await h.call('/api/sessions/'+first+'/analysis',{body:{request_id:'analysis-3'}});assert.equal(blocked.data.error.code,'CALL_LIMIT');assert.equal(h.sends.length,2);
}));
test('public speech uses only saved questions; STT stays a draft until explicit own-session confirmation',()=>withDemo(async h=>{
 const r=await h.start('voice',{initial_mode:'voice'});assert.equal(r.status,201);let s=await h.saved(r.data.session.session_id);
 const tts=await h.call('/api/sessions/'+s.id+'/tts',{body:{request_id:'tts',question_id:s.current,input:'Arbitrary speech must be ignored'}});assert.equal(tts.status,200);assert.equal(h.spoken,builtinDefaultGuide().themes[0].text);
 const audio=encodePcmWav([new Float32Array(16000)],16000);const stt=await h.call('/api/sessions/'+s.id+'/stt',{body:audio,headers:{'Content-Type':'audio/wav','X-Question-Id':s.current,'X-Request-Id':'stt'}});assert.equal(stt.status,200);assert.equal(stt.data.draft,true);assert.equal((await h.saved(s.id)).answers.length,0);
 assert.equal((await h.answer(s,{final_text:stt.data.text,input_mode:'voice',transcript_source_task_id:stt.data.provider_task_id})).status,200);s=await h.saved(s.id);assert.equal(s.answers[0].input_mode,'voice');assert.equal(s.origin,'demo_live');assert.equal(h.sends.length,2);
}));
