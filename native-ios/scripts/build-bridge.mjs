import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir(new URL('../www/',import.meta.url),{recursive:true});
await build({
  entryPoints:[new URL('../src/native-bridge.js',import.meta.url).pathname],
  outfile:new URL('../www/native-bridge.js',import.meta.url).pathname,
  bundle:true,
  format:'iife',
  platform:'browser',
  target:['ios16'],
  minify:true,
  sourcemap:false,
  legalComments:'none'
});
console.log('Hobah native bridge bundled');
