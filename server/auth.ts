import {ApiError} from './repository.ts';
export interface AuthEnv{AUTH_MODE?:string;SITE_ACCESS_MODE?:string;RESEARCHER_USER_ID?:string;APP_ORIGIN?:string;}
export function identity(request:Request,env:AuthEnv){
 // This flag is server configuration, never a request header. It remains disabled until private dispatch verification.
 if(env.AUTH_MODE!=='sites-dispatch')return null;
 const id=request.headers.get('oai-authenticated-user-id');return id&&id.length<=200&&/^[a-zA-Z0-9_:@.\-]+$/.test(id)?id:null;
}
export function researcher(request:Request,env:AuthEnv){const id=identity(request,env);if(!id||!env.RESEARCHER_USER_ID||id!==env.RESEARCHER_USER_ID)throw new ApiError(403,'RESEARCHER_REQUIRED');return id;}
export function sameOrigin(request:Request,env:AuthEnv){if(!env.APP_ORIGIN||new URL(request.url).origin!==env.APP_ORIGIN||request.headers.get('Origin')!==env.APP_ORIGIN)throw new ApiError(403,'ORIGIN_DENIED');}
export function capability(request:Request){const header=request.headers.get('Authorization')||'';const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);if(!match)throw new ApiError(404,'NOT_FOUND');return match[1];}
export async function sha256(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function authorized(request:Request,env:AuthEnv,row:any,allowResearcher=false,allowExpiredDeletion=false){if(!row)throw new ApiError(404,'NOT_FOUND');const admin=allowResearcher&&identity(request,env)&&identity(request,env)===env.RESEARCHER_USER_ID;if(!admin&&await sha256(capability(request))!==row.token_hash)throw new ApiError(404,'NOT_FOUND');if(row.session.status==='withdrawn')throw new ApiError(410,'WITHDRAWN');if(Date.parse(row.session.expires_at)<=Date.now()&&!allowExpiredDeletion)throw new ApiError(410,'EXPIRED');return row.session;}
