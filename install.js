import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]$/, '');

function getUserPath() {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], { encoding: 'utf8' });
    const m = out.match(/Path\s+REG_(?:EXPAND_)?SZ\s+([\s\S]*)/);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

const current = getUserPath();
const parts = current.split(';').filter(Boolean);
if (parts.some((p) => p.toLowerCase() === DIR.toLowerCase())) {
  console.log('repo ya esta en el PATH.');
  process.exit(0);
}
parts.push(DIR);
execFileSync('reg', ['add', 'HKCU\\Environment', '/v', 'Path', '/t', 'REG_EXPAND_SZ', '/d', parts.join(';'), '/f'], { stdio: 'ignore' });
console.log('Instalado. Cierra y reabre la terminal, luego escribe repo.');
