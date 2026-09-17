# Release y distribución — repo-oc

Cómo se distribuye y cómo se publica el paquete. Complementa `PRD.md` (motivos y contratos) y `CONTEXT.md` (glosario).

## Vía vigente: instalar desde Git (sin npm)

No hace falta cuenta ni registro. Requiere Node ≥ 22 y Git:

```powershell
npm install -g github:BIMpraxis/repo; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force
```

Desde una copia local (desarrollo): `npm install -g .`

Ventaja: cero autenticación. El precio es que la instalación baja el repositorio completo y no hay número de versión en el registro.

## Estado de la publicación en npm (en pausa)

- Última versión publicada: **0.1.1** (2026-09-17), a mano. La siguiente será la **0.2.0**, que ya incluye la entrada «+ Nuevo repo…».
- **Motivo de la pausa**: la cuenta npm está en solo lectura durante 72 h. Lo dispara el uso de un **código de recuperación de 2FA** (protección preventiva de npm, documentada en el GitHub Changelog del 25/06/2026). Se levanta sola, sin trámites.
- **Segundo impedimento**: todavía no existe el **publicador de confianza**, que hay que crear una vez desde el navegador con 2FA.
- Por eso `release.yml` se lanza **solo a mano** (`workflow_dispatch`) y no en cada push: evita ejecuciones en rojo mientras falte el publicador. Cuando exista, se le devuelve el disparo por push a `main`.

## Trampa de 2FA detectada (Windows 10, cuenta local)

El challenge de 2FA de npm con «Windows Hello» en Chrome se queda colgado en «Estamos comprobando que eres tú». Causas comprobadas:

- El equipo es **Windows 10** y la cuenta de Windows es **local** (`BIMPRAXIS2\USER`). La experiencia nativa de passkeys (Ajustes → Cuentas → Passkeys) es de **Windows 11**; el correo de Windows no influye en nada.
- El bloqueo de 72 h **solo** lo disparan el cambio de email y el uso de un código de recuperación. Reintentar el challenge **no** lo reinicia.

Alternativas baratas, **sin probar todavía**: hacer el challenge en Edge en lugar de Chrome, o guardar la passkey en el gestor de Chrome (requiere cuenta de Google). La vía oficial para problemas de 2FA es un ticket en `https://www.npmjs.com/support`.

## Quién hace qué cuando se reactive npm

| Pieza | Fichero | Qué hace |
|---|---|---|
| Comprobaciones | `scripts/check.mjs` (`npm run check`) | Sintaxis, `bin` existente, referencias `%~dp0` sin destino, salida sin terminal, contenido exacto del paquete y versión ↔ CHANGELOG |
| Verificación continua | `.github/workflows/ci.yml` | Ejecuta lo anterior en cada push y en cada PR |
| Release | `.github/workflows/release.yml` | Versión + CHANGELOG + tag + publicación por OIDC + release de GitHub |
| Configuración | `.releaserc.json` | Orden de los pasos de `semantic-release` |

Las herramientas de `semantic-release` **no** están en `devDependencies`: el workflow las instala con `npm install --no-save` para que la instalación desde Git siga siendo ligera (solo `picocolors`).

## Autenticación: sin tokens

La publicación se autentica con **publicador de confianza** (trusted publishing, OIDC): npm acepta publicar a este repositorio y a este workflow concretos, sin token.

- Requisitos: `id-token: write` en el job (ya está) y que el fichero del workflow exista en `.github/workflows/` (ya existe).
- La provenance se genera **sola**; no hay que añadir `--provenance`.
- Configuración (una sola vez): `https://www.npmjs.com/package/repo-oc/access` → *Trusted Publisher* → GitHub Actions → owner `BIMpraxis`, repo `repo`, workflow `release.yml`, entorno vacío, permitir **`npm publish`**. Ojo: los campos no se pueden editar después.

## Datos verificados del paquete

| Dato | Valor | Fuente |
|---|---|---|
| Nombre | `repo-oc` (sin scope) | `package.json` |
| Registro | `https://registry.npmjs.org/` (público) | `npm config get registry` |
| Responsable | `bimpraxis <juliopablo@bimpraxis.com>` | `npm view repo-oc maintainers` |
| Publicado a mano | 0.1.0 → 2026-09-16T23:37:33Z; 0.1.1 → 2026-09-17T00:08:19Z | `npm view repo-oc time --json` |
| Contenido del tarball 0.1.1 | `LICENSE`, `package.json`, ambos README y `bin/repo.mjs` | `npm pack repo-oc@0.1.1` |

## Trampas conocidas

- `repo.cmd` apuntaba a un `repo.js` inexistente: se eliminó el 2026-09-17. El check de referencias `%~dp0` lo habría cazado.
- `install.cmd` / `install.js` no están en `files`: no viajan en el paquete de npm, solo sirven desde una copia local.
- En PowerShell, el shim `repo.ps1` que genera npm gana sobre `repo.cmd` y rompe colores y modo raw: de ahí el `Remove-Item` al instalar.
- `actions/setup-node` **no** debe llevar `registry-url` en el release: escribe un `.npmrc` con un token vacío y `@semantic-release/npm` falla con `EINVALIDNPMTOKEN` en lugar de usar OIDC. Comprobado en la primera ejecución (2026-09-17) y corregido.
- Node mínimo para el release: 22.22+, o 24.15+ (lo exigen dos plugins de `semantic-release`). El CI usa Node 24.
