import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ios=path.join(root,'ios');
if(!existsSync(path.join(root,'www','index.html')))throw new Error('Prepare the native web bundle first: npm run prepare:web && npm run build:bridge');
if(!existsSync(ios)){
  console.log('Creating Capacitor iOS project…');
  execFileSync(process.platform==='win32'?'npx.cmd':'npx',['cap','add','ios'],{cwd:root,stdio:'inherit'});
}else console.log('Capacitor iOS project already exists');
