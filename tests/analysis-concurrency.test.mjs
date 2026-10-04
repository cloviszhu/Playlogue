import test from'node:test';import assert from'node:assert/strict';
import worker from'../dist/server/index.js';import{Repository,sha256}from'../work/test-api.mjs';import{localD1}from'./sqlite-d1.mjs';import{builtinDefaultGuide}from'../shared/default-guide.mjs';import{sourceSpan}from'../shared/evidence.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const origin='https://atomic-analysis.invalid',token='R'.repeat(43),consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
async function race(mode){
 const DB=localD1(),repo=new Repository(DB),native=globalThis.fetch,readers=deferred(),provider=deferred(),finished=deferred();let reads=0,batches=0,sends=0;
 try{
  const g=builtinDefaultGuide();let s=await repo.create(g,consent,'demo_live','text',await sha256(token),'fixture','fixture',true);
  s=(await repo.mutate(s,g,{type:'answer',request_id:'answer',expected_version:s.state_version,question_id:s.current,response_status:'valid',final_text:'Invented exact detail, preserved without truncation.',input_mode:'text'})).session;
  s=(await repo.mutate(s,g,{type:'end',request_id:'end',expected_version:s.state_version})).session;
  await repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));
  const span=sourceSpan(s,s.answers[0]),finding={id:'complete-result',claim:'Synthetic atomicity evidence',supporting_spans:[span],counter_spans:[],unknowns:['Offline stub'],theme_ids:['T1']};
  globalThis.fetch=async()=>{sends++;if(mode==='held-provider')await provider.promise;return Response.json({status:'completed',usage:{input_tokens:10,output_tokens:10},output:[{content:[{type:'output_text',text:JSON.stringify({findings:[finding]})}]}]});};
  // Actual SQL/results; only scheduling changes, matching the independent B07 reproduction.
  const prepare=DB.prepare.bind(DB),batch=DB.batch.bind(DB);
  DB.prepare=sql=>{const st=prepare(sql);st.sqlForTest=sql;
   if(sql.startsWith("SELECT id FROM analysis_runs WHERE scope='single'")&&sql.includes("status='awaiting_provider'")){const first=st.first.bind(st);st.first=async()=>{const value=await first();if(++reads===2)readers.resolve();await readers.promise;return value;};}
   if(sql.startsWith('UPDATE analysis_runs SET result_json=')){const run=st.run.bind(st);st.run=async()=>{const result=await run();finished.resolve();return result;};}return st;
  };
  DB.batch=async statements=>{if(statements[0].sqlForTest?.startsWith('INSERT INTO analysis_runs')&&++batches===2&&mode==='winner-completes-before-loser-insert')await finished.promise;return batch(statements);};
  const env={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'offline-owner',PUBLIC_DEMO_ENABLED:'true',HOSTED_PROVIDER_ENABLED:'true',HOSTED_IDENTITY_VERIFIED:'true',PROVIDER_PRICING_VERIFIED:'sol-standard-2026-10-04-engineering-buffer',OPENAI_API_KEY:'OFFLINE_STUB',PRIOR_SPEND_UPPER_MICRO_USD:'0',PRIOR_UNKNOWN_MICRO_USD:'0'};
  const call=async request_id=>{const r=await worker.fetch(new Request(origin+'/api/sessions/'+s.id+'/analysis',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({request_id})}),env);return{status:r.status,data:await r.json()};};
  const pending=[call('tab-a'),call('tab-b')];
  if(mode==='held-provider'){const loser=await Promise.race(pending);assert.equal(loser.status,409);provider.resolve();}
  const results=await Promise.all(pending);assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409].includes(r.status)));assert.equal(sends,1);
  const ready=results.find(r=>r.status===200).data;assert.equal(ready.status,'ready');assert.deepEqual(ready.findings[0].supporting_spans[0],span);assert.equal(ready.findings[0].claim,finding.claim);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_runs').get().n,1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM analysis_sources').get().n,1);assert.equal(await repo.providerAttemptCount(),1);assert.equal((await repo.budget()).counts[s.id+':analysis'],1);assert.equal((await repo.budget()).reservations.length,1);
  if(mode==='winner-completes-before-loser-insert'){assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(results[0].data.id,results[1].data.id);assert.deepEqual(results[0].data.findings,results[1].data.findings);}
 }finally{provider.resolve();globalThis.fetch=native;DB.close();}
}
for(const mode of['held-provider','immediate-provider','winner-completes-before-loser-insert'])test('same-source atomic single analysis: '+mode,{timeout:10000},async()=>{for(let i=0;i<3;i++)await race(mode);});
