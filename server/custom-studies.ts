import {ApiError}from'./repository.ts';
import {sha256}from'./auth.ts';
import {matchesDetonationDraft,detonationCaseKey}from'../shared/detonation-case.mjs';
import {validateCustomStudy,customGuide}from'../shared/custom-study.mjs';
export async function saveCustomStudy(db:D1Database,owner:string,requestId:string,input:any){
 const draft=validateCustomStudy(input),payload=JSON.stringify(draft);
 const studyId='custom-'+await sha256(owner+':custom-study:'+requestId);
 const existing=async()=>{const row=await db.prepare('SELECT owner_site_user_id,draft_json,current_published_guide_id FROM studies WHERE id=?').bind(studyId).first<any>();if(!row)return null;if(row.owner_site_user_id!==owner)throw new ApiError(404,'NOT_FOUND');if(row.draft_json!==payload)throw new ApiError(409,'IDEMPOTENCY_MISMATCH');const guide=await db.prepare('SELECT guide_json FROM guide_versions WHERE id=?').bind(row.current_published_guide_id).first<any>();if(!guide)throw new ApiError(503,'GUIDE_UNAVAILABLE');return {study_id:studyId,guide:JSON.parse(guide.guide_json),replayed:true};};
 const prior=await existing();if(prior)return prior;
 const guide=customGuide(draft,studyId);if(matchesDetonationDraft(draft))Object.assign(guide,{research_case:detonationCaseKey});
 // The study PK chooses a concurrent winner; conditional guide insert only inserts that winner's guide.
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO studies (id,owner_site_user_id,title,draft_json,draft_revision,current_published_guide_id,created_at,last_request_id) VALUES (?,?,?,?,0,?,?,?)').bind(studyId,owner,draft.title,payload,guide.id,guide.published_at,requestId),
  db.prepare('INSERT INTO guide_versions (id,study_id,version,guide_json,published_at) SELECT ?,?,1,?,? WHERE EXISTS (SELECT 1 FROM studies WHERE id=? AND current_published_guide_id=?)').bind(guide.id,studyId,JSON.stringify(guide),guide.published_at,studyId,guide.id)
 ]);
 const saved=await existing();if(!saved)throw new ApiError(503,'STUDY_UNAVAILABLE');return {...saved,replayed:saved.guide.id!==guide.id};
}
export async function listCustomStudies(db:D1Database,owner:string){const rows=await db.prepare("SELECT g.guide_json FROM guide_versions g JOIN studies s ON s.id=g.study_id WHERE s.owner_site_user_id=? AND s.id LIKE 'custom-%' ORDER BY s.created_at DESC LIMIT 100").bind(owner).all<any>();return rows.results.map(r=>JSON.parse(r.guide_json));}
