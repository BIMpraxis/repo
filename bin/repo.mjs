#!/usr/bin/env node
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as readline from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import { Writable } from 'node:stream';
import pc from 'picocolors';

// Port del prompt de referencia (vercel-labs/skills, src/prompts/search-multiselect.ts):
// ventana fija, filtro Search, redibujado in situ, cursor acotado (sin wrap).
// Adaptado a seleccion unica: Intro elige el resaltado, Esc cancela.
const S_STEP_ACTIVE = pc.green('◆');
const S_STEP_CANCEL = pc.red('■');
const S_STEP_SUBMIT = pc.green('◇');
const S_BAR = pc.dim('│');
const MAX_VISIBLE = 12;
const cancelSymbol = Symbol('cancel');
const newSymbol = Symbol('new');

const silentOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

function approxStringWidth(plain) {
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0);
    if (code === 0) continue;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x231a && code <= 0x231b) ||
      (code >= 0x2329 && code <= 0x232a) ||
      (code >= 0x23e9 && code <= 0x23ec) ||
      code === 0x23f0 ||
      code === 0x23f3 ||
      (code >= 0x25fd && code <= 0x25fe) ||
      (code >= 0x2614 && code <= 0x2615) ||
      (code >= 0x2648 && code <= 0x2653) ||
      (code >= 0x267f && code <= 0x267f) ||
      (code >= 0x2693 && code <= 0x2693) ||
      (code >= 0x26a1 && code <= 0x26a1) ||
      (code >= 0x26aa && code <= 0x26ab) ||
      (code >= 0x26bd && code <= 0x26be) ||
      (code >= 0x26c4 && code <= 0x26c5) ||
      (code >= 0x26ce && code <= 0x26ce) ||
      (code >= 0x26d4 && code <= 0x26d4) ||
      (code >= 0x26ea && code <= 0x26ea) ||
      (code >= 0x26f2 && code <= 0x26f3) ||
      (code >= 0x26f5 && code <= 0x26f5) ||
      (code >= 0x26fa && code <= 0x26fa) ||
      (code >= 0x26fd && code <= 0x26fd) ||
      (code >= 0x2705 && code <= 0x2705) ||
      (code >= 0x270a && code <= 0x270b) ||
      (code >= 0x2728 && code <= 0x2728) ||
      (code >= 0x274c && code <= 0x274c) ||
      (code >= 0x274e && code <= 0x274e) ||
      (code >= 0x2753 && code <= 0x2755) ||
      (code >= 0x2757 && code <= 0x2757) ||
      (code >= 0x2795 && code <= 0x2797) ||
      (code >= 0x27b0 && code <= 0x27b0) ||
      (code >= 0x27bf && code <= 0x27bf) ||
      (code >= 0x2b1b && code <= 0x2b1c) ||
      (code >= 0x2b50 && code <= 0x2b50) ||
      (code >= 0x2b55 && code <= 0x2b55) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xa960 && code <= 0xa97c) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f000 && code <= 0x1f9ff);
    width += wide ? 2 : 1;
  }
  return width;
}

function visualRowsForLine(line, columns) {
  const plain = stripVTControlCharacters(line);
  const cols = Math.max(1, columns);
  return Math.max(1, Math.ceil(approxStringWidth(plain) / cols));
}

function countVisualRowsForLines(lines, columns) {
  const cols =
    columns !== undefined && columns > 0
      ? columns
      : process.stdout.columns && process.stdout.columns > 0
        ? process.stdout.columns
        : 80;
  return lines.reduce((sum, line) => sum + visualRowsForLine(line, cols), 0);
}

const CONFIG_DIR = join(process.env.USERPROFILE ?? process.env.HOME, '.repo');
const CONFIG_PATH = join(CONFIG_DIR, 'repoconfig.json');
const TARGET_FILE = process.env.REPO_OC_TARGET || join(tmpdir(), 'repo-oc-target.txt');

function loadRoots() {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({ roots: [] }, null, 2));
    console.log(`Creada config ${CONFIG_PATH}`);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')).roots;
}

function listRepos(roots) {
  const items = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const madre = root.split(/[\\/]/).filter(Boolean).pop();
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) items.push({ label: `${madre}/${entry.name}`, value: join(root, entry.name) });
    }
  }
  return items;
}

function promptText(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(value);
    };
    rl.on('close', () => finish(cancelSymbol));
    rl.on('SIGINT', () => finish(cancelSymbol));
    rl.question(`${pc.bold(message)} `, (answer) => finish(answer));
  });
}

const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;

async function createRepoFlow(madres) {
  let madre = madres[0];
  if (madres.length > 1) {
    const pick = await searchSelect({
      message: '¿Bajo qué carpeta madre?',
      items: madres.map((root) => ({
        label: root.split(/[\\/]/).filter(Boolean).pop(),
        value: root,
      })),
    });
    if (pick === cancelSymbol || !pick) return cancelSymbol;
    madre = pick;
  }
  for (;;) {
    const answer = await promptText('Nombre del nuevo repo:');
    if (answer === cancelSymbol) return cancelSymbol;
    const name = answer.trim();
    if (!name) {
      console.log(pc.yellow('Nombre vacío, prueba otra vez.'));
      continue;
    }
    if (INVALID_NAME.test(name) || name === '.' || name === '..') {
      console.log(pc.yellow('Nombre no válido en Windows (evita <>:"/\\|?*).'));
      continue;
    }
    const dest = join(madre, name);
    if (existsSync(dest)) {
      console.log(pc.yellow(`Ya existe ${dest}. Prueba otro nombre.`));
      continue;
    }
    try {
      mkdirSync(dest);
    } catch (error) {
      console.log(pc.yellow(`No se pudo crear ${dest}: ${error.message}`));
      continue;
    }
    console.log(`Creado ${dest}`);
    return dest;
  }
}

async function searchSelect({ message, items, maxVisible = MAX_VISIBLE }) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: silentOutput,
      terminal: false,
    });
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    let query = '';
    let cursor = 0;
    let lastRenderHeight = 0;

    const getFiltered = () => {
      if (!query) return items;
      const q = query.toLowerCase();
      return items.filter((item) => item.label.toLowerCase().includes(q));
    };

    const render = (state = 'active', doneLabel = '') => {
      const lines = [];
      const filtered = getFiltered();
      cursor = Math.max(0, Math.min(cursor, Math.max(0, filtered.length - 1)));
      const icon =
        state === 'active' ? S_STEP_ACTIVE : state === 'cancel' ? S_STEP_CANCEL : S_STEP_SUBMIT;
      lines.push(`${icon}  ${pc.bold(message)}`);

      if (state === 'active') {
        lines.push(`${S_BAR}  ${pc.dim('Search:')} ${query}${pc.inverse(' ')}`);
        lines.push(`${S_BAR}  ${pc.dim('↑↓ move, enter confirm')}`);
        lines.push(`${S_BAR}`);
        if (filtered.length === 0) {
          lines.push(`${S_BAR}  ${pc.dim('No matches found')}`);
        } else {
          const limit = Math.max(1, maxVisible);
          const start = Math.max(0, Math.min(cursor - Math.floor(limit / 2), filtered.length - limit));
          const end = Math.min(filtered.length, start + limit);
          if (start > 0) lines.push(`${S_BAR}  ${pc.dim(`↑ ${start} more`)}`);
          for (let i = start; i < end; i++) {
            const item = filtered[i];
            const isCursor = i === cursor;
            const prefix = isCursor ? pc.cyan('❯') : ' ';
            const label = isCursor ? pc.underline(item.label) : item.label;
            lines.push(`${S_BAR} ${prefix} ${label}`);
          }
          const after = filtered.length - end;
          if (after > 0) lines.push(`${S_BAR}  ${pc.dim(`↓ ${after} more`)}`);
        }
        lines.push(`${pc.dim('└')}`);
      } else if (state === 'submit') {
        lines.push(`${S_BAR}  ${pc.dim(doneLabel)}`);
      } else if (state === 'cancel') {
        lines.push(`${S_BAR}  ${pc.strikethrough(pc.dim('Cancelled'))}`);
      }

      const clearPreviousFrame = lastRenderHeight > 0 ? `\x1b[${lastRenderHeight}A\x1b[J` : '';
      process.stdout.write(clearPreviousFrame + lines.join('\n') + '\n');
      lastRenderHeight = countVisualRowsForLines(lines, process.stdout.columns);
    };

    const cleanup = () => {
      rl.removeListener('close', closeHandler);
      process.stdin.removeListener('keypress', keypressHandler);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      rl.close();
    };

    let settled = false;

    const submit = (item) => {
      if (settled || !item) return;
      settled = true;
      render('submit', item.label);
      cleanup();
      resolve(item.value);
    };

    const cancel = () => {
      if (settled) return;
      settled = true;
      render('cancel');
      cleanup();
      resolve(cancelSymbol);
    };

    const closeHandler = () => {
      cancel();
    };

    const keypressHandler = (_str, key) => {
      if (!key) return;
      if (key.name === 'return') {
        submit(getFiltered()[cursor]);
        return;
      }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cancel();
        return;
      }
      if (key.name === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }
      if (key.name === 'down') {
        cursor = Math.min(getFiltered().length - 1, cursor + 1);
        render();
        return;
      }
      if (key.name === 'backspace') {
        query = query.slice(0, -1);
        cursor = 0;
        render();
        return;
      }
      if (key.sequence && !key.ctrl && !key.meta && key.sequence.length === 1) {
        query += key.sequence;
        cursor = 0;
        render();
      }
    };

    process.stdin.on('keypress', keypressHandler);
    rl.on('close', closeHandler);

    if (process.stdin.readableEnded || process.stdin.destroyed) {
      cancel();
      return;
    }

    render();
  });
}

const HOSTS = ['powershell', 'pwsh'];
const SNIPPET_OPEN = '# >>> repo-oc >>>';
const SNIPPET_CLOSE = '# <<< repo-oc <<<';
const SNIPPET = [
  SNIPPET_OPEN,
  'function repo {',
  '    $cmd = (Get-Command repo.cmd -ErrorAction SilentlyContinue).Source',
  "    if (-not $cmd) { Write-Warning 'repo.cmd no encontrada; ejecuta: npm install -g github:BIMpraxis/repo'; return }",
  '    if ($args.Count -gt 0) { & $cmd @args; return }',
  '    $target = Join-Path $env:TEMP ("repo-oc-target-{0}.txt" -f $PID)',
  '    $env:REPO_OC_TARGET = $target',
  '    Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue',
  '    & $cmd',
  '    $env:REPO_OC_TARGET = $null',
  '    if (Test-Path -LiteralPath $target) {',
  '        $raw = Get-Content -LiteralPath $target -Raw -Encoding UTF8 -ErrorAction SilentlyContinue',
  '        Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue',
  "        $path = if ($raw) { $raw.Trim() } else { '' }",
  '        if ($path -and (Test-Path -LiteralPath $path -PathType Container)) { Set-Location -LiteralPath $path }',
  '    }',
  '}',
  SNIPPET_CLOSE,
].join('\n');

function resolveProfilePath(host) {
  const script = '[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($PROFILE))';
  const out = execFileSync(host, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).trim();
  return out ? Buffer.from(out, 'base64').toString('utf8') : '';
}

function collectProfiles() {
  const list = [];
  for (const host of HOSTS) {
    try {
      const path = resolveProfilePath(host);
      if (path) list.push({ host, path });
    } catch (error) {
      if (error.code === 'ENOENT') console.log(pc.dim(`Host no disponible: ${host} (se omite)`));
      else console.log(pc.yellow(`No se pudo resolver el perfil de ${host}: ${error.message}`));
    }
  }
  return list;
}

function hasSnippet(text) {
  return text.includes(SNIPPET_OPEN) && text.includes(SNIPPET_CLOSE);
}

function isUpToDate(text) {
  return text.replace(/\r\n/g, '\n').includes(SNIPPET);
}

function removeSnippet(text) {
  const re = new RegExp(`^[ \\t]*${SNIPPET_OPEN}[\\s\\S]*?^[ \\t]*${SNIPPET_CLOSE}[ \\t]*\\r?\\n?`, 'gm');
  return text.replace(re, '');
}

function appendSnippet(content) {
  const crlf = SNIPPET.split('\n').join('\r\n');
  const base = content.replace(/[\s\uFEFF]+$/, '');
  if (base === '') return crlf + '\r\n';
  return base + '\r\n\r\n' + crlf + '\r\n';
}

function shellSetup({ install, uninstall, dryRun }) {
  const profiles = collectProfiles();
  if (profiles.length === 0) {
    console.error('No hay ningun host de PowerShell en el PATH.');
    process.exit(1);
  }
  const mode = uninstall ? 'uninstall' : 'install';
  for (const { host, path } of profiles) {
    const exists = existsSync(path);
    const raw = exists ? readFileSync(path, 'utf8') : '';
    const hadBom = raw.startsWith('\uFEFF');
    const content = hadBom ? raw.slice(1) : raw;
    const present = hasSnippet(content);
    console.log(`${pc.bold(host)} -> ${path}`);
    if (dryRun) {
      const state = !exists
        ? 'no existe (se creara)'
        : present
          ? isUpToDate(content)
            ? 'ya instalado y al dia'
            : 'instalado pero desactualizado (se reemplazara)'
          : 'sin el bloque (se anadira)';
      console.log(`  ${state}`);
      continue;
    }
    if (mode === 'install') {
      if (present && isUpToDate(content)) {
        console.log(`  ${pc.dim('ya estaba instalado y al dia')}`);
        continue;
      }
      mkdirSync(dirname(path), { recursive: true });
      const prefix = hadBom || !exists ? '\uFEFF' : '';
      writeFileSync(path, prefix + appendSnippet(present ? removeSnippet(content) : content));
      console.log(`  ${pc.green(present ? 'actualizado' : exists ? 'instalado' : 'creado e instalado')}`);
    } else {
      if (!present) {
        console.log(`  ${pc.dim(exists ? 'sin el bloque: nada que retirar' : 'el perfil no existe todavia')}`);
        continue;
      }
      const rest = removeSnippet(content).replace(/[\s\uFEFF]+$/, '');
      writeFileSync(path, rest === '' ? '' : (hadBom ? '\uFEFF' + rest : rest) + '\r\n');
      console.log(`  ${pc.green('bloque retirado')}`);
    }
  }
  if (dryRun) {
    console.log(`\n${pc.dim('--- bloque que se escribiria ---')}\n${SNIPPET}\n${pc.dim('--- fin (dry-run: no se ha escrito nada) ---')}`);
    return;
  }
  if (mode === 'install') console.log('\nAbre una terminal nueva (o ejecuta . $PROFILE) y escribe repo.');
}

const argv = process.argv.slice(2);
if (argv.includes('--install') || argv.includes('--uninstall') || argv.includes('--dry-run')) {
  if (argv.includes('--install') && argv.includes('--uninstall')) {
    console.error('Usa --install o --uninstall, no los dos a la vez.');
    process.exit(1);
  }
  shellSetup({
    install: argv.includes('--install') || argv.includes('--dry-run'),
    uninstall: argv.includes('--uninstall'),
    dryRun: argv.includes('--dry-run'),
  });
  process.exit(0);
}

if (!process.stdin.isTTY) {
  console.error('repo necesita una terminal interactiva.');
  process.exit(1);
}

const roots = loadRoots();
const madres = roots.filter((root) => existsSync(root));
if (madres.length === 0) {
  console.log(`Sin carpetas madre. Revisa ${CONFIG_PATH}`);
  process.exit(1);
}
const items = listRepos(roots);
items.push({ label: '+ Nuevo repo…', value: newSymbol });
const chosen = await searchSelect({ message: '¿A qué repo quieres ir?', items });
if (chosen === cancelSymbol || !chosen) process.exit(0);
let target = chosen;
if (chosen === newSymbol) {
  target = await createRepoFlow(madres);
  if (target === cancelSymbol) process.exit(0);
}
console.log(`Abriendo opencode en ${target}...`);
writeFileSync(TARGET_FILE, target);
const child = spawn('opencode --auto', { stdio: 'inherit', shell: true, cwd: target });
child.on('exit', (code) => process.exit(code ?? 0));
