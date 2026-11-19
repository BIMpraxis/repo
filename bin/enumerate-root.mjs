import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Hijo aislado: enumera una sola carpeta madre remota y devuelve JSON por stdout.
// Vive aparte para que el proceso principal pueda terminarlo si se bloquea.
const root = process.argv[2];

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
}

if (!root) {
  emit({ ok: false, error: 'sin ruta' });
  process.exit(2);
}

try {
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => ({ name: entry.name, path: join(root, entry.name) }));
  emit({ ok: true, root, entries });
} catch (error) {
  emit({ ok: false, root, error: error.code || error.message });
  process.exit(1);
}
