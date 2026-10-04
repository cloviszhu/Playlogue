import test from 'node:test';
import assert from 'node:assert/strict';
import {builtinDefaultGuide,builtinFirstSessionGuide,firstSessionGuideId} from '../shared/default-guide.mjs';
import {gameplayCaseKey,gameplayExample,detonationDraft} from '../shared/detonation-case.mjs';
import {createSession,transition,limits} from '../shared/session.mjs';
import {probeAllowance,totalProbeBudget} from '../shared/routing.mjs';
import {sourceSpan} from '../shared/evidence.mjs';
import {api,Repository,sha256,decisionInput,validateDecision,analysisInput,validateAnalysis} from '../work/test-api.mjs';
import {localD1} from './sqlite-d1.mjs';
const consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};
let serial=0;const env={id:()=>`gameplay-test-${++serial}`,now:()=>Date.parse('2026-10-04T11:00:00Z')};
const op=(s,g,type,extra={})=>transition(s,g,{request_id:env.id(),expected_version:s.state_version,type,...extra},env).session;
const answer=(s,g)=>op(s,g,'answer',{question_id:s.current,response_status:'valid',input_mode:s.mode,final_text:'Synthetic specific experience '+s.questions.length});
const decide=(s,g,probe=false)=>op(s,g,'decision',{task_id:s.task.id,input_content_revision:s.content_revision,action:probe?'probe':'advance',theme_id:probe?s.task.theme_id:null,question_text:probe?'What happened in that specific '+s.task.theme_id+' example?':null});

test('v3 exact three topics and independent two-probe ceiling preserve per-call limits',()=>{
 const g=builtinDefaultGuide();assert.equal(g.research_case,gameplayCaseKey);assert.equal(g.version,3);
 assert.deepEqual(g.themes.map(t=>t.text),['How do you feel about the map design in Detonation?','How balanced do the operators feel in Detonation?','How does the weapon customization and purchasing economy affect your choices in Detonation?']);
 assert.deepEqual(g.themes.map(t=>t.budget),[1,1,1]);assert.equal(totalProbeBudget(g),2);assert.equal(g.themes.length+totalProbeBudget(g),5);
 assert.equal(limits.decision,12);assert.equal(limits.analysis,2);assert.equal(limits.cross_sessions,10);
 assert.doesNotMatch(g.goal,/first-session experience|next actual game choice/);
});
for(const topics of [['T1','T2'],['T1','T3'],['T2','T3'],[]])test('v3 immediate probe combination '+topics.join('+')+' stays within five questions',()=>{
 const g=builtinDefaultGuide();let s=createSession(g,consent,{origin:'demo_fixture'},env);
 while(s.status==='active'){
  const q=s.questions.find(q=>q.id===s.current);s=answer(s,g);
  if(q.kind==='fixed'&&topics.includes(q.theme_id)){
   assert.equal(probeAllowance(s,g).allowed,true);const value={action:'probe',theme_id:q.theme_id,question_text:'What happened in that specific '+q.theme_id+' example?',reason:'Synthetic gap'};validateDecision(value,s,g);
   const parent=q.id;s=decide(s,g,true);assert.equal(s.questions.at(-1).parent_question_id,parent);assert.equal(s.questions.at(-1).theme_id,q.theme_id);s=answer(s,g);
   assert.equal(probeAllowance(s,g).allowed,false);assert.throws(()=>decide(s,g,true),/BUDGET_OR_THEME/);
  }else if(q.kind==='fixed'&&topics.length===2&&Object.values(s.used).reduce((a,b)=>a+b,0)===2){
   assert.equal(probeAllowance(s,g).total_remaining,0);assert.throws(()=>validateDecision({action:'probe',theme_id:q.theme_id,question_text:'Extra?',reason:'Synthetic'},s,g),/INVALID_PROBE/);
  }
  s=decide(s,g);
 }
 assert.equal(s.questions.length,3+topics.length);assert.deepEqual(s.questions.filter(q=>q.kind==='fixed').map(q=>q.actual_text),g.themes.map(t=>t.text));
 assert.deepEqual(s.questions.filter(q=>q.kind==='probe').map(q=>q.theme_id),topics);
 const input=JSON.parse(analysisInput([s]));assert.match(input.instruction,/map design, perceived operator balance/);assert.doesNotMatch(input.instruction,/For Detonation first-session accounts/);
 assert.deepEqual(input.sessions[0].answers.map(a=>a.text),s.answers.map(a=>a.final_text));
 const span=sourceSpan(s,s.answers[0]);assert.equal(validateAnalysis({findings:[{id:'map',claim:'Synthetic',theme_ids:['T1'],supporting_spans:[span],counter_spans:[],unknowns:['Synthetic only']}]},[s]).findings.length,1);
});
test('v3 moderator allows a map probe and preserves absence/neutrality without first-session policy',()=>{
 const g=builtinDefaultGuide();const s=answer(createSession(g,consent,{origin:'demo_fixture'},env),g);const input=JSON.parse(decisionInput(s,g));
 assert.equal(input.current_theme,'T1');assert.equal(input.probe_allowance.allowed,true);assert.equal(input.probe_allowance.total_remaining,2);
 assert.match(input.instruction,/Never invent map features/);assert.match(input.instruction,/cannot remember or declines/);assert.doesNotMatch(input.instruction,/This is first-session qualitative research/);
});
test('v3 fictional example has all three topics and canonical supporting/counter spans',()=>{
 const ex=gameplayExample();assert.equal(ex.guide.research_case,gameplayCaseKey);assert.equal(ex.guide.themes.length,3);assert.equal(ex.source_sessions.length,2);
 assert.equal(validateAnalysis({findings:ex.findings},ex.source_sessions).findings.length,3);assert.ok(ex.findings[0].counter_spans.length);
});
test('saved v2 public practice recovers and reads its analysis unchanged alongside v3',async()=>{
 const DB=localD1(),repo=new Repository(DB),token='V'.repeat(43),origin='https://synthetic.example';
 const settings={DB,APP_ORIGIN:origin,AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'owner',PUBLIC_DEMO_ENABLED:'true'};
 const read=async(url,cap=token)=>{const r=await api(new Request(origin+url,{headers:{Authorization:'Bearer '+cap}}),settings);return {status:r.status,data:await r.json()};};
 try{
  const g=builtinFirstSessionGuide();assert.equal(g.id,firstSessionGuideId);assert.equal(g.themes.length,4);assert.deepEqual(g.themes.map(t=>t.text),detonationDraft.questions.map(q=>q.text));assert.equal(g.session_probe_limit,undefined);assert.equal(totalProbeBudget(g),2);
  let s=await repo.create(g,consent,'demo_live','text',await sha256(token),'old-public','synthetic',true);const guideBefore=JSON.stringify(await repo.guide(g.id));
  s=(await repo.mutate(s,g,{type:'answer',request_id:'a',expected_version:s.state_version,question_id:s.current,response_status:'valid',input_mode:'text',final_text:'An existing fictional first-session trigger.'})).session;
  s=(await repo.mutate(s,g,{type:'end',request_id:'end',expected_version:s.state_version})).session;
  const before=JSON.stringify((await repo.get(s.id)).session),budget=JSON.stringify(await repo.budget());
  const restored=await read('/api/sessions/'+s.id);assert.equal(restored.status,200);assert.equal(restored.data.guide.id,g.id);assert.equal(restored.data.guide.themes.length,4);
  assert.equal((await read('/api/public/study')).data.guide.id,builtinDefaultGuide().id);assert.equal((await read('/api/public/study?guide_id='+g.id)).data.guide.id,g.id);
  assert.equal((await read('/api/sessions/'+s.id+'/analysis')).status,200);assert.equal((await read('/api/sessions/'+s.id,'X'.repeat(43))).status,404);
  assert.equal(JSON.stringify((await repo.get(s.id)).session),before);assert.equal(JSON.stringify(await repo.guide(g.id)),guideBefore);assert.equal(JSON.stringify(await repo.budget()),budget);assert.equal(await repo.providerAttemptCount(),0);
  assert.match(JSON.parse(analysisInput([s])).instruction,/For Detonation first-session accounts/);
 }finally{DB.close();}
});
