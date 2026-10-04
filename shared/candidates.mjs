import {sessionTopicIds}from'./custom-study.mjs';
import {validateSpan}from'./evidence.mjs';
export function validateCandidates(output,sessions,now=Date.now()){
 if(!output||!Array.isArray(output.findings)||output.findings.length>20)throw new Error('INVALID_CANDIDATES');
 const ids=new Set();const findings=output.findings.map(f=>{
  if(!f||typeof f.id!=='string'||!f.id||f.id.length>100||ids.has(f.id)||typeof f.claim!=='string'||!f.claim.trim()||f.claim.length>1000||!Array.isArray(f.supporting_spans)||!f.supporting_spans.length||f.supporting_spans.length>30||!Array.isArray(f.counter_spans)||f.counter_spans.length>30||!Array.isArray(f.unknowns)||f.unknowns.some(x=>typeof x!=='string'||x.length>1000)||!Array.isArray(f.theme_ids)||f.theme_ids.some(x=>!sessionTopicIds(sessions).includes(x)))throw new Error('INVALID_CANDIDATES');
  if([...f.supporting_spans,...f.counter_spans].some(span=>!validateSpan(span,sessions,now)))throw new Error('INVALID_SOURCE_SPAN');ids.add(f.id);
  return {id:f.id,claim:f.claim.trim(),supporting_spans:structuredClone(f.supporting_spans),counter_spans:structuredClone(f.counter_spans),unknowns:[...f.unknowns],theme_ids:[...f.theme_ids],review_status:'pending',review_history:[]};
 });return {findings};
}
