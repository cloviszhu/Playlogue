// Provider metadata is not free text. Unknown values must never be persisted.
const codes=new Set(['credit_balance_exhausted','insufficient_quota','rate_limit_exceeded','invalid_api_key','model_not_found','permission_denied','unsupported_value','context_length_exceeded','invalid_request_error','invalid_parameter','server_error','service_unavailable']);
const types=new Set(['invalid_request_error','rate_limit_error','insufficient_quota','authentication_error','permission_error','server_error','api_error','not_found_error','timeout_error']);
const params=new Set(['model','input','text','text.format','text.format.type','text.format.name','text.format.schema','text.format.strict','max_output_tokens','reasoning','reasoning.effort','reasoning.mode','tools','store','service_tier','file','language','response_format','voice','temperature']);
const names=new Set(['Error','TypeError','SyntaxError','TimeoutError','AbortError','DOMException','ApiError']);
const network=new Set(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID']);
const localCodes=new Set(['PROVIDER_UNAVAILABLE','PROVIDER_HTTP_ERROR','PROVIDER_STRUCTURE','PROVIDER_RESPONSE_LIMIT','USAGE_UNVERIFIED','RESERVATION_OVERRUN','SPEECH_PROVIDER_HTTP_ERROR','SPEECH_PROVIDER_UNAVAILABLE','AUDIO_LIMIT','AUDIO_RESPONSE_EMPTY','TRANSCRIPT_LIMIT']);
const allow=(value,set)=>typeof value==='string'&&set.has(value)?value:null;
export const providerErrorCode=value=>allow(value,codes);
export const providerErrorType=value=>allow(value,types);
export const providerErrorParam=value=>allow(value,params);
export const providerRequestId=value=>typeof value==='string'&&/^req_[A-Za-z0-9]{8,64}$/.test(value)?value:null;
export const transportErrorName=value=>allow(value,names);
export const transportCauseCode=value=>allow(value,network);
export const localErrorCode=value=>allow(value,localCodes);
