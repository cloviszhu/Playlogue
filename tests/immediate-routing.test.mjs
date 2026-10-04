import test from 'node:test';
import assert from 'node:assert/strict';
import {customGuide} from '../shared/custom-study.mjs';
import {detonationDraft,legacyDetonationDraft} from '../shared/detonation-case.mjs';
import {createSession,transition,current} from '../shared/session.mjs';
import {routingPolicies,probeAllowance} from '../shared/routing.mjs';
import {sourceSpan,validateSpan,exportSession} from '../shared/evidence.mjs';

const consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
let n=0;const env={id:()=>`immediate-${++n}`,now:()=>Date.parse('2026-10-04T08:00:00Z')};
const op=(s,g,type,data={})=>transition(s,g,{request_id:env.id(),expected_version:s.state_version,type,...data},env).session;
const answer=(s,g,final_text='Synthetic answer',response_status='valid')=>op(s,g,'answer',{question_id:s.current,response_status,final_text,input_mode:s.mode});
const decide=(s,g,action='advance',extra={})=>op(s,g,'decision',{task_id:s.task.id,input_content_revision:s.content_revision,action,...extra});
const fixture=(draft=detonationDraft)=>{const g=customGuide(draft,'synthetic',env);return {g,s:createSession(g,consent,{origin:'demo_fixture'},env)};};
const atMoment=()=>{let {g,s}=fixture();s=decide(answer(s,g,'A friend invited me.'),g);return {g,s:answer(s,g,'Matchmaking was bad; everyone was unskilled.')};};
const probe=(s,g)=>decide(s,g,'probe',{theme_id:s.task.theme_id,question_text:'Can you describe a specific moment from that session?'});

test('historical v2 is four fixed questions and two probes reallocated explicitly to T2/T3',()=>{
 const {g,s}=fixture();assert.equal(g.routing_policy,routingPolicies.immediate);assert.equal(s.routing_policy,g.routing_policy);assert.equal(s.phase,'interleaved');assert.equal(g.themes.length,4);assert.deepEqual(g.themes.map(t=>t.budget),[0,1,1,0]);assert.equal(legacyDetonationDraft.questions.length,7);assert.deepEqual(legacyDetonationDraft.questions.map(q=>q.followup_limit),[0,0,1,0,0,1,0]);
});
test('current answer gets its probe immediately with exact question/answer/decision linkage',()=>{
 let {g,s}=atMoment();const task=s.task,parent=current(s),before=s.answers.at(-1);s=probe(s,g);const q=current(s);
 assert.equal(q.kind,'probe');assert.equal(q.theme_id,'T2');assert.equal(q.parent_question_id,parent.id);assert.equal(q.trigger_question_id,before.question_id);assert.equal(q.decision_id,task.id);assert.equal(q.guide_id,g.id);assert.equal(s.used.T2,1);assert.equal(s.questions.filter(q=>q.kind==='fixed').length,2);
 s=answer(s,g,'Synthetic: yesterday I held the site alone while two teammates went elsewhere.');assert.equal(s.answers.at(-1).question_id,q.id);assert.equal(validateSpan(sourceSpan(s,s.answers.at(-1)),[s],env.now()),true);
 assert.throws(()=>probe(s,g),/BUDGET_OR_THEME/);s=decide(s,g);assert.equal(current(s).fixed_question_id,'F3');assert.equal(exportSession(s).routing_policy,routingPolicies.immediate);
});
test('sufficient answers advance with no mandatory probes and no final exploration pass',()=>{
 let {g,s}=fixture();while(s.status==='active'){s=answer(s,g,'A concrete synthetic experience and reason.');s=decide(s,g);}
 assert.equal(s.end_reason,'completed');assert.equal(s.questions.length,4);assert.deepEqual(s.used,{T1:0,T2:0,T3:0,T4:0});
});
test('both default probes produce six questions, fixed texts/order unchanged',()=>{
 let {g,s}=fixture();while(s.status==='active'){s=answer(s,g);if(probeAllowance(s,g).allowed){s=decide(s,g,'probe',{theme_id:s.task.theme_id,question_text:'Synthetic detail for '+s.task.theme_id+'?'});s=answer(s,g);}s=decide(s,g);}
 assert.deepEqual(s.questions.map(q=>q.kind==='fixed'?q.fixed_question_id:q.theme_id+' probe'),['F1','F2','T2 probe','F3','T3 probe','F4']);assert.equal(s.questions.length,6);assert.deepEqual(s.questions.filter(q=>q.kind==='fixed').map(q=>q.actual_text),g.themes.map(t=>t.text));
});
test('custom 1..9 fixed and multiple probes remain supported, reserving space for all main questions',()=>{
 for(let fixed=1;fixed<=9;fixed++)for(const mode of ['text','voice']){
  const d={...detonationDraft,questions:Array.from({length:fixed},(_,i)=>({text:i===0?'Rate this experience from 1 to 5.':`Fixed ${i+1}?`,allow_followups:i===0&&fixed<9,followup_limit:i===0?Math.min(2,9-fixed):0}))};
  let {g,s}=fixture(d);s=op(s,g,'switch_mode',{mode});while(s.status==='active'){s=answer(s,g);s=probeAllowance(s,g).allowed?decide(s,g,'probe',{theme_id:s.task.theme_id,question_text:'Specific detail '+s.questions.length+'?'}):decide(s,g);}
  assert.equal(s.questions.length,fixed+Math.min(2,9-fixed));assert.deepEqual(s.questions.filter(q=>q.kind==='fixed').map(q=>q.actual_text),g.themes.map(t=>t.text));assert.equal(s.questions[0].actual_text,'Rate this experience from 1 to 5.');
 }
});
test('zero allowance, wrong topic, duplicate question and exhausted global space reject',()=>{
 let {g,s}=fixture();s=answer(s,g);assert.throws(()=>probe(s,g),/BUDGET_OR_THEME/);({g,s}=atMoment());assert.throws(()=>decide(s,g,'probe',{theme_id:'T3',question_text:'Wrong topic?'}),/BUDGET_OR_THEME/);assert.throws(()=>decide(s,g,'probe',{theme_id:'T2',question_text:current(s).actual_text}),/INVALID_QUESTION/);
 const full={...s,questions:[...s.questions,...Array.from({length:5},(_,i)=>({id:'q'+i,kind:'probe'}))]};assert.equal(probeAllowance(full,g).allowed,false);
});
for(const status of ['skipped','refused','unrecognizable','technical_failure'])test(`${status} closes current topic without paraphrase`,()=>{
 let {g,s}=fixture();s=decide(answer(s,g),g);s=answer(s,g,'',status);assert.equal(current(s).fixed_question_id,'F3');assert.equal(s.task,null);assert.equal(s.used.T2,0);assert.equal(s.blocked.includes('T2'),status==='refused');
});
for(const control of ['end','withdraw','pause','skip_topic','correct'])test(`${control} makes an in-flight probe stale`,()=>{
 let {g,s}=atMoment();const task=s.task;s=op(s,g,control,control==='correct'?{answer_id:s.answers.at(-1).id,answer_revision:1,final_text:'Corrected synthetic answer',reason:'Correction'}:{});
 assert.throws(()=>op(s,g,'decision',{task_id:task.id,input_content_revision:task.input_content_revision,action:'probe',theme_id:'T2',question_text:'Late?'}),/STALE_TASK|TERMINATED|WITHDRAWN/);assert.equal(s.used.T2,0);
 if(control==='skip_topic'){assert.equal(current(s).fixed_question_id,'F3');assert.ok(s.blocked.includes('T2'));}
 if(control==='pause'){s=op(s,g,'resume');assert.equal(s.task,null);s=op(s,g,'continue');assert.equal(current(s).fixed_question_id,'F3');}
});
test('skip topic while awaiting answer advances immediately and invalidates current question',()=>{
 let {g,s}=fixture();const old=s.current;s=op(s,g,'skip_topic');assert.equal(current(s).fixed_question_id,'F2');assert.ok(s.blocked.includes('T1'));assert.throws(()=>op(s,g,'answer',{question_id:old,response_status:'valid',final_text:'Late',input_mode:'text'}),/QUESTION_CONFLICT/);
});
test('semantic refusal/end decisions work on main and probe answers',()=>{
 for(const fromProbe of [false,true])for(const action of ['refuse_topic','end_requested','pause_requested']){let {g,s}=atMoment();if(fromProbe)s=answer(probe(s,g),g);s=decide(s,g,action);if(action==='refuse_topic'){assert.equal(current(s).fixed_question_id,'F3');assert.ok(s.blocked.includes('T2'));}else assert.equal(s.status,action==='end_requested'?'ended':'paused');}
});
test('answer and decision replay are idempotent and competing writes conflict',()=>{
 let {g,s}=fixture();const a={request_id:'repeat-answer',expected_version:s.state_version,type:'answer',question_id:s.current,response_status:'valid',final_text:'Synthetic',input_mode:'text'};s=transition(s,g,a,env).session;assert.equal(transition(s,g,a,env).replayed,true);assert.equal(s.answers.length,1);assert.throws(()=>transition(s,g,{...a,final_text:'Changed'},env),/IDEMPOTENCY_MISMATCH/);
 ({g,s}=atMoment());const d={request_id:'repeat-decision',expected_version:s.state_version,type:'decision',task_id:s.task.id,input_content_revision:s.content_revision,action:'probe',theme_id:'T2',question_text:'A concrete moment?'};const result=transition(s,g,d,env);assert.equal(transition(result.session,g,d,env).replayed,true);assert.equal(result.session.used.T2,1);assert.throws(()=>transition(result.session,g,{...d,request_id:'competing'},env),/STATE_CONFLICT/);assert.equal(s.used.T2,0);
});
test('legacy seven-question guide/session retains fixed-first on recovery and explicit old-guide creation',()=>{
 const g=customGuide(legacyDetonationDraft,'old',env);delete g.routing_policy;let s=createSession(g,consent,{},env);delete s.routing_policy;const before=JSON.stringify(g);
 for(let i=0;i<7;i++){s=answer(s,g);assert.throws(()=>probe(s,g),/FIXED_BLOCK/);s=decide(s,g);}
 assert.equal(s.phase,'exploration');assert.equal(s.task.theme_id,'T3');s=decide(s,g,'probe',{theme_id:'T3',question_text:'Legacy deferred detail?'});assert.equal(current(s).parent_question_id,s.questions[2].id);assert.equal(current(s).trigger_question_id,s.questions[6].id);assert.equal(JSON.stringify(g),before);
 const fresh=createSession(g,consent,{},env);assert.equal(fresh.routing_policy,routingPolicies.legacy);assert.equal(fresh.phase,'fixed');
});
test('missing session policy is never upgraded from a guide; unknown guide policy rejects',()=>{
 let {g,s}=fixture();delete s.routing_policy;s.phase='fixed';s=answer(s,g);assert.throws(()=>probe(s,g),/FIXED_BLOCK/);assert.throws(()=>createSession({...g,routing_policy:'future-unknown'},consent,{},env),/INVALID_ROUTING_POLICY/);
});
