import {models,limits} from '../shared/session.mjs';
import {ApiError} from './repository.ts';
export interface ProviderTask {task_id:string;operation:'decision'|'analysis'|'cross_analysis'|'stt'|'tts';session_id:string;content_revision:number;}
export interface Providers {decision(task:ProviderTask,input:unknown):Promise<unknown>;analysis(task:ProviderTask,input:unknown):Promise<unknown>;stt(task:ProviderTask,audio:Blob):Promise<string>;tts(task:ProviderTask,savedQuestion:string):Promise<ArrayBuffer>;}
// Actual transport is deliberately absent until account, spending and processing approvals are recorded.
export class DisabledProviders implements Providers{
 async decision(_task:ProviderTask,_input:unknown):Promise<never>{throw new ApiError(503,'LIVE_DISABLED');}
 async analysis(_task:ProviderTask,_input:unknown):Promise<never>{throw new ApiError(503,'LIVE_DISABLED');}
 async stt(_task:ProviderTask,_audio:Blob):Promise<never>{throw new ApiError(503,'LIVE_DISABLED');}
 async tts(_task:ProviderTask,_savedQuestion:string):Promise<never>{throw new ApiError(503,'LIVE_DISABLED');}
}
export const providerConfiguration={models,limits,live_enabled:false,transport:'disabled',actual_calls:0} as const;
