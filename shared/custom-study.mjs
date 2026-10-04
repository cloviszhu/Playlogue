import {routingPolicies} from './routing.mjs';
// All lengths are UTF-16 code units, matching HTML maxlength and answer evidence offsets.
export const customStudyLimits = Object.freeze({title:120,goal:1000,game:120,game_build:120,target_players:500,question:400,fixed:9,probes:2,total:9,draft_bytes:16000});
const fail=()=>{throw Object.assign(new Error('INVALID_CUSTOM_STUDY'),{code:'INVALID_CUSTOM_STUDY'});};
const keys=(value,expected)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==expected.length||expected.some(k=>!Object.hasOwn(value,k)))fail();};
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail();return value.trim();};
export function validateCustomStudy(input){
 keys(input,['title','goal','game','game_build','target_players','questions']);
 const output=Object.fromEntries(['title','goal','game','game_build','target_players'].map(k=>[k,text(input[k],customStudyLimits[k])]));
 if(!Array.isArray(input.questions)||!input.questions.length||input.questions.length>customStudyLimits.fixed)fail();
 output.questions=input.questions.map(q=>{keys(q,['text','allow_followups','followup_limit']);if(typeof q.allow_followups!=='boolean'||!Number.isInteger(q.followup_limit)||q.followup_limit<0||q.followup_limit>2||(!q.allow_followups&&q.followup_limit!==0)||(q.allow_followups&&q.followup_limit===0))fail();return {text:text(q.text,customStudyLimits.question),allow_followups:q.allow_followups,followup_limit:q.followup_limit};});
 if(output.questions.reduce((n,q)=>n+1+q.followup_limit,0)>customStudyLimits.total)fail();
 if(new TextEncoder().encode(JSON.stringify(output)).length>customStudyLimits.draft_bytes)fail();
 return output;
}
export function customGuide(input,studyId,{id=()=>crypto.randomUUID(),now=()=>Date.now()}={}){
 const d=validateCustomStudy(input);
 return {kind:'custom',routing_policy:routingPolicies.immediate,study_id:studyId,id:id(),version:1,published_at:new Date(now()).toISOString(),title:d.title,goal:d.goal,game:d.game,game_build:d.game_build,target_players:d.target_players,language:'en',themes:d.questions.map((q,i)=>({id:`T${i+1}`,fixed_id:`F${i+1}`,name:`Question ${i+1}`,text:q.text,budget:q.followup_limit}))};
}
// Guide scope accompanies these IDs in session manifests and all source spans.
export function sessionTopicIds(sessions){return [...new Set(sessions.flatMap(s=>s.topic_ids||['T1','T2','T3']))];}
