const KEY='playlogue.capabilities.v1';
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const validToken=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x);
export function createCapabilityStore(storage){
 let values={};try{const saved=JSON.parse(storage.getItem(KEY)||'{}');for(const [id,token]of Object.entries(saved))if(validId(id)&&validToken(token))values[id]=token;}catch{}
 const save=()=>storage.setItem(KEY,JSON.stringify(values));
 return {ids:()=>Object.keys(values),get:id=>values[id]||null,set(id,token){if(!validId(id)||!validToken(token))throw new Error('INVALID_CAPABILITY');values[id]=token;save();},remove(id){delete values[id];save();},generate(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');},importFragment(fragment){const p=new URLSearchParams(fragment.replace(/^#/,'')),id=p.get('session'),token=p.get('cap');if(!validId(id)||!validToken(token))return null;this.set(id,token);return id;},recoveryLink(id,base){const token=this.get(id);if(!token)throw new Error('CAPABILITY_UNAVAILABLE');const u=new URL(base);u.search='?adapter=api';u.hash=new URLSearchParams({session:id,cap:token}).toString();return u.href;}};
}
