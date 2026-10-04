import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import worker from'../dist/server/index.js';import{localD1}from'./sqlite-d1.mjs';import{sourceBuildId}from'../scripts/build-identity.mjs';
test('built API header and persisted diagnostics identify the actual immutable source build',async()=>{
 const DB=localD1();try{const m=JSON.parse(fs.readFileSync('work/build-manifest.json'));assert.match(m.build_version,/^[a-f0-9]{64}$/);assert.equal(m.build_version,sourceBuildId());
 const r=await worker.fetch(new Request('https://private.example/api/whoami',{headers:{'oai-authenticated-user-id':'owner'}}),{DB,APP_ORIGIN:'https://private.example',AUTH_MODE:'sites-dispatch',SITE_ACCESS_MODE:'owner-private',RESEARCHER_USER_ID:'owner'});
 assert.equal(r.status,200);assert.equal(r.headers.get('X-Build-Version'),m.build_version);const rows=DB.sqlite.prepare('SELECT build_version FROM diagnostic_events').all();assert.ok(rows.length>=2);assert.ok(rows.every(row=>row.build_version===m.build_version));assert.notEqual(m.build_version,'build-20261004T055500Z');
 }finally{DB.close();}
});
