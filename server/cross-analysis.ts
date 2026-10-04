import{singleAnalysisInput}from'./single-analysis-input.ts';
import {Repository,ApiError}from'./repository.ts';
import {BoundedTransport}from'./bounded-transport.ts';
import {analysisSchemaFor,analysisInput,validateAnalysis}from'./text-protocol.ts';
import {reserveCall}from'../shared/budget.mjs';
import {sessionTopicIds}from'../shared/custom-study.mjs';
import {manifest,denominators}from'../shared/evidence.mjs';
import type {LocalTextEnv}from'./local-text.ts';
export interface CrossEnv {LOCAL_ENGINEERING_CROSS_ANALYSIS?:boolean;}
const PRICE='sol-cross-synthetic-phase-20261004';
// Caller must first obtain the existing fully gated text service; no new auth/activation path.
export function crossAnalysis(env:LocalTextEnv&CrossEnv,repo:Repository,local:boolean){
 if(local&&env.LOCAL_ENGINEERING_CROSS_ANALYSIS!==true)return null;
 return {async analyze(run:any,sessions:any[]){
  if(sessions.length<2||sessions.length>10||sessions.some(s=>(local?s.origin!=='demo_live':!['demo_live','real_self_report'].includes(s.origin))||!s.consent?.adult_confirmed||!s.consent?.research_agreed||!s.consent?.cloud_agreed))throw new ApiError(422,'CROSS_SOURCE_REQUIRED');
  const fresh=await repo.analysis(run.id);if(!fresh||fresh.stale||fresh.status!=='awaiting_provider')throw new ApiError(409,'STALE_ANALYSIS');
  if(JSON.stringify(fresh.input_manifest)!==JSON.stringify(manifest(sessions)))throw new ApiError(409,'STALE_ANALYSIS');
  const ledger={reserve:(r:any)=>repo.updateBudget(c=>{if(local){const amount=c.reservations.filter((x:any)=>x.price_version===PRICE).reduce((n:number,x:any)=>n+(x.status==='settled'?(x.accounted_micro_usd??x.ceiling_micro_usd):x.ceiling_micro_usd),0);if(amount+r.ceiling_micro_usd>1000000)throw new ApiError(503,'CROSS_ENGINEERING_PHASE_COST_CAP');}return reserveCall(c,r);}),settle:repo.settle.bind(repo),claimAttempt:(id:string,task:any,model:string)=>repo.claimCrossAttempt(id,task,model,fresh.input_manifest),finishAttempt:repo.finishAttempt.bind(repo),pauseLive:repo.pauseLive.bind(repo),recordDiagnostic:repo.recordDiagnostic.bind(repo)};
  const transport=new BoundedTransport(ledger,{enabled:true,identity_verified:true,cloud_consent_verified:true,api_key:local?env.LOCAL_OPENAI_API_KEY!:env.OPENAI_API_KEY!,price_version:local?PRICE:'sol-hosted-cross-engineering-buffer-20261004',stt_price_ceiling_verified:false,reservation_basis:'engineering_buffer',inputTokenBound:async request=>{const bytes=new TextEncoder().encode(JSON.stringify(request)).length;if(bytes>11904)throw new ApiError(422,'CROSS_INPUT_LIMIT');return bytes*2+8192;}},local?env.LOCAL_PROVIDER_FETCH:undefined);
  const original=JSON.parse(singleAnalysisInput(sessions));original.instruction+=' Compare these selected interviews without flattening differences. If an answer explicitly disagrees with a candidate interpretation, attach it as counter_spans. Include unresolved limits in unknowns. Use only supplied sources; do not invent counts, percentages or causation. Denominators below are computed from recorded exposure, not assumed reading or population estimates.';original.denominators=Object.fromEntries(sessionTopicIds(sessions).map(t=>[t,denominators(sessions,t)]));
  const output=await transport.text({task_id:'cross-analysis-'+run.id,operation:'cross_analysis',session_id:sessions[0].id,content_revision:sessions[0].content_revision},JSON.stringify(original),analysisSchemaFor(sessions),v=>validateAnalysis(v,sessions));
  await repo.recordDiagnostic({stage:'analysis_validate',status:'succeeded',operation:'cross_analysis',analysis_id:run.id});const saved=await repo.commitCandidates(run.id,output,'provider');await repo.recordDiagnostic({stage:'analysis_persist',status:'succeeded',operation:'cross_analysis',analysis_id:run.id});return saved;
 }};
}
