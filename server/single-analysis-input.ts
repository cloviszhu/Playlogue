import{analysisInput}from'./text-protocol.ts';
import{ApiError}from'./repository.ts';

// Keep every original answer and source identity once; never truncate or translate.
export function singleAnalysisInput(sessions:any[]){
 const input=JSON.parse(analysisInput(sessions));
 input.instruction+=' Each answer text is provided once in answers.text. For a returned span, copy session_id from its enclosing session.id, input_content_revision from session.content_revision, answer_id from answer.id, and question_id from answer.question_id. available_span supplies answer_revision and UTF-16 start/end offsets. Copy exact_quote from that answer text or its exact substring without rewriting or translating it.';
 for(const s of input.sessions)for(const a of s.answers)for(const key of ['exact_quote','session_id','question_id','answer_id','input_content_revision'])delete a.available_span[key];
 return JSON.stringify(input);
}

export function boundedTextRequest(payload:Readonly<Record<string,unknown>>,local:boolean){
 const bytes=new TextEncoder().encode(JSON.stringify(payload)).length;
 // Local synthetic engineering keeps its original byte allowance. Hosted research
 // retains the transport's existing 32,000-token maximum and reservation formula.
 if(local&&bytes>8192)throw new ApiError(422,'ENGINEERING_INPUT_LIMIT');
 const bound=bytes*2+8192;
 if(bound>32000)throw new ApiError(422,local?'ENGINEERING_INPUT_LIMIT':'RESEARCH_INPUT_LIMIT');
 return bound;
}
