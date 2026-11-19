import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildMenu,
  catalogItems,
  classifyRoot,
  cmdInvocation,
  isUncPath,
  listLocalRepos,
  mergeItems,
  NEW_SYMBOL,
  parseJsonText,
  pathKey,
  validateConfig,
} from '../bin/lib.mjs';

const UNC = '\\\\atsantiago\\INDUSTRIAL_VARIOS\\VARIOS\\Biblioteca Industrial\\Programas\\SCRIPTS';
const SCRIPTS = `${UNC}\\Scripts AutoCAD`;
const LOCAL = new Set(['C']);

test('una UNC se reconoce sin tocar el sistema de archivos', () => {
  assert.equal(isUncPath(SCRIPTS), true);
  assert.equal(classifyRoot(SCRIPTS, LOCAL).kind, 'remote');
  assert.equal(classifyRoot(SCRIPTS, LOCAL).reason, 'UNC');
});

test('las rutas de dispositivo no se confunden con UNC legitimas', () => {
  assert.equal(isUncPath('\\\\?\\C:\\_repos'), false);
  assert.equal(classifyRoot('\\\\?\\C:\\_repos', LOCAL).kind, 'remote');
  assert.equal(isUncPath('\\\\.\\pipe\\x'), false);
});

test('una unidad no confirmada como local no se enumera', () => {
  assert.equal(classifyRoot('Z:\\_repos', LOCAL).kind, 'remote');
  assert.equal(classifyRoot('C:\\_repos', LOCAL).kind, 'local');
});

test('rutas relativas y vacias se rechazan como remotas o invalidas', () => {
  assert.equal(classifyRoot('_repos\\x', LOCAL).kind, 'remote');
  assert.equal(classifyRoot('   ', LOCAL).kind, 'invalid');
  assert.equal(classifyRoot(null, LOCAL).kind, 'invalid');
});

test('se conserva roots y se anaden accesos directos', () => {
  const config = validateConfig({
    roots: ['C:\\_repos', UNC],
    shortcuts: [{ name: 'Scripts AutoCAD', path: SCRIPTS }],
  });
  assert.deepEqual(config.roots, ['C:\\_repos', UNC]);
  assert.deepEqual(config.shortcuts, [{ name: 'Scripts AutoCAD', path: SCRIPTS }]);
  assert.deepEqual(config.warnings, []);
});

test('una configuracion solo con accesses directos es valida', () => {
  const config = validateConfig({ shortcuts: [{ name: 'Scripts AutoCAD', path: SCRIPTS }] });
  assert.deepEqual(config.roots, []);
  assert.equal(config.shortcuts.length, 1);
});

test('la configuracion sin roots ni shortcuts no revienta', () => {
  assert.deepEqual(validateConfig({}).roots, []);
  assert.deepEqual(validateConfig(undefined).shortcuts, []);
});

test('las entradas invalidas se descartan con aviso y sin abortar', () => {
  const config = validateConfig({
    roots: [7, 'C:\\_repos'],
    shortcuts: [{ name: 'x' }, { name: 'y', path: 'relativa' }, { name: 'z', path: SCRIPTS }],
  });
  assert.deepEqual(config.roots, ['C:\\_repos']);
  assert.equal(config.shortcuts.length, 1);
  assert.ok(config.warnings.length >= 2);
});

test('una comilla en la ruta de un acceso directo se rechaza', () => {
  const config = validateConfig({ shortcuts: [{ name: 'malo', path: 'C:\\a"b' }] });
  assert.equal(config.shortcuts.length, 0);
  assert.equal(config.warnings.length, 1);
});

test('la clave de ruta ignora mayusculas, separadores y barra final', () => {
  assert.equal(pathKey('C:/_repos/Repo/'), pathKey('c:\\_repos\\repo'));
  assert.equal(pathKey('C:\\_repos\\Repo\\'), pathKey('C:\\_repos\\repo'));
});

test('los duplicados se resuelven por precedencia: acceso, local, catalogo', () => {
  const merged = mergeItems([
    [{ label: 'Scripts AutoCAD', value: SCRIPTS }],
    [{ label: 'SCRIPTS/Scripts AutoCAD', value: SCRIPTS }],
    [{ label: 'catalogo', value: SCRIPTS }],
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].label, 'Scripts AutoCAD');
});

test('dos rutas distintas con el mismo nombre se conservan', () => {
  const merged = mergeItems([
    [{ label: 'igual', value: 'C:\\a' }],
    [{ label: 'igual', value: 'C:\\b' }],
  ]);
  assert.equal(merged.length, 2);
});

test('el catalogo solo aporta fuentes configuradas', () => {
  const catalog = {
    version: 1,
    sources: [
      { root: UNC, updatedAt: '2026-11-01T10:00:00.000Z', entries: [{ name: 'A', path: `${UNC}\\A` }] },
      { root: '\\\\otro\\recurso', updatedAt: '2026-11-02T10:00:00.000Z', entries: [{ name: 'B', path: '\\\\otro\\recurso\\B' }] },
    ],
  };
  const result = catalogItems(catalog, [UNC]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].label, 'A');
  assert.equal(result.updatedAt, '2026-11-01T10:00:00.000Z');
});

test('un catalogo ausente o corrupto no rompe el menu', () => {
  assert.deepEqual(catalogItems(undefined, [UNC]).items, []);
  assert.deepEqual(catalogItems({ sources: 'x' }, [UNC]).items, []);
  assert.ok(catalogItems({ sources: 'x' }, [UNC]).warnings.length === 1);
});

test('un catalogo vacio legitimo se distingue de uno ilegible', () => {
  const empty = catalogItems({ version: 1, sources: [{ root: UNC, updatedAt: '2026-11-01T00:00:00.000Z', entries: [] }] }, [UNC]);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.warnings.length, 0);
  assert.equal(empty.updatedAt, '2026-11-01T00:00:00.000Z');
});

test('construir el menu no llama al sistema de archivos de una raiz remota', () => {
  const warnings = [];
  const calls = [];
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => {
      throw new Error('no debe usarse');
    },
    readdir: (path) => {
      calls.push(path);
      return [{ name: 'repo', isDirectory: () => true, isSymbolicLink: () => false }];
    },
  };
  const result = listLocalRepos(['C:\\_repos', UNC, SCRIPTS], warnings, io);
  assert.deepEqual(calls, ['C:\\_repos']);
  assert.equal(result.items.length, 1);
  assert.equal(result.listed, 1);
});

test('una raiz remota caida no impide listar las locales', () => {
  const warnings = [];
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => ({}),
    readdir: () => [{ name: 'uno', isDirectory: () => true, isSymbolicLink: () => false }],
  };
  const result = listLocalRepos(['\\\\servidor-caido\\x', 'C:\\_repos'], warnings, io);
  assert.equal(result.items.length, 1);
  assert.deepEqual(warnings, []);
});

test('una raiz local que lanza al enumerar se omite sin abortar', () => {
  const warnings = [];
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => ({}),
    readdir: (path) => {
      if (path === 'C:\\rota') throw new Error('EIO');
      return [{ name: 'ok', isDirectory: () => true, isSymbolicLink: () => false }];
    },
  };
  const result = listLocalRepos(['C:\\rota', 'C:\\_repos'], warnings, io);
  assert.equal(result.items.length, 1);
});

test('una raiz que es vinculo no se enumera', () => {
  const warnings = [];
  let read = 0;
  const io = {
    localDrives: new Set(['C']),
    hasLink: (path) => path === 'C:\\enlace',
    stat: () => ({}),
    readdir: () => {
      read += 1;
      return [];
    },
  };
  listLocalRepos(['C:\\enlace', 'C:\\_repos'], warnings, io);
  assert.equal(read, 1);
  assert.ok(warnings.some((w) => w.includes('vinculo')));
});

test('el menu combina acceso, local y catalogo sin consultar la red', () => {
  const calls = [];
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => ({}),
    readdir: (path) => {
      calls.push(path);
      return [{ name: 'uno', isDirectory: () => true, isSymbolicLink: () => false }];
    },
  };
  const menu = buildMenu({
    roots: ['C:\\_repos', UNC],
    shortcuts: [{ name: 'Scripts AutoCAD', path: SCRIPTS }],
    catalog: { items: [] },
    io,
  });
  assert.deepEqual(calls, ['C:\\_repos']);
  assert.deepEqual(menu.items.map((i) => i.label), ['Scripts AutoCAD', '_repos/uno', '+ Nuevo repo…']);
  assert.equal(menu.items[0].value, SCRIPTS);
  assert.equal(menu.items.at(-1).value, NEW_SYMBOL);
});

test('el menu funciona sin catalogo y solo con accesos directos', () => {
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => ({}),
    readdir: () => [],
  };
  const menu = buildMenu({ roots: [], shortcuts: [{ name: 'Scripts AutoCAD', path: SCRIPTS }], catalog: { items: [] }, io });
  assert.deepEqual(menu.items.map((i) => i.label), ['Scripts AutoCAD']);
  assert.deepEqual(menu.madres, []);
});

test('dibujar «Nuevo repo» no enumera ninguna madre', () => {
  const calls = [];
  const io = {
    localDrives: new Set(['C']),
    hasLink: () => false,
    stat: () => ({}),
    readdir: (path) => {
      calls.push(path);
      return [];
    },
  };
  const menu = buildMenu({ roots: [UNC], shortcuts: [], catalog: { items: [] }, io });
  assert.deepEqual(calls, []);
  assert.equal(menu.madres.length, 1);
  assert.equal(menu.madres[0].kind, 'remote');
  assert.equal(menu.items.at(-1).value, NEW_SYMBOL);
});

test('un catalogo con BOM de Bloc de notas se lee igual', () => {
  const text = '\uFEFF{"version":1,"sources":[{"root":"' + UNC.replace(/\\/g, '\\\\') + '","updatedAt":"2026-11-01T10:00:00.000Z","entries":[{"name":"A","path":"x"}]}]}';
  const parsed = parseJsonText(text);
  assert.equal(catalogItems(parsed, [UNC]).items.length, 1);
});

test('parseJsonText rechaza un texto que no es JSON', () => {
  assert.throws(() => parseJsonText('no json'));
});

test('leer un catalogo roto no equivale a un catalogo vacio', () => {
  const broken = catalogItems(JSON.parse('{"version":1}'), [UNC]);
  assert.equal(broken.items.length, 0);
  assert.equal(broken.warnings.length, 1);
  const legit = catalogItems({ version: 1, sources: [] }, [UNC]);
  assert.equal(legit.warnings.length, 0);
});

test('la invocacion de cmd no contiene la ruta remota ni un cwd remoto', () => {  const invocation = cmdInvocation('C:\\_repos\\repo\\bin\\launch-unc.cmd');
  assert.match(invocation.args.join(' '), /launch-unc\.cmd/);
  assert.doesNotMatch(invocation.args.join(' '), /atsantiago|\\\\/);
  assert.equal(invocation.args.includes('/s'), false);
});

const helper = join(process.cwd(), 'bin', 'launch-unc.cmd');

function runHelper({ target, cwd, stubDir, stubCode = '0' }) {
  const env = { ...process.env, REPO_OC_LAUNCH_TARGET: target, REPO_OC_LAUNCH_FAILURE: join(cwd, 'failed.txt') };
  env.PATH = `${stubDir};${env.PATH}`;
  if (stubCode !== null) {
    writeFileSync(join(stubDir, 'opencode.cmd'), `@echo off\r\necho STUB-CWD="%CD%"\r\nexit /b ${stubCode}\r\n`);
  }
  const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', helper], { cwd, env, encoding: 'latin1' });
  const marker = join(cwd, 'failed.txt');
  const failed = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : '';
  return { status: result.status, stdout: result.stdout ?? '', failed };
}

function withLab(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-oc-test-'));
  const stubDir = join(dir, 'bin');
  mkdirSync(stubDir);
  try {
    return fn({ dir, stubDir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('el ayudante abre la ruta elegida y propaga el codigo', () => {
  withLab(({ dir, stubDir }) => {
    const target = join(dir, 'raiz & rara', 'repo uno');
    mkdirSync(target, { recursive: true });
    const result = runHelper({ target, cwd: dir, stubDir, stubCode: '42' });
    assert.equal(result.status, 42);
    assert.match(result.stdout, /repo uno/);
    assert.equal(result.failed, '');
  });
});

test('el ayudante conserva espacios, parentesis, % y !', () => {
  withLab(({ dir, stubDir }) => {
    const target = join(dir, 'rara(1) %TEMP% !x! ^caret');
    mkdirSync(target, { recursive: true });
    const result = runHelper({ target, cwd: dir, stubDir, stubCode: '0' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /%TEMP% !x! \^caret/);
  });
});

test('si falla pushd no se ejecuta opencode y queda la marca', () => {
  withLab(({ dir, stubDir }) => {
    const result = runHelper({ target: join(dir, 'NO-EXISTE'), cwd: dir, stubDir, stubCode: '0' });
    assert.equal(result.status, 70);
    assert.equal(result.failed, 'failed');
    assert.doesNotMatch(result.stdout, /STUB-CWD/);
  });
});

test('un codigo de opencode distinto de cero no se confunde con fallo de preparacion', () => {
  withLab(({ dir, stubDir }) => {
    const target = join(dir, 'repo');
    mkdirSync(target);
    const result = runHelper({ target, cwd: dir, stubDir, stubCode: '3' });
    assert.equal(result.status, 3);
    assert.equal(result.failed, '');
  });
});
