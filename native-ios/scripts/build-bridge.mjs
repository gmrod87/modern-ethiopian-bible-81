import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const www=new URL('../www/',import.meta.url);
await mkdir(www,{recursive:true});
const common={bundle:true,format:'iife',platform:'browser',target:['ios16'],minify:true,sourcemap:false,legalComments:'none'};
await build({
  ...common,
  entryPoints:[new URL('../src/native-bridge.js',import.meta.url).pathname],
  outfile:new URL('../www/native-bridge.js',import.meta.url).pathname
});
await build({
  ...common,
  entryPoints:[new URL('../src/native-audio.js',import.meta.url).pathname],
  outfile:new URL('../www/native-audio.js',import.meta.url).pathname
});
console.log('Hobah native bridges bundled');
