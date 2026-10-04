import {isBuiltinGuideId} from '../shared/default-guide.mjs';

// Server-created aggregate marker. Neither source labels nor client-supplied IDs
// can turn a historical interview into a public demonstration session.
export const publicDemoVersion='public-demo-v1';
export function isPublicDemoSession(s:any){return s?.public_demo_version===publicDemoVersion&&s.origin==='demo_live'&&isBuiltinGuideId(s.guide_id)&&s.routing_policy==='immediate-probes-v1';}
