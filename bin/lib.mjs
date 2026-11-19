import { lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Caracteres que no se admiten en una ruta de configuración: controles y comillas.
// El resto (espacios, &, %, !, ^, acentos, parentesis) es legal y debe funcionar.
const CONTROL_OR_QUOTE = /[\u0000-\u001f"]/;

export function isDevicePath(value) {
  return typeof value === 'string' && /^[\\/]{2}[.?][\\/]/.test(value);
}

// Deteccion puramente lexica: no toca el sistema de archivos.
export function isUncPath(value) {
  if (typeof value !== 'string' || isDevicePath(value)) return false;
  return /^[\\/]{2}[^\\/]+[\\/][^\\/]+/.test(value);
}

export function isAbsoluteDrivePath(value) {
  return typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value);
}

export function driveLetter(value) {
  const match = /^([A-Za-z]):/.exec(value ?? '');
  return match ? match[1].toUpperCase() : '';
}

// Letras que se pueden enumerar sin riesgo: las del sistema, el perfil y el propio Node.
// Cualquier otra letra puede ser una unidad de red y no se recorre.
export function localDriveLetters(env = process.env) {
  const letters = new Set();
  const add = (value) => {
    const letter = driveLetter(value);
    if (letter) letters.add(letter);
  };
  add(env.SystemDrive);
  add(env.SystemRoot);
  add(env.ProgramData);
  add(env.USERPROFILE);
  add(homedir());
  add(process.execPath);
  add(process.cwd());
  return letters;
}

export function classifyRoot(root, localDrives = localDriveLetters()) {
  if (typeof root !== 'string' || root.trim() === '') {
    return { path: null, kind: 'invalid', reason: 'ruta vacia' };
  }
  const value = root.trim();
  if (CONTROL_OR_QUOTE.test(value)) {
    return { path: value, kind: 'invalid', reason: 'caracteres no admitidos' };
  }
  if (isDevicePath(value)) return { path: value, kind: 'remote', reason: 'ruta de dispositivo' };
  if (isUncPath(value)) return { path: value, kind: 'remote', reason: 'UNC' };
  if (!isAbsoluteDrivePath(value)) return { path: value, kind: 'remote', reason: 'ruta no absoluta' };
  if (!localDrives.has(driveLetter(value))) {
    return { path: value, kind: 'remote', reason: 'unidad no confirmada como local' };
  }
  return { path: value, kind: 'local', reason: '' };
}

// Recorre solo los componentes de la propia raiz, sin descender por el arbol.
// Una union o vinculo se detecta con lstat y se omite.
export function pathHasLinkComponent(target) {
  const parts = String(target).split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return false;
  let current = parts[0].endsWith(':') ? `${parts[0]}\\` : parts[0];
  for (const part of parts.slice(1)) {
    current = join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      return false;
    }
    if (stat.isSymbolicLink()) return true;
  }
  return false;
}

export function pathKey(value) {
  const normalized = String(value ?? '').replace(/\//g, '\\').toLowerCase();
  return normalized.replace(/\\+$/, '') || normalized;
}

export function mergeItems(groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const item of group) {
      const key = pathKey(item.value);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

export function validateConfig(raw) {
  const warnings = [];
  const roots = [];
  const shortcuts = [];

  if (raw !== undefined && (raw === null || typeof raw !== 'object' || Array.isArray(raw))) {
    warnings.push('La configuracion no es un objeto JSON; se ignora.');
    return { roots, shortcuts, warnings };
  }
  const source = raw ?? {};

  if (source.roots !== undefined) {
    if (!Array.isArray(source.roots)) {
      warnings.push('"roots" debe ser una lista; se ignora.');
    } else {
      source.roots.forEach((root, index) => {
        if (typeof root !== 'string' || root.trim() === '') {
          warnings.push(`roots[${index}] no es una ruta valida; se ignora.`);
          return;
        }
        if (CONTROL_OR_QUOTE.test(root)) {
          warnings.push(`roots[${index}] contiene caracteres no admitidos; se ignora.`);
          return;
        }
        roots.push(root.trim());
      });
    }
  }

  if (source.shortcuts !== undefined) {
    if (!Array.isArray(source.shortcuts)) {
      warnings.push('"shortcuts" debe ser una lista; se ignora.');
    } else {
      source.shortcuts.forEach((entry, index) => {
        const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
        const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
        if (!name || !path) {
          warnings.push(`shortcuts[${index}] necesita "name" y "path"; se ignora.`);
          return;
        }
        if (CONTROL_OR_QUOTE.test(path)) {
          warnings.push(`shortcuts[${index}].path contiene caracteres no admitidos; se ignora.`);
          return;
        }
        if (!isUncPath(path) && !isAbsoluteDrivePath(path)) {
          warnings.push(`shortcuts[${index}].path debe ser una ruta absoluta; se ignora.`);
          return;
        }
        shortcuts.push({ name, path });
      });
    }
  }

  return { roots, shortcuts, warnings };
}

// Los ficheros escritos con el Bloc de notas o PowerShell pueden llevar BOM UTF-8.
export function parseJsonText(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, ''));
}

// Centinela compartido para la entrada «Nuevo repo».
export const NEW_SYMBOL = Symbol.for('repo-oc.new');

export function shortcutItems(shortcuts) {
  return shortcuts.map((entry) => ({
    label: entry.name,
    value: entry.path,
    detail: entry.path,
    kind: 'shortcut',
  }));
}

// Orden del menu: accesos directos, descubrimiento local, catalogo local.
// Ninguna de las tres fuentes consulta la red.
export function buildMenu({ roots, shortcuts, catalog, io }) {
  const warnings = [];
  const local = listLocalRepos(roots, warnings, io);
  const items = mergeItems([shortcutItems(shortcuts), local.items, catalog.items]);
  const madres = roots.map((path) => ({ path, kind: classifyRoot(path, io ? io.localDrives : localDriveLetters()).kind }));
  if (madres.length > 0) {
    items.push({ label: '+ Nuevo repo…', value: NEW_SYMBOL, detail: '', kind: 'new' });
  }
  return { items, madres, warnings };
}

export function catalogItems(catalog, roots) {
  const warnings = [];
  const items = [];
  if (catalog === undefined || catalog === null) return { items, warnings, updatedAt: '' };
  if (!Array.isArray(catalog.sources)) {
    warnings.push('El catalogo no tiene el formato esperado; se ignora.');
    return { items, warnings, updatedAt: '' };
  }
  const configured = new Set(roots.map(pathKey));
  let newest = '';
  for (const source of catalog.sources) {
    const root = typeof source?.root === 'string' ? source.root : '';
    if (!root || !configured.has(pathKey(root))) continue;
    if (typeof source.updatedAt === 'string' && source.updatedAt > newest) newest = source.updatedAt;
    if (!Array.isArray(source.entries)) {
      warnings.push(`El catalogo de ${root} no tiene entradas validas; se omite.`);
      continue;
    }
    for (const entry of source.entries) {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
      const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
      if (!name || !path) continue;
      items.push({ label: name, value: path, detail: path, kind: 'catalog' });
    }
  }
  return { items, warnings, updatedAt: newest };
}

// Sin /S: con una sola pareja de comillas, cmd las retira y ejecuta el lote.
// Node se encarga de entrecomillar el argumento si la ruta lleva espacios.
export function cmdInvocation(helperPath) {
  return {
    file: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/c', helperPath],
  };
}

// Descubrimiento exclusivamente local. `io` se inyecta para poder observar
// cada llamada: ninguna ruta remota debe llegar a exists/readdir/lstat.
export function listLocalRepos(roots, warnings, io) {
  const files = io ?? { readdir: readdirSync, stat: lstatSync };
  const drives = io ? io.localDrives : localDriveLetters();
  const items = [];
  let listed = 0;
  for (const root of roots) {
    const { kind, reason } = classifyRoot(root, drives);
    if (kind !== 'local') {
      if (kind === 'invalid') warnings.push(`Raiz ignorada (${reason}): ${root}`);
      continue;
    }
    if (io ? io.hasLink(root) : pathHasLinkComponent(root)) {
      warnings.push(`Raiz no enumerada por ser vinculo o union: ${root}`);
      continue;
    }
    let entries;
    try {
      entries = files.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    listed += 1;
    const madre = root.split(/[\\/]/).filter(Boolean).pop();
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        items.push({
          label: `${madre}/${entry.name}`,
          value: join(root, entry.name),
          detail: join(root, entry.name),
          kind: 'local',
        });
      }
    }
  }
  return { items, listed };
}
