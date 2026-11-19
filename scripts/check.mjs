#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const errors = [];
const ok = (msg) => console.log(`ok   ${msg}`);
const fail = (msg) => {
  errors.push(msg);
  console.log(`FAIL ${msg}`);
};

try {
  execFileSync(process.execPath, ['--check', join(ROOT, 'bin/repo.mjs')], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', join(ROOT, 'bin/lib.mjs')], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', join(ROOT, 'bin/enumerate-root.mjs')], { stdio: 'pipe' });
  ok('bin/repo.mjs, bin/lib.mjs y bin/enumerate-root.mjs compilan');
} catch (error) {
  fail(`un modulo de bin/ no compila: ${error.stderr?.toString().trim() || error.message}`);
}

const helper = join(ROOT, 'bin/launch-unc.cmd');
if (existsSync(helper)) {
  const text = readFileSync(helper, 'utf8');
  if (text.includes('pushd') && text.includes('popd')) ok('launch-unc.cmd prepara y libera la asignacion');
  else fail('launch-unc.cmd no contiene pushd y popd');
  if (/atsantiago|INDUSTRIAL_VARIOS/.test(text)) fail('launch-unc.cmd codifica una ruta de instalacion particular');
  else ok('launch-unc.cmd no codifica rutas particulares');
} else {
  fail('falta bin/launch-unc.cmd');
}

for (const [name, target] of Object.entries(pkg.bin ?? {})) {
  if (existsSync(join(ROOT, target))) ok(`bin ${name} -> ${target}`);
  else fail(`bin ${name} apunta a ${target}, que no existe`);
}

const cmdFiles = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.cmd'))
  .map((entry) => entry.name);
for (const file of cmdFiles) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  for (const match of text.matchAll(/%~dp0([^"\s\r\n]+)/g)) {
    if (existsSync(join(ROOT, match[1]))) ok(`${file} -> ${match[1]}`);
    else fail(`${file} referencia ${match[1]}, que no existe`);
  }
}

// Sin node_modules no se pueden ejercitar los guardas que arrancan el CLI.
// Se avisa y se omiten; si la dependencia esta, se exigen como siempre.
const depsReady = spawnSync(process.execPath, ['-e', "import('picocolors')"], { stdio: 'pipe' }).status === 0;
if (!depsReady) {
  console.log('skip guard isTTY y flags: falta picocolors (ejecuta npm install para comprobarlos)');
} else {
  const guard = spawnSync(process.execPath, [join(ROOT, 'bin/repo.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  if (guard.status === 1 && `${guard.stderr}`.includes('terminal interactiva')) {
    ok('guard isTTY sale con codigo 1 y su mensaje');
  } else {
    fail(`guard isTTY inesperado: status=${guard.status} stderr="${`${guard.stderr}`.trim()}"`);
  }

  const exclusive = spawnSync(process.execPath, [join(ROOT, 'bin/repo.mjs'), '--install', '--uninstall'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (exclusive.status === 1 && `${exclusive.stderr}`.includes('no los dos')) {
    ok('--install y --uninstall juntos se rechazan con codigo 1');
  } else {
    fail(`flags exclusivos inesperado: status=${exclusive.status} stderr="${`${exclusive.stderr}`.trim()}"`);
  }
}

const expected = [
  'LICENSE',
  'README.en.md',
  'README.md',
  'bin/enumerate-root.mjs',
  'bin/launch-unc.cmd',
  'bin/lib.mjs',
  'bin/repo.mjs',
  'package.json',
];
try {
  const out = execFileSync('npm pack --dry-run --json', {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  const [packed] = JSON.parse(out);
  const actual = packed.files.map((file) => file.path).sort();
  const want = [...expected].sort();
  if (JSON.stringify(actual) === JSON.stringify(want)) {
    ok(`tarball con ${actual.length} archivos: ${actual.join(', ')}`);
  } else {
    fail(`tarball inesperado\n     esperado: ${want.join(', ')}\n     real:     ${actual.join(', ')}`);
  }
} catch (error) {
  fail(`npm pack fallo: ${error.message}`);
}

const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const first = changelog.match(/^##\s+\[?(\d+\.\d+\.\d+)\]?/m);
if (first && first[1] === pkg.version) ok(`CHANGELOG y package.json coinciden en ${pkg.version}`);
else fail(`CHANGELOG dice ${first ? first[1] : '(nada)'} y package.json dice ${pkg.version}`);

const tests = spawnSync(process.execPath, ['--test', join(ROOT, 'test/lib.test.mjs')], { stdio: 'pipe', encoding: 'utf8' });
const summary = `${tests.stdout ?? ''}`.match(/pass (\d+)[\s\S]*?fail (\d+)/);
if (tests.status === 0) ok(`pruebas locales: ${summary ? summary[1] : '?'} en verde`);
else fail(`pruebas locales con fallos: ${`${tests.stdout ?? ''}${tests.stderr ?? ''}`.trim().slice(-400)}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} comprobacion(es) fallidas`);
  process.exit(1);
}
console.log('\ntodo en orden');
