import http from 'node:http';import worker from '../dist/server/index.js';
import {Repository}from'../work/test-api.mjs';import {localD1}from'../tests/sqlite-d1.mjs';
// Loopback-only integration harness. Identity is disabled; no browser header can grant a researcher role.
const DB=localD1(),origin='http://127.0.0.1:4175';await new Repository(DB).initialize('local-fixture-owner');
const env={DB,APP_ORIGIN:origin,AUTH_MODE:'disabled',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:''};
http.createServer(async(req,res)=>{try{const parts=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>16384){res.writeHead(413).end();return;}parts.push(part);}const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...parts.length?{body:Buffer.concat(parts)}:{}});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500).end('Local preview failed');}}).listen(4175,'127.0.0.1',()=>console.log('Built Worker local preview: '+origin+' (API live disabled, identity disabled)'));
