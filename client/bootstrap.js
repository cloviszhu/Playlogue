import {createHttpAdapter,createDemoAdapter} from './adapter.js';
import {createCapabilityStore} from './capabilities.js';
import {createVoiceAdapter} from './voice-adapter.js';
const query=new URLSearchParams(location.search),local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
// Hosted default is API. Demo is an explicit mode; loopback is the local demo harness.
const store=createCapabilityStore(sessionStorage);
const fragment=location.hash;
if(/(?:^#|&)cap=/.test(fragment))history.replaceState(null,'',location.pathname+location.search);
const recovered=store.importFragment(fragment);
if(recovered){sessionStorage.setItem('playlogue.active-session',recovered);history.replaceState(null,'',location.pathname+'?adapter=api');}
const isDemo=!recovered&&(query.get('adapter')==='demo'||(local&&query.get('adapter')!=='api'));
const active=recovered||(!isDemo?sessionStorage.getItem('playlogue.active-session'):null);
if(active&&store.get(active))window.playlogueRecoveredSession=active;
// An explicit workspace or selected-study visit must not be replaced by an old interview.
window.playlogueAutoResume=!!recovered || location.hash==='#interview';
// The bare entry always asks the server for its built-in default. Old tab choices never override it.
const selectedGuide=query.get('guide_id');
if(isDemo)window.playlogueAdapter=createDemoAdapter({storage:sessionStorage});
else{
 let pending=sessionStorage.getItem('playlogue.pending-capability');
 if(!/^[A-Za-z0-9_-]{43}$/.test(pending||''))pending=null;
 const adapter=createHttpAdapter({guideId:selectedGuide,tokenFor:id=>id==='__pending_creation__'?pending:id?store.get(id):null});
 const load=adapter.loadStudy.bind(adapter);adapter.loadStudy=async()=>{const study=await load();adapter.publicDemo=study.public_demo===true;adapter.capabilities.voice=study.speech_ready===true&&study.live_enabled===true;if(adapter.capabilities.voice&&!adapter.voice)adapter.voice=createVoiceAdapter({adapter,tokenFor:id=>store.get(id),maxSeconds:study.audio_max_seconds||30});return study;};
 const list=adapter.listSessions.bind(adapter);adapter.listSessions=async()=>{try{return await list();}catch(error){if(!adapter.publicDemo||!['RESEARCHER_REQUIRED','FORBIDDEN'].includes(error.code))throw error;const own=await Promise.allSettled(store.ids().map(id=>adapter.getSession(id)));return own.filter(r=>r.status==='fulfilled'&&r.value.public_demo_version==='public-demo-v1').map(r=>r.value);}};
 const start=adapter.startSession.bind(adapter),command=adapter.command.bind(adapter);
 adapter.startSession=async body=>{if(!pending){pending=store.generate();sessionStorage.setItem('playlogue.pending-capability',pending);}const signature=JSON.stringify({...body,request_id:undefined});let attempt;try{attempt=JSON.parse(sessionStorage.getItem('playlogue.pending-create')||'null');}catch{}if(attempt?.signature!==signature){attempt={signature,request_id:body.request_id};sessionStorage.setItem('playlogue.pending-create',JSON.stringify(attempt));}const s=await start({...body,request_id:attempt.request_id});sessionStorage.removeItem('playlogue.pending-create');store.set(s.id,pending);sessionStorage.setItem('playlogue.active-session',s.id);pending=null;sessionStorage.removeItem('playlogue.pending-capability');return s;};
 const seen=new Map(),prepared=new Map();
 // This records full text presentation, not proof that the participant read or understood it.
 new MutationObserver(()=>{const f=window.playlogueFrontend,s=f?.state.session,h=document.querySelector('.question-display h1');if(!s||s.mode!=='text'||s.status!=='active'||!h||document.visibilityState!=='visible')return;const b=h.getBoundingClientRect();if(b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth)seen.set(s.id+':'+s.current,s.current);}).observe(document.getElementById('app'),{subtree:true,childList:true});
 adapter.command=async(id,c)=>{let next=prepared.get(c.request_id)||{...c};const f=window.playlogueFrontend,s=f?.state.session,key=id+':'+s?.current;
  if(!prepared.has(c.request_id)&&!['pause','end','withdraw'].includes(c.type)&&seen.has(key)&&!s.exposures?.some(e=>e.question_id===s.current&&e.channel==='text'&&e.state==='full')){const saved=await command(id,{type:'exposure',request_id:'exposure-'+s.current,expected_state_version:c.expected_state_version,question_id:s.current,channel:'text',state:'full',attempt_id:'text-'+s.current});next.expected_state_version=saved.state_version;prepared.set(c.request_id,next);seen.delete(key);}
  const result=await command(id,next);prepared.delete(c.request_id);if(c.type==='withdraw'){store.remove(id);if(sessionStorage.getItem('playlogue.active-session')===id)sessionStorage.removeItem('playlogue.active-session');}return result;};
 adapter.recoveryLink=id=>store.recoveryLink(id,location.href);
 window.playlogueAdapter=adapter;
}
await import('./app.js');

// Recovery links may change only the fragment in an already open tab. Import and
// remove the capability before awaiting any UI/network work. Keep all other keys.
window.addEventListener('hashchange', () => {
 const fragment = location.hash;
 if (!/(?:^#|&)cap=/.test(fragment)) return;
 history.replaceState(null, '', location.pathname + location.search);
 const id = store.importFragment(fragment);
 if (!id) return;
 sessionStorage.setItem('playlogue.active-session', id);
 history.replaceState(null, '', location.pathname + location.search + '#interview');
 if (window.playlogueFrontend.adapter.kind !== 'api') {
  location.assign('/?adapter=api#interview');
  return;
 }
 window.playlogueFrontend.recoverFromLink(id);
});
