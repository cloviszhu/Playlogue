import test from 'node:test';import assert from 'node:assert/strict';
import {api,Repository,sha256} from '../work/test-api.mjs';
import {sourceSpan,manifest} from '../shared/evidence.mjs';
import {legacyDetonationDraft,detonationDraft} from '../shared/detonation-case.mjs';
import {localD1} from './sqlite-d1.mjs';

// Entire suite uses fresh in-memory databases and hand-authored synthetic data.
// Dummy credential is an offline stub sentinel, never an actual provider key.
globalThis.fetch=()=>{throw new Error('EXTERNAL_NETWORK_FORBIDDEN');};
const origin='http://127.0.0.1:4198',token='Q'.repeat(43),consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
const response=value=>Response.json({status:'completed',usage:{input_tokens:10,output_tokens:10},output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
async function setup(live=false){
 const DB=localD1(),repo=new Repository(DB),g=await repo.initialize('qa-owner');let serial=0;
 const h={DB,repo,g,sends:0,captured:[],seedCount:0};
 const env={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'qa-owner',CUSTOM_RESEARCH_ENABLED:'true'};
 h.env=env;
 h.call=async(path,body,method='POST')=>{const r=await api(new Request(origin+path,{method,headers:{Origin:origin,'oai-authenticated-user-id':'qa-owner',Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}),env);return {status:r.status,data:await r.json()};};
 h.seed=async({guide=g,source='demo_live',mode='text',count=1,length=0}={})=>{
  const prefix='fixture-'+(++h.seedCount);let s=await repo.create(guide,consent,source,mode,await sha256(token),prefix,'synthetic-only');
  for(let i=0;i<count;i++){
   s=(await repo.mutate(s,guide,{type:'answer',request_id:prefix+'-answer-'+i,expected_version:s.state_version,question_id:s.current,response_status:'valid',input_mode:mode,final_text:length?'x'.repeat(length):`Synthetic ${prefix}: action ${i+1} felt clear 😀.`})).session;
   if(i<count-1)s=(await repo.mutate(s,guide,{type:'decision',request_id:prefix+'-decision-'+i,expected_version:s.state_version,task_id:s.task.id,input_content_revision:s.content_revision,action:'advance',theme_id:null,question_text:null})).session;
  }
  s=(await repo.mutate(s,guide,{type:'end',request_id:prefix+'-end',expected_version:s.state_version})).session;return s;
 };
 h.custom=async(draft=legacyDetonationDraft)=>{const r=await h.call('/api/research/custom-studies',{request_id:'custom-'+(++serial),confirmed:true,draft});assert.equal(r.status,201);return r.data.guide;};
 h.cross=(sessions,id='cross',filter={guide_id:sessions[0]?.guide_id,origin:'demo_live',mode_group:'text_only',mode_basis:'actual'})=>h.call('/api/research/analysis',{request_id:id,filter,session_ids:sessions.map(s=>typeof s==='string'?s:s.id)});
 h.enable=async(send)=>{
  await repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));
  Object.assign(env,{LOCAL_ENGINEERING_TEXT:true,LOCAL_ENGINEERING_CROSS_ANALYSIS:true,LOCAL_OPENAI_API_KEY:'OFFLINE_STUB_SENTINEL',LOCAL_PROVIDER_FETCH:async(u,init)=>{h.sends++;h.captured.push(JSON.parse(init.body));return send(u,init);}});
 };
 if(live)await h.enable(()=>response({findings:[]}));
 return h;
}
async function withHarness(fn,live=false){const h=await setup(live);try{await fn(h);}finally{h.DB.close();}}

test('integrated four-topic immediate guide keeps full single and cross evidence with exact spans',()=>withHarness(async h=>{
 const guide=await h.custom(detonationDraft);assert.equal(guide.themes.length,4);assert.equal(guide.routing_policy,'immediate-probes-v1');
 const a=await h.seed({guide,count:4}),b=await h.seed({guide,count:4});
 const span=sourceSpan(a,a.answers[1]);
 await h.enable(()=>response({findings:[{id:'integrated-synthetic',claim:'Synthetic candidate only',supporting_spans:[span],counter_spans:[],unknowns:['No real model used'],theme_ids:['T2']}]}));
 const single=await h.call(`/api/sessions/${a.id}/analysis`,{request_id:'four-single'});assert.equal(single.status,200,JSON.stringify(single.data));
 const cross=await h.cross([a,b],'four-cross');assert.equal(cross.status,200,JSON.stringify(cross.data));
 for(const request of h.captured){const input=JSON.parse(request.input);for(const original of [a,b].filter(s=>input.sessions.some(x=>x.id===s.id))){const saved=input.sessions.find(s=>s.id===original.id);assert.ok((input.sessions.length===1?single:cross).data.input_manifest.every(x=>x.guide_id===guide.id));assert.deepEqual(saved.answers.map(x=>x.text),original.answers.map(x=>x.final_text));assert.equal(saved.answers.length,4);for(const answer of saved.answers){assert.equal(answer.available_span.start_utf16,0);assert.equal(answer.available_span.end_utf16,answer.text.length);}}}
 assert.equal(h.sends,2);assert.equal(JSON.parse(h.captured[1].input).denominators.T4.N,2);
}));

test('integrated new default oversize single retains all source text and sends nothing',()=>withHarness(async h=>{
 const guide=await h.custom(detonationDraft),s=await h.seed({guide,count:4,length:1500});const original=JSON.stringify(s);
 await h.enable(()=>response({findings:[]}));const r=await h.call(`/api/sessions/${s.id}/analysis`,{request_id:'four-oversize'});
 assert.equal(r.status,422);assert.equal(r.data.error.code,'ENGINEERING_INPUT_LIMIT');assert.equal(h.sends,0);assert.equal((await h.repo.budget()).reservations.length,0);assert.equal(JSON.stringify((await h.repo.get(s.id)).session),original);
}));

test('fresh single request cannot reclaim an already-claimed pending run through the API',()=>withHarness(async h=>{
 const s=await h.seed();const prior=await h.repo.snapshot([s],s.id,{scope:'single',status:'awaiting_provider',request_key:'old-unresolved',payload:JSON.stringify({session_id:s.id})});
 await h.repo.claimAttempt('already-claimed-fixture',{task_id:'analysis-'+prior.id,session_id:s.id,operation:'analysis',content_revision:s.content_revision},'gpt-6.1-sol');await h.repo.finishAttempt('already-claimed-fixture','unknown',null);
 await h.enable(()=>response({findings:[]}));const before=JSON.stringify(await h.repo.budget());const r=await h.call(`/api/sessions/${s.id}/analysis`,{request_id:'new-client-id'});
 assert.equal(r.status,409);assert.equal(r.data.error.code,'ATTEMPT_ALREADY_CLAIMED');assert.equal(h.sends,0);assert.equal(await h.repo.providerAttemptCount(),1);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.equal(JSON.stringify(await h.repo.budget()),before);
}));

test('cross cardinality rejects one source even with live disabled BEFORE snapshot creation',()=>withHarness(async h=>{
 const s=await h.seed();const r=await h.cross([s]);assert.equal(r.status,422,JSON.stringify(r.data));
 assert.equal(r.data.error.code,'CROSS_REQUIRES_TWO_SESSIONS');assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,0);assert.equal(h.sends,0);
}));
test('live cross also rejects one source without stub invocation',()=>withHarness(async h=>{
 const s=await h.seed();const r=await h.cross([s]);assert.equal(r.status,422);assert.equal(r.data.error.code,'CROSS_REQUIRES_TWO_SESSIONS');assert.equal(h.sends,0);
},true));
for(const [name,ids]of [['empty',[]],['duplicate',null],['eleven',Array.from({length:11},(_,i)=>'unknown-'+i)]])test('cross rejects '+name+' source selection',()=>withHarness(async h=>{
 const s=await h.seed();const list=ids??[s,s];const r=await h.cross(list);assert.equal(r.status,422);assert.equal(r.data.error.code,'INVALID_SCOPE');assert.equal(h.sends,0);
}));
for(const dimension of ['guide','source','mode'])test('cross rejects mixed '+dimension+' before snapshot/provider',()=>withHarness(async h=>{
 const a=await h.seed();const extra=dimension==='guide'?{guide:await h.custom()}:dimension==='source'?{source:'real_self_report'}:{mode:'voice'};
 const b=await h.seed(extra);const r=await h.cross([a,b]);assert.equal(r.status,422);assert.equal(r.data.error.code,'GROUP_MISMATCH');assert.equal(h.sends,0);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,0);
}));
test('cross rejects unknown source and explicit filter mismatch',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();let r=await h.cross([a,'missing']);assert.equal(r.data.error.code,'GROUP_MISMATCH');
 r=await h.cross([a,b],'other',{guide_id:a.guide_id,origin:'real_self_report',mode_group:'text_only'});assert.equal(r.data.error.code,'GROUP_MISMATCH');
}));
test('single endpoint snapshots only its authorized route source despite extra cross fields',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();const r=await h.call(`/api/sessions/${a.id}/analysis`,{request_id:'single',session_ids:[a.id,b.id],filter:{guide_id:a.guide_id}});
 assert.equal(r.status,202);assert.equal(r.data.scope,'single');assert.deepEqual(r.data.input_manifest.map(s=>s.session_id),[a.id]);assert.equal(h.sends,0);
}));
test('two-source snapshot replay ignores selection order but rejects changed payload',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed(),c=await h.seed();const first=await h.cross([a,b]);const replay=await h.cross([b,a]);
 assert.equal(first.status,202);assert.equal(replay.data.id,first.data.id);assert.deepEqual(replay.data.input_manifest,first.data.input_manifest);
 const changed=await h.cross([a,c]);assert.equal(changed.status,409);assert.equal(changed.data.error.code,'IDEMPOTENCY_MISMATCH');
 assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);
}));
test('retry after correction returns original stale snapshot instead of relabeling current data',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();const first=await h.cross([a,b]);await h.repo.mutate(b,h.g,{type:'correct',request_id:'fix',expected_version:b.state_version,answer_id:b.answers[0].id,answer_revision:1,final_text:'Corrected synthetic detail',reason:'QA correction'});
 const retry=await h.cross([a,b]);assert.equal(retry.data.id,first.data.id);assert.equal(retry.data.stale,true);assert.deepEqual(retry.data.input_manifest,first.data.input_manifest);
}));
test('independent old/new single payloads retain topic scopes and immutable guide IDs',()=>withHarness(async h=>{
 const cg=await h.custom();const old=await h.seed({count:3}),fresh=await h.seed({guide:cg,count:7});await h.enable(()=>response({findings:[]}));
 for(const s of [old,fresh]){const r=await h.call(`/api/sessions/${s.id}/analysis`,{request_id:'single-'+s.id});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.input_manifest[0].guide_id,s.guide_id);}
 const inputs=h.captured.map(b=>JSON.parse(b.input));assert.equal(inputs[0].sessions[0].answers.length,3);assert.equal(inputs[1].sessions[0].answers.length,7);
 assert.ok(h.captured[1].text.format.schema.properties.findings.items.properties.theme_ids.items.enum.includes('T7'));
 assert.ok(!h.captured[0].text.format.schema.properties.findings.items.properties.theme_ids.items.enum.includes('T7'));
}));
test('new seven-topic cross request preserves all sources, text, revisions and denominators',()=>withHarness(async h=>{
 const guide=await h.custom(),a=await h.seed({guide,count:7}),b=await h.seed({guide,count:7});await h.enable(()=>response({findings:[]}));
 const r=await h.cross([a,b]);assert.equal(r.status,200,JSON.stringify(r.data));const input=JSON.parse(h.captured[0].input);
 assert.equal(input.sessions.length,2);for(const s of [a,b]){const p=input.sessions.find(x=>x.id===s.id);assert.equal(p.answers.length,7);assert.deepEqual(p.answers.map(x=>x.text),s.answers.map(x=>x.final_text));assert.equal(p.content_revision,s.content_revision);}
 assert.equal(input.denominators.T7.N,2);assert.equal(input.denominators.T7.A_any,2);assert.equal(r.data.scope,'cross');
}));
test('ready cross replay does not call stub or increment analysis quota again',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();const first=await h.cross([a,b]);const replay=await h.cross([a,b]);assert.equal(replay.data.id,first.data.id);assert.equal(h.sends,1);assert.equal((await h.repo.budget()).cross_count,1);
},true));
test('ready single replay calls stub once and preserves snapshot',()=>withHarness(async h=>{
 const s=await h.seed(),path=`/api/sessions/${s.id}/analysis`,body={request_id:'single'};const first=await h.call(path,body),replay=await h.call(path,body);
 assert.equal(first.status,200);assert.equal(replay.data.id,first.data.id);assert.equal(h.sends,1);
},true));
test('full legal long seven-topic single input has explicit no-send limit and immutable retry',()=>withHarness(async h=>{
 const guide=await h.custom(),s=await h.seed({guide,count:7,length:1500});await h.enable(()=>response({findings:[]}));
 const body={request_id:'long-single'},path=`/api/sessions/${s.id}/analysis`;const r=await h.call(path,body);
 assert.equal(r.status,422);assert.equal(r.data.error.code,'ENGINEERING_INPUT_LIMIT');assert.equal(h.sends,0);assert.equal((await h.repo.budget()).reservations.length,0);
 const row=h.DB.sqlite.prepare('SELECT * FROM analysis_runs').get();const retry=await h.call(path,body);assert.equal(retry.data.error.code,'ENGINEERING_INPUT_LIMIT');assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.deepEqual(JSON.parse(row.input_manifest_json),manifest([s]));
}));
test('oversized seven-topic cross payload fails explicitly before provider/reservation',()=>withHarness(async h=>{
 const guide=await h.custom(),a=await h.seed({guide,count:7,length:1500}),b=await h.seed({guide,count:7,length:1500});await h.enable(()=>response({findings:[]}));
 const r=await h.cross([a,b]);assert.equal(r.status,422);assert.equal(r.data.error.code,'CROSS_INPUT_LIMIT');assert.equal(h.sends,0);assert.equal((await h.repo.budget()).reservations.length,0);
}));
test('in-flight correction rejects late candidate for entire cross manifest',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();let entered,finish;const started=new Promise(r=>entered=r);await h.enable(()=>{entered();return new Promise(r=>finish=r);});
 const pending=h.cross([a,b]);await started;await h.repo.mutate(b,h.g,{type:'correct',request_id:'fix',expected_version:b.state_version,answer_id:b.answers[0].id,answer_revision:1,final_text:'Revised synthetic input',reason:'QA'});
 finish(response({findings:[]}));const r=await pending;assert.equal(r.status,409);assert.equal(r.data.error.code,'STALE_ANALYSIS');assert.equal(h.DB.sqlite.prepare('SELECT result_json FROM analysis_runs').get().result_json,null);
}));
test('fabricated source mapping rejects candidate without laundering stub output',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();const span=sourceSpan(a,a.answers[0]);span.session_id=b.id;
 await h.enable(()=>response({findings:[{id:'synthetic-finding',claim:'Synthetic tentative interpretation',supporting_spans:[span],counter_spans:[],unknowns:['Hand-authored fake test output'],theme_ids:['T1']}]}));
 const r=await h.cross([a,b]);assert.equal(r.status,502);assert.equal(r.data.error.code,'INVALID_SOURCE_SPAN');assert.equal(h.DB.sqlite.prepare('SELECT result_json FROM analysis_runs').get().result_json,null);
}));
test('concurrent identical snapshot requests persist one run and source set',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();const results=await Promise.all([h.cross([a,b]),h.cross([a,b])]);
 assert.ok(results.every(r=>r.status===202));assert.equal(results[0].data.id,results[1].data.id);
 assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_sources').get().n,2);
}));
test('failed claimed cross task retry never dispatches a second stub request',()=>withHarness(async h=>{
 const a=await h.seed(),b=await h.seed();await h.enable(()=>Response.json({error:{message:'HAND-AUTHORED OFFLINE ERROR'}},{status:500}));
 const first=await h.cross([a,b]);assert.ok(first.status>=400);assert.equal(h.sends,1);
 const runId=h.DB.sqlite.prepare('SELECT id FROM analysis_runs').get().id;
 const retry=await h.cross([a,b]);assert.ok([202,409].includes(retry.status),JSON.stringify(retry.data));
 if(retry.status===409)assert.equal(retry.data.error.code,'ATTEMPT_ALREADY_CLAIMED');
 else {assert.equal(retry.data.id,runId);assert.notEqual(retry.data.status,'ready');assert.deepEqual(retry.data.findings,[]);assert.equal((await h.repo.budget()).live_enabled,false);}
 assert.equal(h.sends,1);
 assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.equal(await h.repo.providerAttemptCount(),1);
}));
