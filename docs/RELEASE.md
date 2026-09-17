# Release — repo-oc

Cómo se publica el paquete. Complementa `PRD.md` (motivos y contratos) y `CONTEXT.md` (glosario).

## Resumen en una frase

Escribes un commit con Conventional Commits y lo subes a `main`: el CI calcula la versión, escribe el CHANGELOG, crea el tag, publica en npm y crea la release de GitHub. Tú no tocas npm.

## Quién hace qué

| Pieza | Fichero | Qué hace |
|---|---|---|
| Comprobaciones | `scripts/check.mjs` (`npm run check`) | Sintaxis, `bin` existente, referencias `%~dp0` sin destino, salida sin terminal, contenido exacto del paquete y versión ↔ CHANGELOG |
| Verificación continua | `.github/workflows/ci.yml` | Ejecuta lo anterior en cada push y en cada PR |
| Release | `.github/workflows/release.yml` | Versión + CHANGELOG + tag + publicación por OIDC + release de GitHub |
| Configuración | `.releaserc.json` | Orden de los pasos de `semantic-release` |

## Flujo normal

1. Se trabaja y se commitea con Conventional Commits (`feat:`, `fix:`, `chore:`…).
2. Push a `main` (o merge de un PR).
3. `ci.yml` comprueba; `release.yml` decide si toca release:
   - `feat:` → sube versión menor; `fix:` → sube parche; `chore:`/`docs:` → no publica.
4. Si toca release, el propio workflow escribe el CHANGELOG, sube la versión en `package.json`, crea el tag `vX.Y.Z`, publica en npm y crea la release de GitHub.

El commit que hace el bot lleva `[skip ci]` para no dispararse a sí mismo.

## Prueba sin publicar

En GitHub → *Actions* → *release* → **Run workflow** con `dry_run` activado. No publica ni escribe nada: solo muestra la versión y las notas que saldrían.

## Autenticación: sin tokens

La publicación se autentica con **publicador de confianza** (trusted publishing, OIDC): npm acepta publicar a este repositorio y a este workflow concretos, sin token.

- Requisitos: `id-token: write` en el job (ya está) y que el fichero del workflow exista en `.github/workflows/` (ya existe).
- La provenance se genera **sola**; no hay que añadir `--provenance`.
- Configuración (una sola vez): `https://www.npmjs.com/package/repo-oc/access` → *Trusted Publisher* → GitHub Actions → owner `BIMpraxis`, repo `repo`, workflow `release.yml`, entorno vacío, permitir **`npm publish`**.
- Para administrar esa configuración hace falta `npm login` con 2FA una vez.

## Datos verificados del paquete

| Dato | Valor | Fuente |
|---|---|---|
| Nombre | `repo-oc` (sin scope) | `package.json` |
| Registro | `https://registry.npmjs.org/` (público) | `npm config get registry` |
| Responsable | `bimpraxis <juliopablo@bimpraxis.com>` | `npm view repo-oc maintainers` |
| Publicado a mano | 0.1.0 → 2026-09-16T23:37:33Z; 0.1.1 → 2026-09-17T00:08:19Z | `npm view repo-oc time --json` |
| Contenido del tarball 0.1.1 | `LICENSE`, `package.json`, ambos README y `bin/repo.mjs` | `npm pack repo-oc@0.1.1` |

## Vía de emergencia (publicar a mano)

Solo si el CI no está disponible:

1. `npm whoami` debe responder `bimpraxis`. Si da `E401`, ejecuta `npm login`.
2. `npm run check` (debe terminar en «todo en orden»).
3. `npm version patch` (o `minor`/`major`), revisando antes el CHANGELOG a mano.
4. `npm publish`.
5. `npm install -g repo-oc@latest; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force` para actualizar este equipo.

El token que había en `%USERPROFILE%\.npmrc` caducó (E401, verificado el 2026-09-17) y ya no hace falta para el flujo normal.

## Trampas conocidas

- `repo.cmd` apuntaba a un `repo.js` inexistente: se eliminó el 2026-09-17. El check de referencias `%~dp0` lo habría cazado.
- `install.cmd` / `install.js` no están en `files`: no viajan en el paquete de npm, solo sirven desde una copia local.
- En PowerShell, el shim `repo.ps1` que genera npm gana sobre `repo.cmd` y rompe colores y modo raw: de ahí el `Remove-Item` al instalar.
- `actions/setup-node` **no** debe llevar `registry-url` en el release: escribe un `.npmrc` con un token vacío y `@semantic-release/npm` falla con `EINVALIDNPMTOKEN` en lugar de usar OIDC. Comprobado en la primera ejecución (2026-09-17) y corregido.
- Node mínimo para el release: 22.22+, o 24.15+ (lo exigen dos plugins de `semantic-release`). El CI usa Node 24.
