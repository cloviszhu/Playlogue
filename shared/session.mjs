import {routingPolicies,routingPolicy,immediateRouting,probeAllowance} from './routing.mjs';
const copy = x => structuredClone(x);
const fail = code => { throw Object.assign(new Error(code), {code}); };
const canonical = x => Array.isArray(x) ? `[${x.map(canonical)}]` : x && typeof x === 'object' ? `{${Object.keys(x).sort().map(k => JSON.stringify(k)+':'+canonical(x[k])).join(',')}}` : JSON.stringify(x);
export const models = Object.freeze({decision:'gpt-6.1-sol', analysis:'gpt-6.1-sol', stt:'gpt-transcribe', tts:'gpt-4o-mini-tts-2025-12-15', voice:'coral'});
export const limits = Object.freeze({live_enabled:false, concurrency:2, daily_sessions:20, decision:12, stt:12, tts:20, analysis:2, cross_sessions:10, cross_daily:10, audio_seconds:90, audio_bytes:8*1024*1024, stt_seconds:600, answer_chars:1500, exposure_events:200, aggregate_bytes:256*1024, retention_days:7, cutoff:'2026-10-04T16:00:00Z'});
export const draft = {title:'Delta Force — Heichao Baopo play experience', goal:'Understand decisions, equipment choices and factors influencing whether to play again.', game:'Delta Force', platform:'PC', region:'China server', mode:'Heichao Baopo (黑潮爆破)', game_build:'UNKNOWN', language:'en', themes:[{id:'T1',fixed_id:'F1',name:'Decision clarity',text:'Think about one recent round of this mode. How did you decide what to do next?',budget:2},{id:'T2',fixed_id:'F2',name:'Equipment decisions',text:'Tell me about an equipment decision you made in that round.',budget:2},{id:'T3',fixed_id:'F3',name:'Return intention',text:'What would influence whether you play this mode again?',budget:2}]};
const defaults = {id:()=>crypto.randomUUID(), now:()=>Date.now()};
export function publish(input, version=1, env=defaults) {
  if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>120||typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>1000||typeof input.game_build!=='string'||!input.game_build.trim()||input.game_build.length>120||input.game!==draft.game||input.platform!==draft.platform||input.region!==draft.region||input.mode!==draft.mode||input.language!=='en')fail('INVALID_GUIDE');
  if(input.themes?.length!==3 || input.themes.some((t,i)=>t.id!==`T${i+1}` || t.fixed_id!==`F${i+1}` || t.text!==draft.themes[i].text || !Number.isInteger(t.budget) || t.budget<0 || t.budget>2)) fail('INVALID_GUIDE');
  return {...copy(input),routing_policy:routingPolicies.legacy,id:env.id(),version,published_at:new Date(env.now()).toISOString()};
}
function question(s,g,t,kind,text,env) {
  if(s.questions.length>=9) fail('QUESTION_LIMIT');
  const previous=s.questions.filter(q=>q.theme_id===t.id).at(-1);
  const q={id:env.id(),guide_id:g.id,theme_id:t.id,kind,actual_text:text,sequence:s.questions.length+1,created_at:new Date(env.now()).toISOString(),...(kind==='fixed'?{fixed_question_id:t.fixed_id}:{parent_question_id:previous.id,trigger_question_id:s.answers.at(-1)?.question_id,decision_id:s.task.id})};
  s.questions.push(q); s.current=q.id; s.step='awaiting_answer'; s.task=null; s.content_revision++; s.evidence_revision++;
}
export function createSession(g, consent, {origin='demo_live',mode='text'}={}, env=defaults) {
  if(!consent || consent.adult_confirmed!==true || consent.research_agreed!==true || consent.cloud_agreed!==true) fail('CONSENT_REQUIRED');
  if(!['demo_live','demo_fixture','real_self_report'].includes(origin)||!['text','voice'].includes(mode)) fail('INVALID_INPUT');
  if(!Object.values(routingPolicies).includes(routingPolicy(g)))fail('INVALID_ROUTING_POLICY');
  const s={id:env.id(),guide_id:g.id,origin,status:'active',phase:'fixed',step:'awaiting_answer',state_version:0,content_revision:0,evidence_revision:0,created_at:new Date(env.now()).toISOString(),expires_at:new Date(env.now()+7*86400000).toISOString(),consent:{adult_confirmed:true,research_agreed:true,cloud_agreed:true,version:'consent-1',accepted_at:new Date(env.now()).toISOString()},mode,media_generation:0,initial_mode:mode,mode_history:[mode],questions:[],answers:[],exposures:[],blocked:[],used:g.kind==='custom'?Object.fromEntries(g.themes.map(t=>[t.id,0])):{T1:0,T2:0,T3:0},cursor:0,receipts:[],task:null,current:null};
  s.routing_policy=routingPolicy(g);if(immediateRouting(s))s.phase='interleaved';
  if(g.kind==='custom')s.topic_ids=g.themes.map(t=>t.id);if(g.research_case)s.research_case=g.research_case;
  question(s,g,g.themes[0],'fixed',g.themes[0].text,env); return s;
}
export function current(s){return s.questions.find(q=>q.id===s.current);}
function finish(s,reason){s.status='ended';s.end_reason=reason;s.current=null;s.task=null;s.step='ready_to_finish';}
function prepareExplore(s,g,env){
  while(s.cursor<g.themes.length && (s.blocked.includes(g.themes[s.cursor].id)||s.used[g.themes[s.cursor].id]>=g.themes[s.cursor].budget))s.cursor++;
  if(s.cursor>=g.themes.length){finish(s,'completed');return;}
  const theme=g.themes[s.cursor];s.step='deciding';s.task={id:env.id(),phase:'exploration',theme_id:theme.id,input_content_revision:s.content_revision,trigger_question_id:s.answers.at(-1)?.question_id};
}
function advance(s,g,env){
  if(immediateRouting(s)){
    s.cursor++;
    if(s.cursor>=g.themes.length){finish(s,'completed');return;}
    const t=g.themes[s.cursor];question(s,g,t,'fixed',t.text,env);return;
  }
  if(s.phase==='fixed'){
    if(s.questions.length<(g.kind==='custom'?g.themes.length:3)){const t=g.themes[s.questions.length];question(s,g,t,'fixed',t.text,env);return;}
    s.phase='exploration';s.cursor=0;
  }
  prepareExplore(s,g,env);
}
export function transition(original,g,command,env=defaults){
  if(original.guide_id!==g.id)fail('GUIDE_MISMATCH');
  if(!command.request_id || !Number.isInteger(command.expected_version))fail('INVALID_REQUEST');
  const payload=copy(command);delete payload.expected_version; const hash=canonical(payload);
  const seen=original.receipts.find(r=>r.id===command.request_id);
  if(seen){if(seen.payload!==hash)fail('IDEMPOTENCY_MISMATCH');return {session:copy(original),replayed:true,receipt:copy(seen)};}
  if(original.state_version!==command.expected_version)fail('STATE_CONFLICT');
  if(Date.parse(original.expires_at)<=env.now()&&command.type!=='withdraw')fail('EXPIRED');
  const s=copy(original),a=command,live=()=>{if(s.status!=='active')fail('TERMINATED');};
  if(s.status==='withdrawn') { if(a.type!=='withdraw')fail('WITHDRAWN'); }
  if(a.type==='answer'){
    live();if(s.step!=='awaiting_answer'||s.current!==a.question_id)fail('QUESTION_CONFLICT');
    if(!['valid','skipped','refused','unrecognizable','technical_failure'].includes(a.response_status)||!['text','voice'].includes(a.input_mode)||a.input_mode!==s.mode)fail('INVALID_INPUT');
    const txt=String(a.final_text??'').trim();if(txt.length>1500||(a.response_status==='valid'&&!txt))fail('INVALID_ANSWER');
    const q=current(s);s.answers.push({id:env.id(),question_id:q.id,revision:1,final_text:a.response_status==='valid'?txt:'',response_status:a.response_status,input_mode:a.input_mode,transcript_source_task_id:a.transcript_source_task_id||null,edited_transcript:!!a.edited_transcript,submitted_at:new Date(env.now()).toISOString(),history:[]});
    if(a.response_status==='refused'&&!s.blocked.includes(q.theme_id))s.blocked.push(q.theme_id);
    s.content_revision++;s.evidence_revision++;
    if(a.response_status==='valid'){s.step='deciding';s.task={id:env.id(),phase:s.phase,theme_id:immediateRouting(s)||s.phase==='fixed'?q.theme_id:g.themes[s.cursor].id,input_content_revision:s.content_revision,trigger_question_id:q.id};}else advance(s,g,env);
  }else if(a.type==='decision'){
    live();if(!s.task||s.task.id!==a.task_id||s.task.input_content_revision!==a.input_content_revision||s.content_revision!==a.input_content_revision)fail('STALE_TASK');
    if(!['probe','advance','pause_requested','refuse_topic','end_requested'].includes(a.action))fail('INVALID_DECISION');
    if(a.action==='end_requested')finish(s,'participant_end');
    else if(a.action==='pause_requested'){s.status='paused';s.task=null;}
    else if(a.action==='refuse_topic'){if(!s.blocked.includes(s.task.theme_id))s.blocked.push(s.task.theme_id);s.task=null;if(!immediateRouting(s)&&s.phase==='exploration')s.cursor++;advance(s,g,env);}
    else if(immediateRouting(s)){
      if(a.action==='probe'){
        const t=g.themes[s.cursor];if(!probeAllowance(s,g).allowed||a.theme_id!==t.id)fail('BUDGET_OR_THEME');
        if(typeof a.question_text!=='string'||!a.question_text.trim()||a.question_text.length>400||s.questions.some(q=>q.actual_text===a.question_text.trim()))fail('INVALID_QUESTION');
        question(s,g,t,'probe',a.question_text.trim(),env);s.used[t.id]++;
      }else {s.task=null;advance(s,g,env);}
    }
    else if(s.phase==='fixed'){if(a.action==='probe')fail('FIXED_BLOCK');s.task=null;advance(s,g,env);}
    else if(a.action==='probe'){
      const t=g.themes[s.cursor];if(a.theme_id!==t.id||s.blocked.includes(t.id)||s.used[t.id]>=t.budget)fail('BUDGET_OR_THEME');
      if(typeof a.question_text!=='string'||!a.question_text.trim()||a.question_text.length>400)fail('INVALID_QUESTION');
      question(s,g,t,'probe',a.question_text.trim(),env);s.used[t.id]++;
    }else {s.task=null;s.cursor++;prepareExplore(s,g,env);}
  }else if(a.type==='continue'){
    live();if(s.step!=='deciding')fail('INVALID_STATE');s.task=null;if(!immediateRouting(s)&&s.phase==='exploration'){finish(s,'completed');}else advance(s,g,env);
  }else if(a.type==='pause'){live();s.status='paused';s.task=null;
  }else if(a.type==='resume'){if(s.status!=='paused')fail('INVALID_STATE');s.status='active';if(s.step==='deciding'){s.task=null;} // Explicit Continue resolves interrupted decision; never resends automatically.
  }else if(a.type==='end'){if(!['active','paused','ended'].includes(s.status))fail('TERMINATED');finish(s,'participant_end');
  }else if(a.type==='skip_topic'){live();const t=s.phase==='exploration'?g.themes[s.cursor]?.id:current(s)?.theme_id;if(!t)fail('INVALID_STATE');if(!s.blocked.includes(t))s.blocked.push(t);if(immediateRouting(s)){s.task=null;advance(s,g,env);}else if(s.phase==='exploration'&&s.step==='deciding'){s.cursor++;prepareExplore(s,g,env);}
  }else if(a.type==='switch_mode'){live();if(!['text','voice'].includes(a.mode))fail('INVALID_INPUT');if(s.mode!==a.mode){s.mode=a.mode;s.mode_history.push(a.mode);s.evidence_revision++;}
  }else if(a.type==='exposure'){
    live();if(!s.questions.some(q=>q.id===a.question_id)||!['text','audio'].includes(a.channel)||!['start','partial','full','failed'].includes(a.state)||!a.attempt_id)fail('INVALID_EXPOSURE');
    const duplicate=s.exposures.some(e=>e.question_id===a.question_id&&e.channel===a.channel&&e.attempt_id===a.attempt_id&&e.state===a.state);
    if(!duplicate){if(s.exposures.length>=200)fail('EXPOSURE_LIMIT');s.exposures.push({question_id:a.question_id,channel:a.channel,state:a.state,attempt_id:a.attempt_id,request_id:a.request_id});s.evidence_revision++;}
  }else if(a.type==='correct'){
    if(!['active','paused','ended'].includes(s.status))fail('TERMINATED');const answer=s.answers.find(x=>x.id===a.answer_id);
    if(!answer||answer.revision!==a.answer_revision)fail('ANSWER_CONFLICT');if(typeof a.final_text!=='string'||!a.final_text.trim()||a.final_text.length>1500||!a.reason?.trim()||answer.response_status!=='valid')fail('INVALID_ANSWER');
    answer.history.push({revision:answer.revision,final_text:answer.final_text,correction_reason:a.reason});answer.final_text=a.final_text.trim();answer.revision++;s.content_revision++;s.evidence_revision++;s.task=null;
  }else if(a.type==='withdraw'){
    s.status='withdrawn';s.questions=[];s.answers=[];s.exposures=[];s.receipts=[];s.task=null;s.current=null;s.consent={version:s.consent?.version||'consent-1',withdrawn_at:new Date(env.now()).toISOString()};s.content_revision++;s.evidence_revision++;
  }else fail('INVALID_OPERATION');
  if(['pause','end','withdraw','switch_mode','skip_topic'].includes(a.type)||a.type==='decision'&&['pause_requested','end_requested'].includes(a.action))s.media_generation=(s.media_generation||0)+1;
  s.state_version++; const receipt={id:a.request_id,payload:hash,result_version:s.state_version};
  // Never retain submitted text in receipts after withdrawal.
  s.receipts.push(receipt);if(new TextEncoder().encode(JSON.stringify(s)).length>limits.aggregate_bytes)fail('AGGREGATE_LIMIT');
  return {session:s,replayed:false,receipt};
}
export function modeGroup(s){const modes=new Set(s.answers.map(a=>a.input_mode));return modes.size===0?'no_answers':modes.size>1?'mixed':modes.has('voice')?'voice_only':'text_only';}
export function eligibilityGroup(s){const actual=modeGroup(s);if(actual!=='no_answers')return actual;const declared=s.initial_mode||s.mode_history?.[0];const unchanged=Array.isArray(s.mode_history)&&s.mode_history.every(mode=>mode===declared);return unchanged&&['text','voice'].includes(declared)?declared+'_only':'no_answers';}
export function readable(s,now=Date.now()){return s.status!=='withdrawn'&&s.status!=='expired'&&Date.parse(s.expires_at)>now;}
