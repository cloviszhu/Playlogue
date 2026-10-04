import {limits}from'./session.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function initialBudget(){return {revision:0,live_enabled:false,approved_cap_micro_usd:20000000,known_spend_micro_usd:0,reservations:[],counts:{},utc_day:null,cross_count:0,creation_day:null,creation_keys:[]};}
export function reserveSessionEntry(original,key,now=Date.now()){const c=structuredClone(original);if(!c.live_enabled)fail('LIVE_DISABLED');if(now>=Date.parse(limits.cutoff))fail('CALL_CUTOFF');if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('ENTRY_KEY_REQUIRED');const day=new Date(now).toISOString().slice(0,10);if(c.creation_day!==day){c.creation_day=day;c.creation_keys=[];}if(c.creation_keys.includes(key))return c;if(c.creation_keys.length>=limits.daily_sessions)fail('SESSION_LIMIT');c.creation_keys.push(key);c.revision++;return c;}
// ceiling must be calculated from bounded input/output and verified current pricing by the eventual transport.
export function reserveCall(original,request,now=Date.now()){
 const c=structuredClone(original),r=request;if(!c.live_enabled)fail('LIVE_DISABLED');if(now>=Date.parse(limits.cutoff))fail('CALL_CUTOFF');
 if(!['decision','analysis','stt','tts','cross_analysis'].includes(r.operation)||typeof r.task_id!=='string'||!r.task_id||!r.price_version||!Number.isSafeInteger(r.ceiling_micro_usd)||r.ceiling_micro_usd<=0)fail('CEILING_REQUIRED');
 const old=c.reservations.find(x=>x.task_id===r.task_id);if(old){if(old.operation!==r.operation||old.ceiling_micro_usd!==r.ceiling_micro_usd||old.price_version!==r.price_version||old.session_id!==r.session_id)fail('RESERVATION_MISMATCH');return c;}
 if(c.reservations.filter(x=>x.lease_released!==true&&x.lease_until>now).length>=limits.concurrency)fail('CONCURRENCY_LIMIT');
 const held=c.reservations.filter(x=>['reserved','unknown'].includes(x.status)).reduce((n,x)=>n+x.ceiling_micro_usd,0);
 if(c.known_spend_micro_usd+held+r.ceiling_micro_usd>c.approved_cap_micro_usd)fail('COST_CAP');
 const day=new Date(now).toISOString().slice(0,10);if(c.utc_day!==day){c.utc_day=day;c.cross_count=0;}
 if(r.operation==='cross_analysis'){if(c.cross_count>=limits.cross_daily)fail('CALL_LIMIT');c.cross_count++;}else{if(!r.session_id)fail('SESSION_REQUIRED');const key=r.session_id+':'+r.operation;c.counts[key]=(c.counts[key]||0)+1;if(c.counts[key]>limits[r.operation])fail('CALL_LIMIT');}
 if(r.operation==='stt'){const seconds=r.audio_seconds===undefined?90:r.audio_seconds;if(!Number.isFinite(seconds)||seconds<=0||seconds>90)fail('AUDIO_LIMIT');const key=r.session_id+':stt_seconds';c.counts[key]=(c.counts[key]||0)+seconds;if(c.counts[key]>limits.stt_seconds)fail('AUDIO_LIMIT');}
 c.reservations.push({...r,status:'reserved',lease_until:now+60000});c.revision++;return c;
}
export function settleCall(original,taskId,costMicroUsd,{confirmed_finished=false,cost_basis='actual'}={}){const c=structuredClone(original),r=c.reservations.find(x=>x.task_id===taskId);if(!r)fail('RESERVATION_REQUIRED');if(r.status==='settled')return c;
 if(costMicroUsd===null){r.status='unknown';r.lease_released=confirmed_finished===true;c.revision++;return c;}if(!Number.isSafeInteger(costMicroUsd)||costMicroUsd<0||!['actual','upper_bound'].includes(cost_basis))fail('INVALID_COST');r.status='settled';r.lease_released=confirmed_finished===true;r.cost_basis=cost_basis;r.accounted_micro_usd=costMicroUsd;if(cost_basis==='actual')r.actual_micro_usd=costMicroUsd;c.known_spend_micro_usd+=costMicroUsd;if(costMicroUsd>r.ceiling_micro_usd||c.known_spend_micro_usd>c.approved_cap_micro_usd){c.live_enabled=false;c.overrun_detected=true;}c.revision++;return c;}
