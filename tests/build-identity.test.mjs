import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import crypto from'node:crypto';
import worker from'../dist/server/index.js';import{api}from'../work/test-api.mjs';import{sourceBuildId}from'../scripts/build-identity.mjs';
test('deployed Worker and offline API identify the exact current runtime sources',async()=>{
 const current=sourceBuildId(),manifest=JSON.parse(fs.readFileSync('work/build-manifest.json','utf8'));
 assert.equal(manifest.build_version,current);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/server/index.js')).digest('hex'),manifest.worker_sha256);
 for(const run of[worker.fetch,api]){const r=await run(new Request('https://build-check.invalid/api/public/example'),{});assert.equal(r.status,200);assert.equal(r.headers.get('X-Build-Version'),current);}
});
