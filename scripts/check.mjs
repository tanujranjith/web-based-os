import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let count=0;
async function walk(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) await walk(file);
    else if (/\.m?js$/.test(file)) {
      const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
      if(checked.status!==0)throw new Error(checked.stderr || `Cannot check ${file}`);
      const source=await readFile(file,'utf8');
      for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) await access(path.resolve(path.dirname(file),match[1]));
      count++;
    }
  }
}
await walk('src');await walk('scripts');await walk('tests');
console.log(`Syntax and local imports verified for ${count} JavaScript modules.`);
