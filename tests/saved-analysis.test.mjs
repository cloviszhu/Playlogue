import test from'node:test';import assert from'node:assert/strict';
import worker from'../dist/server/index.js';import{Repository,sha256}from'../work/test-api.mjs';import{localD1}from'./sqlite-d1.mjs';import{builtinDefaultGuide}from'../shared/default-guide.mjs';import{sourceSpan}from'../shared/evidence.mjs';import{createHttpAdapter}from'../client/adapter.js';
const origin='https://saved-analysis.invalid',token='S'.repeat(43),otherToken='T'.repeat(43),consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
async function setup(fn){const DB=localD1(),repo=new Repository(DB),native=globalThis.fetch;globalThis.fetch=()=>{throw Error('PROVIDER_FORBIDDEN_DURING_RECOVERY');};let serial=0;
 const h={DB,repo,env:{DB,APP_ORIGIN:origin},seed:async(source='demo_live',marker=false)=>{const g=builtinDefaultGuide();let s=await repo.create(g,consent,source,'text',await sha256(token),'seed-'+(++serial),'synthetic-only',marker);s=(await repo.mutate(s,g,{type:'answer',request_id:'answer',expected_version:0,question_id:s.current,response_status:'valid',input_mode:'text',final_text:'Synthetic old saved answer, complete and unchanged.'})).session;s=(await repo.mutate(s,g,{type:'end',request_id:'end',expected_version:s.state_version})).session;return s;},read:async(id,cap=token)=>{const r=await worker.fetch(new Request(origin+'/api/sessions/'+id+'/analysis',{headers:cap?{Authorization:'Bearer '+cap}:{}}),h.env);return{status:r.status,data:await r.json()};}};
 h.run=async(s,owner=s.id,scope='single',sources=[s])=>repo.snapshot(sources,owner,{request_key:'run-'+(++serial),scope,status:'awaiting_provider'});
 h.complete=async(s,run)=>repo.commitCandidates(run.id,{findings:[{id:'retained',claim:'Synthetic stored finding',supporting_spans:[sourceSpan(s,s.answers[0])],counter_spans:[],unknowns:['Seeded fixture; no model call'],theme_ids:['T1']}]});
 try{await fn(h);}finally{globalThis.fetch=native;DB.close();}
}
for(const [label,source,marker]of[['legacy human-labeled synthetic fixture','real_self_report',false],['new marked practice','demo_live',true]])test('read existing '+label+' result without a new run, ledger mutation or provider call',()=>setup(async h=>{
 const s=await h.seed(source,marker),run=await h.run(s),ready=await h.complete(s,run);await h.repo.updateBudget(b=>({...b,live_enabled:false,known_spend_micro_usd:12345,revision:b.revision+1}));const budget=JSON.stringify(await h.repo.budget()),saved=JSON.stringify((await h.repo.get(s.id)).session);
 for(let i=0;i<3;i++){const r=await h.read(s.id);assert.equal(r.status,200);assert.deepEqual(r.data.analysis,ready);}
 assert.equal(JSON.stringify(await h.repo.budget()),budget);assert.equal(JSON.stringify((await h.repo.get(s.id)).session),saved);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.equal(await h.repo.providerAttemptCount(),0);
 for(const cap of[null,otherToken])assert.equal((await h.read(s.id,cap)).status,404);
}));
test('saved lookup excludes cross/foreign requester runs and reports absent result explicitly',()=>setup(async h=>{
 const a=await h.seed(),b=await h.seed();await h.run(a,b.id);await h.run(a,a.id,'cross',[a,b]);assert.deepEqual((await h.read(a.id)).data,{analysis:null});
 const run=await h.run(a);assert.equal((await h.read(a.id)).data.analysis.id,run.id);assert.equal((await h.read(a.id)).data.analysis.status,'awaiting_provider');assert.equal(await h.repo.providerAttemptCount(),0);
}));
test('saved lookup keeps full completed result over later pending work and marks corrected sources stale',()=>setup(async h=>{
 let s=await h.seed();const first=await h.complete(s,await h.run(s));await h.run(s);assert.deepEqual((await h.read(s.id)).data.analysis,first);
 const g=await h.repo.guide(s.guide_id);s=(await h.repo.mutate(s,g,{type:'correct',request_id:'correct',expected_version:s.state_version,answer_id:s.answers[0].id,answer_revision:1,final_text:'A corrected synthetic account.',reason:'Synthetic regression'})).session;
 const stale=(await h.read(s.id)).data.analysis;assert.equal(stale.id,first.id);assert.equal(stale.stale,true);assert.deepEqual(stale.findings,first.findings);
 s=(await h.repo.mutate(s,g,{type:'withdraw',request_id:'withdraw',expected_version:s.state_version})).session;assert.equal((await h.read(s.id)).status,410);assert.equal(await h.repo.providerAttemptCount(),0);
}));
test('HTTP saved-analysis adapter uses only capability-scoped GET and preserves normalized findings',async()=>{
 const calls=[],a=createHttpAdapter({tokenFor:()=>token,fetcher:async(path,options)=>{calls.push({path,options});return{ok:true,json:async()=>({analysis:{id:'stored',status:'ready',findings:[{id:'f',review_status:'approved'}]}})};}});
 const run=await a.getSavedAnalysis('own');assert.equal(run.id,'stored');assert.equal(run.findings[0].review_status,'confirmed');assert.equal(calls[0].path,'/api/sessions/own/analysis');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.headers.Authorization,'Bearer '+token);assert.equal(calls[0].options.body,undefined);
});
