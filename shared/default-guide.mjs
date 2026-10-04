import {customGuide} from './custom-study.mjs';
import {detonationDraft,detonationCaseKey,gameplayDraft,gameplayCaseKey} from './detonation-case.mjs';
export const firstSessionGuideId='builtin-detonation-first-session-v2';
export const firstSessionStudyId='study-detonation-first-session-v2';
export const builtinDefaultGuideId='builtin-detonation-gameplay-feedback-v3';
export const builtinDefaultStudyId='study-detonation-gameplay-feedback-v3';
export function builtinFirstSessionGuide(){
 const guide=customGuide(detonationDraft,firstSessionStudyId,{id:()=>firstSessionGuideId,now:()=>Date.parse('2026-10-04T00:00:00Z')});
 return {...guide,version:2,research_case:detonationCaseKey,builtin_template_version:2,themes:guide.themes.map((t,i)=>({...t,name:['First-session trigger','Defining experience','Next actual choice','Feedback to preserve'][i]}))};
}
export function builtinDefaultGuide(){
 const guide=customGuide(gameplayDraft,builtinDefaultStudyId,{id:()=>builtinDefaultGuideId,now:()=>Date.parse('2026-10-04T00:00:00Z')});
 return {...guide,version:3,research_case:gameplayCaseKey,builtin_template_version:3,session_probe_limit:2,themes:guide.themes.map((t,i)=>({...t,name:['Map design','Perceived operator balance','Customization and purchasing economy'][i]}))};
}
export const isBuiltinGuideId=id=>[builtinDefaultGuideId,firstSessionGuideId].includes(id);
export const builtinGuideById=id=>id===builtinDefaultGuideId?builtinDefaultGuide():id===firstSessionGuideId?builtinFirstSessionGuide():null;
export const isBuiltinDefaultGuide=g=>g?.id===builtinDefaultGuideId&&g?.study_id===builtinDefaultStudyId;
export const isBuiltinGuide=g=>isBuiltinDefaultGuide(g)||(g?.id===firstSessionGuideId&&g?.study_id===firstSessionStudyId);
