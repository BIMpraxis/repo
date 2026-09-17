#!/usr/bin/env node
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
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

if (!process.stdin.isTTY) {
  console.error('repo necesita una terminal interactiva.');
  process.exit(1);
}

const roots = loadRoots();
const items = listRepos(roots);
if (items.length === 0) {
  console.log(`Sin repos. Revisa ${CONFIG_PATH}`);
  process.exit(1);
}
const chosen = await searchSelect({ message: '¿A qué repo quieres ir?', items });
if (chosen === cancelSymbol || !chosen) process.exit(0);
console.log(`Abriendo opencode en ${chosen}...`);
const child = spawn('opencode --auto', { stdio: 'inherit', shell: true, cwd: chosen });
child.on('exit', (code) => process.exit(code ?? 0));
