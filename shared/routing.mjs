export const routingPolicies = Object.freeze({legacy:'fixed-first-v1',immediate:'immediate-probes-v1'});
// A missing policy on a stored session always means legacy. Never infer it from a guide.
export const routingPolicy = record => record.routing_policy ?? routingPolicies.legacy;
export const immediateRouting = session => routingPolicy(session) === routingPolicies.immediate;
export function totalProbeBudget(g){const sum=g.themes.reduce((n,t)=>n+t.budget,0);return Number.isInteger(g.session_probe_limit)&&g.session_probe_limit>=0?Math.min(sum,g.session_probe_limit):sum;}
export function probeAllowance(s,g){
  const t=g.themes.find(t=>t.id===s.task?.theme_id);
  const total=totalProbeBudget(g);
  const used=Object.values(s.used).reduce((n,count)=>n+count,0);
  const remainingFixed=immediateRouting(s)?g.themes.length-s.questions.filter(q=>q.kind==='fixed').length:0;
  const remaining=t?Math.max(0,Math.min(t.budget-(s.used[t.id]||0),total-used,9-s.questions.length-remainingFixed)):0;
  const trigger=s.questions.find(q=>q.id===s.task?.trigger_question_id);
  const phaseAllowed=immediateRouting(s)
    ? s.phase==='interleaved'&&g.themes[s.cursor]?.id===t?.id&&trigger?.theme_id===t?.id
    : s.phase==='exploration';
  return {theme_id:t?.id??null,remaining:!t||s.blocked.includes(t.id)?0:remaining,total_remaining:Math.max(0,total-used),allowed:s.status==='active'&&s.step==='deciding'&&phaseAllowed&&!!t&&!s.blocked.includes(t.id)&&remaining>0};
}
