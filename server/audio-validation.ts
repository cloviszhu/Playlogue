import {ApiError} from './repository.ts';
import {limits} from '../shared/session.mjs';
// Strict PCM WAV only: duration follows sample count, never a browser supplied timer.
export function validatePcmWav(bytes:ArrayBuffer){
 const fail=()=>{throw new ApiError(422,'UNVERIFIABLE_AUDIO');};
 if(bytes.byteLength<44||bytes.byteLength>limits.audio_bytes)fail();
 const v=new DataView(bytes),u=new Uint8Array(bytes);
 const tag=(p:number)=>String.fromCharCode(...u.slice(p,p+4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||v.getUint32(4,true)+8!==bytes.byteLength)fail();
 let p=12,fmt:null|{rate:number;align:number}=null,data=-1;
 while(p+8<=bytes.byteLength){
  const name=tag(p),length=v.getUint32(p+4,true),start=p+8,end=start+length;
  if(end>bytes.byteLength)fail();
  if(name==='fmt '){
   if(fmt||length!==16||v.getUint16(start,true)!==1)fail();
   const channels=v.getUint16(start+2,true),rate=v.getUint32(start+4,true),byteRate=v.getUint32(start+8,true),align=v.getUint16(start+12,true),bits=v.getUint16(start+14,true);
   if(![1,2].includes(channels)||![8000,16000,24000,32000,44100,48000].includes(rate)||bits!==16||align!==channels*2||byteRate!==rate*align)fail();
   fmt={rate,align};
  }else if(name==='data'){if(data!==-1)fail();data=length;}
  else fail(); // Reject ancillary/metadata chunks and compressed/ambiguous containers.
  p=end+(length%2);
 }
 if(p!==bytes.byteLength||!fmt||data<=0||data%fmt.align!==0)fail();
 const seconds=data/(fmt!.rate*fmt!.align);
 if(seconds>limits.audio_seconds)throw new ApiError(422,'AUDIO_LIMIT');
 return {seconds,sample_rate:fmt!.rate,format:'pcm_s16le',byte_length:bytes.byteLength} as const;
}
