import {ApiError,Repository} from './repository.ts';
import {models} from '../shared/session.mjs';
import {validatePcmWav} from './audio-validation.ts';
import type {ProviderTask} from './providers.ts';
import {providerErrorCode,providerErrorType,providerErrorParam,providerRequestId,transportErrorName,transportCauseCode,localErrorCode}from'./provider-metadata.mjs';

export interface TransportGate {
 enabled:boolean; identity_verified:boolean; cloud_consent_verified:boolean;
 api_key:string; price_version:string;
 // Must count/bound the COMPLETE request including schema, instructions and framing.
 // No length/4 estimate. Default has no implementation and therefore cannot send.
 inputTokenBound?:(request:Readonly<Record<string,unknown>>)=>Promise<number>;
 stt_price_ceiling_verified:boolean;
 reservation_basis?:'verified_bound'|'engineering_buffer';
}
type Ledger=Pick<Repository,'reserve'|'settle'|'claimAttempt'|'finishAttempt'|'pauseLive'>&{recordDiagnostic?:(event:any)=>Promise<unknown>};
type Send=(url:string,init:RequestInit)=>Promise<Response>;
const reject=(code:string):never=>{throw new ApiError(503,code);};
// One invocation = one unique attempt. No SDK, automatic retries, or automatic repairs.
// Business-result validation and revision CAS remain the caller's responsibility.
export class BoundedTransport {
 constructor(private ledger:Ledger,private gate:TransportGate,private send:Send=(url,init)=>globalThis.fetch(url,init)){}
 private readiness(){const g=this.gate;if(!g.enabled||!g.identity_verified||!g.cloud_consent_verified)reject('LIVE_DISABLED');if(!g.api_key||!g.price_version)reject('PROVIDER_NOT_READY');}
 async text(task:ProviderTask,input:string,schema:Record<string,unknown>,validate:(value:unknown)=>unknown){
  this.readiness();if(!['decision','analysis','cross_analysis'].includes(task.operation))reject('INVALID_OPERATION');
  const request={model:models[task.operation==='decision'?'decision':'analysis'],input,store:false,tools:[],service_tier:'default',reasoning:{effort:task.operation==='decision'?'low':'medium',mode:'standard'},max_output_tokens:2048,text:{format:{type:'json_schema',name:task.operation,strict:true,schema}}};
  if(!this.gate.inputTokenBound)reject('TOKEN_BOUND_REQUIRED');
  const bound=await this.gate.inputTokenBound!(structuredClone(request));
  if(!Number.isSafeInteger(bound)||bound<=0||bound>32000)reject('TOKEN_BOUND_REQUIRED');
  const ceiling=Math.ceil(bound*2.5+2048*10); // cache-write worst case; reasoning included in output cap
  const json=await this.attempt(task,ceiling,()=>({body:JSON.stringify(request),headers:{'Content-Type':'application/json'}}),'responses',undefined,bound);
  if(json.status!=='completed'||!Array.isArray(json.output))throw new ApiError(502,'PROVIDER_INCOMPLETE');
  const texts:string[]=[];
  for(const item of json.output)for(const part of item.content||[]){if(part.type==='refusal')throw new ApiError(502,'PROVIDER_REFUSAL');if(part.type==='output_text'&&typeof part.text==='string')texts.push(part.text);}
  if(texts.length!==1)throw new ApiError(502,'PROVIDER_STRUCTURE');
  let value:unknown;try{value=JSON.parse(texts[0]);}catch{throw new ApiError(502,'PROVIDER_STRUCTURE');}
  return validate(value);
 }
 async stt(task:ProviderTask,audio:ArrayBuffer){
  this.readiness();if(task.operation!=='stt')reject('INVALID_OPERATION');
  const media=validatePcmWav(audio);
  if(!this.gate.stt_price_ceiling_verified)reject('STT_BILLING_BOUND_REQUIRED');
  // Explicit verified billing gate required: two full minutes at $0.0045/min.
  const json=await this.attempt(task,9000,()=>{const f=new FormData();f.set('model',models.stt);f.set('file',new Blob([audio],{type:'audio/wav'}),'recording.wav');f.set('response_format','json');f.set('language','en');return {body:f};},'audio/transcriptions',media.seconds);
  if(typeof json.text!=='string'||json.text.length>1500)throw new ApiError(502,'TRANSCRIPT_LIMIT');
  return json.text;
 }
 async tts():Promise<never>{return reject('TTS_PRICE_OUTPUT_BOUND_REQUIRED');}
 private async attempt(task:ProviderTask,ceiling:number,body:()=>RequestInit,path:string,seconds?:number,inputBound?:number){
  const id=crypto.randomUUID(),model=models[task.operation==='cross_analysis'?'analysis':task.operation];
  await this.ledger.reserve({task_id:id,session_id:task.session_id,operation:task.operation,ceiling_micro_usd:ceiling,price_version:this.gate.price_version,...(seconds===undefined?{}:{audio_seconds:seconds})});
  const claimed=await this.ledger.claimAttempt(id,task,model);
  if(!claimed){await this.ledger.settle(id,0,{confirmed_finished:true});throw new ApiError(409,'ATTEMPT_ALREADY_CLAIMED');}
  const started=Date.now();await this.ledger.recordDiagnostic?.({stage:'provider_dispatch',status:'started',operation:task.operation,provider_attempt_id:id});let completed=false;let diagnostic:Record<string,unknown>={provider_call_id:id,task_id:task.task_id,operation:task.operation,local_phase:'dispatch'};
  try{
   const send=this.send;const res=await send('https://api.openai.com/v1/'+path,{...body(),method:'POST',headers:{...bodyHeaders(path),Authorization:'Bearer '+this.gate.api_key},signal:AbortSignal.timeout(30000)});
   diagnostic={...diagnostic,upstream_http_status:res.status,upstream_request_id:providerRequestId(res.headers.get('x-request-id')),local_phase:'response_body'};
   // Receipt of an HTTP response alone is insufficient for billing proof. Unknown costs stay held.
   const raw=await boundedBody(res);completed=true;
   if(!res.ok){let failure:any;try{failure=JSON.parse(raw).error;}catch{}diagnostic={...diagnostic,provider_error_code:providerErrorCode(failure?.code),provider_error_type:providerErrorType(failure?.type),provider_error_param:providerErrorParam(failure?.param)};throw new ApiError(res.status===429?429:502,'PROVIDER_HTTP_ERROR');}
   diagnostic.local_phase='parse_json';let json:any;try{json=JSON.parse(raw);}catch{throw new ApiError(502,'PROVIDER_STRUCTURE');}
   // Charge reservation conservatively. Usage not assumed to distinguish cache writes.
   let accounted=ceiling;let metadata:any={...diagnostic,local_phase:'completed',accounted_upper_bound_micro_usd:ceiling,billing_confirmed:false,reservation_basis:this.gate.reservation_basis||'verified_bound'};
   diagnostic.local_phase='usage_validation';if(path==='responses'){const u=json.usage,i=u?.input_tokens,o=u?.output_tokens,c=u?.input_tokens_details?.cached_tokens||0,r=u?.output_tokens_details?.reasoning_tokens||0;if(![i,o,c,r].every(n=>Number.isSafeInteger(n)&&n>=0)||c>i||o>2048)throw new ApiError(502,'USAGE_UNVERIFIED');accounted=Math.ceil(((i-c)*2.5+c*0.1+o*10)*1.1);metadata={...metadata,input_tokens:i,output_tokens:o,cached_input_tokens:c,reasoning_tokens:r,accounted_upper_bound_micro_usd:accounted,standard_cost_estimate_micro_usd:(i-c)*2+c*0.1+o*10};if(i>inputBound!||accounted>ceiling){await this.ledger.settle(id,accounted,{confirmed_finished:true,cost_basis:'upper_bound'});throw new ApiError(502,'RESERVATION_OVERRUN');}}
   await this.ledger.settle(id,accounted,{confirmed_finished:true,cost_basis:'upper_bound'});
   await this.ledger.finishAttempt(id,'completed',metadata);await this.ledger.recordDiagnostic?.({stage:'provider_response',status:'succeeded',operation:task.operation,provider_attempt_id:id,http_status:diagnostic.upstream_http_status,provider_request_id:diagnostic.upstream_request_id,duration_ms:Date.now()-started});
   return json;
  }catch(error){
   const phases:Record<string,string>={dispatch:'fetch_exception',response_body:'body_read_exception',parse_json:'parse_exception',usage_validation:'usage'};await this.ledger.recordDiagnostic?.({stage:'provider_response',status:'failed',operation:task.operation,provider_attempt_id:id,duration_ms:Date.now()-started,failure:{error,phase:diagnostic.provider_error_code?'upstream_http':phases[String(diagnostic.local_phase)],http_status:diagnostic.upstream_http_status,provider_request_id:diagnostic.upstream_request_id,provider_error_code:diagnostic.provider_error_code}});
   await this.ledger.settle(id,null,{confirmed_finished:completed});
   const e=error as any;diagnostic={...diagnostic,local_error_code:e instanceof ApiError?localErrorCode(e.code):'PROVIDER_UNAVAILABLE',transport_error_name:e instanceof ApiError?null:transportErrorName(e?.name),transport_cause_code:transportCauseCode(e?.cause?.code),transport_error_category:e instanceof ApiError?'provider_or_parse':e?.message?.startsWith('Illegal invocation')?'illegal_invocation':e?.name==='TimeoutError'?'timeout':e?.name==='AbortError'?'aborted':e?.name==='TypeError'?'fetch_or_network':'unknown'};await this.ledger.finishAttempt(id,'unknown',diagnostic);
   // Timeout/unknown billing halts future sends, rather than treating lease expiry as remote completion.
   await this.ledger.pauseLive();
   if(error instanceof ApiError){Object.assign(error,{provider_call_id:id,provider_failure:diagnostic});throw error;}throw Object.assign(new ApiError(502,'PROVIDER_UNAVAILABLE'),{provider_call_id:id,provider_failure:diagnostic});
  }
 }
}
function bodyHeaders(path:string):Record<string,string>{return path==='responses'?{'Content-Type':'application/json'}:{};}
async function boundedBody(res:Response){const reader=res.body?.getReader();if(!reader)return '';const parts:Uint8Array[]=[];let size=0;while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>1024*1024){await reader.cancel();throw new ApiError(502,'PROVIDER_RESPONSE_LIMIT');}parts.push(next.value);}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return new TextDecoder().decode(bytes);}

