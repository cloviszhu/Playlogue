import {sourceBuildId}from'./build-identity.mjs';
import {build}from'esbuild';await build({entryPoints:['tests/api-entry.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile:'work/test-api.mjs',define:{__PLAYLOGUE_BUILD_ID__:JSON.stringify(sourceBuildId())}});
