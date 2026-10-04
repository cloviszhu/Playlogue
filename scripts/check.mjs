import fs from 'node:fs';import {spawnSync}from'node:child_process';
for(const dir of ['shared','client','scripts'])for(const file of fs.readdirSync(dir).filter(f=>/\.(mjs|js)$/.test(f))){const r=spawnSync(process.execPath,['--check',dir+'/'+file],{encoding:'utf8'});if(r.status){console.error(r.stderr);process.exit(r.status);}}console.log('ES module syntax checks passed.');
