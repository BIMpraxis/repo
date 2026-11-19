import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Arranca el punto de entrada real (bin/repo.mjs) con una TTY simulada.
// Guarda contra fallos de arranque que las pruebas unitarias no ven: la rama
// por defecto se ejecuta tal cual, sin dobles inyectados.
function runMenu({ roots, shortcuts = [], timeoutMs = 10000 }) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-oc-e2e-'));
  const home = join(dir, 'home');
  mkdirSync(join(home, '.repo'), { recursive: true });
  writeFileSync(join(home, '.repo', 'repoconfig.json'), JSON.stringify({ roots, shortcuts }));

  // Solo se materializan raices locales; una ruta de red nunca se toca.
  for (const root of roots) {
    if (!/^[\\/]{2}/.test(root)) mkdirSync(join(root, 'repo-de-prueba'), { recursive: true });
  }

  // La TUI escribe en stdout: se redirige a fichero y luego se lee.
  const out = join(dir, 'salida.txt');
  const harness = join(dir, 'harness.mjs');
  writeFileSync(
    harness,
    [
      "import { appendFileSync } from 'node:fs';",
      'process.stdout.write = (chunk) => appendFileSync(process.env.REPO_E2E_OUT, String(chunk));',
      'process.stdout.columns = 100;',
      'process.stdin.isTTY = true;',
      'process.stdin.setRawMode = () => {};',
      'setTimeout(() => process.stdin.emit("keypress", "\\u0003", { name: "c", ctrl: true }), 600);',
      `await import(${JSON.stringify(`file:///${join(process.cwd(), 'bin', 'repo.mjs').replace(/\\/g, '/')}`)});`,
    ].join('\n'),
  );

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [harness], {
      env: { ...process.env, USERPROFILE: home, REPO_E2E_OUT: out },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('exit', (status) => {
      clearTimeout(timer);
      let stdout = '';
      try {
        stdout = readFileSync(out, 'utf8');
      } catch {
        stdout = '';
      }
      rmSync(dir, { recursive: true, force: true });
      resolve({ status, stdout, stderr, all: `${stdout}${stderr}` });
    });
  });
}

test('el punto de entrada arranca, dibuja el menu y cancela sin reventar', async () => {
  const root = join(tmpdir(), `repo-oc-root-${process.pid}-a`);
  try {
    const result = await runMenu({ roots: [root] });
    assert.doesNotMatch(result.all, /ReferenceError|is not defined|ERR_MODULE_NOT_FOUND/);
    assert.match(result.stdout, /repo-de-prueba/);
    assert.match(result.stdout, /Nuevo repo/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el arranque no consulta raices de red y muestra el acceso directo', async () => {
  const root = join(tmpdir(), `repo-oc-root-${process.pid}-b`);
  const UNC = '\\\\servidor-inexistente\\recurso\\madre';
  try {
    const result = await runMenu({
      roots: [root, UNC],
      shortcuts: [{ name: 'Scripts AutoCAD', path: `${UNC}\\Scripts AutoCAD` }],
    });
    assert.doesNotMatch(result.all, /ReferenceError|is not defined/);
    assert.match(result.stdout, /Scripts AutoCAD/);
    assert.match(result.stdout, /repo-de-prueba/);
    assert.doesNotMatch(result.all, /EACCES|EBUSY|ECONNREFUSED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
