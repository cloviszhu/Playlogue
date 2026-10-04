import fs from'node:fs';import crypto from'node:crypto';
export function sourceBuildId(){
 const files=['index.html','package.json','package-lock.json','scripts/build.mjs','scripts/build-tests.mjs','scripts/build-identity.mjs'];
 const visit=dir=>{for(const name of fs.readdirSync(dir).sort()){const file=dir+'/'+name;if(fs.statSync(file).isDirectory())visit(file);else if(/\.(ts|js|mjs|css|html)$/.test(file))files.push(file);}};
 for(const dir of ['server','shared','client','db'])visit(dir);
 const hash=crypto.createHash('sha256');for(const file of files.sort()){hash.update(file+'\0');hash.update(fs.readFileSync(file));hash.update('\0');}return hash.digest('hex');
}
