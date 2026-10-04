import{build}from'esbuild';await build({entryPoints:['tests/analysis-input-entry.ts'],bundle:true,platform:'neutral',format:'esm',target:'es2022',outfile:'work/analysis-input-helpers.mjs'});
