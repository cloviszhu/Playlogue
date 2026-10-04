import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnalysis,Repository,sha256} from '../work/test-api.mjs';
import {validateSpan,sourceSpan} from '../shared/evidence.mjs';
import {builtinDefaultGuide} from '../shared/default-guide.mjs';
import {localD1} from './sqlite-d1.mjs';
const source=(text='A map moment: I chose the left route.')=>({id:'span-session',guide_id:'synthetic-guide',origin:'demo_fixture',status:'ended',expires_at:'2099-01-01T00:00:00Z',content_revision:6,topic_ids:['T1','T2','T3'],questions:[{id:'span-question',theme_id:'T1'}],answers:[{id:'span-answer',question_id:'span-question',revision:2,response_status:'valid',final_text:text}]});
const output=(span,counter=[])=>({findings:[{id:'span-finding',claim:'Synthetic candidate',theme_ids:['T1'],supporting_spans:[span],counter_spans:counter,unknowns:['Synthetic only']}]});
const wrong=(s,quote)=>({...sourceSpan(s,s.answers[0]),start_utf16:0,end_utf16:1,exact_quote:quote});
test('unique exact quote repairs integer offsets without changing quote, IDs or revisions',()=>{
 const s=source(),span=wrong(s,'I chose the left route.'),input=output(span),before=JSON.stringify(input);assert.equal(validateSpan(span,[s]),false);
 const fixed=validateAnalysis(input,[s]).findings[0].supporting_spans[0];assert.equal(fixed.start_utf16,14);assert.equal(fixed.end_utf16,s.answers[0].final_text.length);assert.equal(validateSpan(fixed,[s]),true);
 for(const key of Object.keys(span).filter(k=>!['start_utf16','end_utf16'].includes(k)))assert.equal(fixed[key],span[key]);assert.equal(JSON.stringify(input),before);
});
test('UTF-16 coordinates account for emoji before and inside an exact quote',()=>{
 const s=source('🎮 Intro: 地图 🧭 felt clear.'),quote='地图 🧭 felt clear.';const fixed=validateAnalysis(output(wrong(s,quote)),[s]).findings[0].supporting_spans[0];assert.equal(fixed.start_utf16,10);assert.equal(fixed.end_utf16,s.answers[0].final_text.length);assert.equal(validateSpan(fixed,[s]),true);
 assert.throws(()=>validateAnalysis(output(wrong(s,'\uD83C')),[s]),/INVALID_SOURCE_SPAN/);
});
test('duplicate and overlapping occurrences cannot repair wrong offsets; valid disambiguating offsets stay valid',()=>{
 for(const [text,quote]of [['left route, then left route','left route'],['banana','ana']]){const s=source(text);assert.throws(()=>validateAnalysis(output(wrong(s,quote)),[s]),/INVALID_SOURCE_SPAN/);const start=text.lastIndexOf(quote),span=sourceSpan(s,s.answers[0],start,start+quote.length);assert.deepEqual(validateAnalysis(output(span),[s]).findings[0].supporting_spans[0],span);}
});
test('no fuzzy matching, rewriting, whitespace/case/Unicode normalization or cross-answer quote search',()=>{
 const s=source('Café felt clear.');for(const quote of ['Cafe felt clear.','CAFÉ felt clear.','Café  felt clear.','Cafe\u0301 felt clear.','Invented quote'])assert.throws(()=>validateAnalysis(output(wrong(s,quote)),[s]),/INVALID_SOURCE_SPAN/);
 s.answers.push({id:'other-answer',question_id:'other-question',revision:2,response_status:'valid',final_text:'Only in the other answer'});assert.throws(()=>validateAnalysis(output(wrong(s,'Only in the other answer')),[s]),/INVALID_SOURCE_SPAN/);
});
test('wrong identity/revisions, stale/unreadable sources and malformed offsets still reject',()=>{
 const s=source(),span=wrong(s,'I chose the left route.');
 for(const changed of [{session_id:'foreign'},{answer_id:'foreign'},{question_id:'foreign'},{answer_revision:1},{input_content_revision:5},{start_utf16:'0'},{end_utf16:1.5},{exact_quote:''}])assert.throws(()=>validateAnalysis(output({...span,...changed}),[s]));
 for(const changed of [{status:'withdrawn'},{status:'expired'},{expires_at:'2000-01-01T00:00:00Z'},{answers:[{...s.answers[0],response_status:'skipped'}]}])assert.throws(()=>validateAnalysis(output(span),[{...s,...changed}]),/INVALID_SOURCE_SPAN/);
});
test('supporting and counter spans normalize independently within their own cross-session sources',()=>{
 const a=source(),b=source('Another map moment: the right route.');b.id='counter-session';b.answers[0].id='counter-answer';
 const fixed=validateAnalysis(output(wrong(a,'I chose the left route.'),[wrong(b,'the right route.')]),[a,b]).findings[0];assert.equal(validateSpan(fixed.supporting_spans[0],[a,b]),true);assert.equal(validateSpan(fixed.counter_spans[0],[a,b]),true);
 assert.throws(()=>validateAnalysis(output(wrong(a,'I chose the left route.'),[wrong(b,'invented counterevidence')]),[a,b]),/INVALID_SOURCE_SPAN/);
});
test('canonical repaired span persists through strict repository validation with no provider or source mutation',async()=>{
 const DB=localD1(),repo=new Repository(DB),g=builtinDefaultGuide();try{
  const consent={adult_confirmed:true,research_agreed:true,cloud_agreed:true};let s=await repo.create(g,consent,'demo_fixture','text',await sha256('Z'.repeat(43)),'normalization-fixture','synthetic-only');
  s=(await repo.mutate(s,g,{type:'answer',request_id:'answer',expected_version:0,question_id:s.current,response_status:'valid',input_mode:'text',final_text:'🎮 Synthetic: the route felt clear.'})).session;
  const before=JSON.stringify(s),budget=JSON.stringify(await repo.budget()),run=await repo.snapshot([s],s.id,{scope:'single',status:'awaiting_provider',request_key:'normalized-synthetic'});
  const parsed=validateAnalysis(output(wrong(s,'the route felt clear.')),[s]),saved=await repo.commitCandidates(run.id,parsed);
  assert.equal(saved.status,'ready');assert.equal(validateSpan(saved.findings[0].supporting_spans[0],[s]),true);assert.equal(JSON.stringify((await repo.get(s.id)).session),before);assert.equal(JSON.stringify(await repo.budget()),budget);assert.equal(await repo.providerAttemptCount(),0);
 }finally{DB.close();}
});
