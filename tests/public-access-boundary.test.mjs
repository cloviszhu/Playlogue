import test from 'node:test';import assert from 'node:assert/strict';
import {api,Repository,sha256} from '../work/test-api.mjs';
import {builtinDefaultGuide} from '../shared/default-guide.mjs';import {localD1} from './sqlite-d1.mjs';

test('public page access does not grant hosted model or researcher permissions',async()=>{
 const DB=localD1(),repo=new Repository(DB),origin='https://public-page-test.invalid',cap='P'.repeat(43),native=globalThis.fetch;let sends=0;
 globalThis.fetch=async()=>{sends++;throw new Error('EXTERNAL_NETWORK_FORBIDDEN');};
 try{
  await repo.updateBudget(b=>({...b,live_enabled:true,revision:b.revision+1}));
  const env={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'owner',HOSTED_PROVIDER_ENABLED:'true',HOSTED_IDENTITY_VERIFIED:'true',PROVIDER_PRICING_VERIFIED:'sol-standard-2026-10-04-engineering-buffer',OPENAI_API_KEY:'offline-sentinel',PRIOR_SPEND_UPPER_MICRO_USD:'0',PRIOR_UNKNOWN_MICRO_USD:'0'};
  const call=async(path,{body,owner=false,token=cap}={})=>{const r=await api(new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token,...owner?{'oai-authenticated-user-id':'owner'}:{}},...body?{body:JSON.stringify(body)}:{}}),env);return {status:r.status,data:await r.json()};};
  const publicRead=await call('/api/public/study');assert.equal(publicRead.status,200);assert.equal(publicRead.data.guide.id,builtinDefaultGuide().id);assert.equal(publicRead.data.live_enabled,false);
  assert.equal((await call('/api/public/study',{owner:true})).data.live_enabled,true);
  const consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
  const create=await call('/api/sessions',{body:{request_id:'anonymous-create',guide_id:builtinDefaultGuide().id,consent,origin:'demo_live',initial_mode:'text'}});assert.equal(create.status,503);assert.equal(create.data.error.code,'LIVE_DISABLED');
  for(const path of ['/api/whoami','/api/research/sessions','/api/research/diagnostics'])assert.equal((await call(path)).status,403);
  assert.equal((await call('/api/research/analysis',{body:{request_id:'anon-cross',session_ids:[]}})).status,403);
  const saved=await repo.create(builtinDefaultGuide(),consent,'demo_live','text',await sha256(cap),'synthetic-existing','synthetic');
  assert.equal((await call('/api/sessions/'+saved.id,{token:'W'.repeat(43)})).status,404);
  assert.equal((await call('/api/sessions/'+saved.id)).status,200);
  const ownAnalysis=await call('/api/sessions/'+saved.id+'/analysis',{body:{request_id:'capability-only'}});assert.equal(ownAnalysis.status,202);assert.equal(ownAnalysis.data.status,'blocked_live_disabled');
  assert.equal(sends,0);assert.equal(await repo.providerAttemptCount(),0);
 }finally{globalThis.fetch=native;DB.close();}
});
