# PRD — repo-oc

## Propósito
CLI (`repo`) que presenta un menú TUI con los repositorios registrados bajo carpetas madre configuradas, permite filtrar/seleccionar uno y lanza `opencode --auto` en ese directorio. Cero configuración por repo: la presencia de la carpeta basta.

## Decisiones clave y porqués
1. **Node ≥ 22 + ESM + `picocolors` como única dependencia de ejecución**  
   Evita toolchain (TypeScript, bundlers). `picocolors` no tiene dependencias y funciona en Windows sin extras ANSI.  
   *Alternativa descartada*: `ink`/`react` — añade 30+ dependencias y un paso de compilación.

2. **UI propia sobre `readline`, no `fzf`/`skim`**  
   Binario externo no portable a Windows sin WSL; `readline` nativo cubre el caso. El dibujo concreto del menú (ventana, filtro, repintado) es cosa del código.

3. **Config en `%USERPROFILE%\.repo\repoconfig.json`**  
   Ubicación por usuario, no por proyecto. JSON simple `{ roots: string[] }`. Se autocrea vacío en el primer arranque.  
   *Contrato irrenunciable*: la aplicación solo escribe en ese archivo al crearlo; después lo edita el humano a mano.

4. **Instalación global con npm y borrado del shim `.ps1`**  
   npm deja en `%APPDATA%\npm` un envoltorio `repo.ps1` que PowerShell prefiere y que rompe los colores y el modo raw. Borrarlo forma parte del contrato de instalación documentado en el README.

5. **Sin `cd` persistente**  
   Un proceso hijo no puede cambiar el directorio de la shell desde la que se lanzó: al cerrar OpenCode vuelves a tu carpeta original. Por eso existe el menú y se lanza como proceso hijo en lugar de cambiar de carpeta.

## Distribución (contrato)
- **Registro**: npm público, paquete `repo-oc` sin scope; responsable `bimpraxis <juliopablo@bimpraxis.com>`.
- **Quién publica**: GitHub Actions, autenticándose por OIDC con un «publicador de confianza». No hay ningún token de npm guardado (ni aquí ni en GitHub).
- **Número de versión y CHANGELOG**: los calcula y escribe `semantic-release` a partir de los mensajes de commit (Conventional Commits). El tag `vX.Y.Z` y la release de GitHub salen del mismo proceso.
- **Artefacto**: lo determina el campo `files` de `package.json` → `LICENSE`, ambos README y `bin/repo.mjs`. Nada más viaja en el paquete.
- **Verificación previa**: `npm run check` (script `scripts/check.mjs`) y el workflow `ci.yml`.
- **Runbook y vía de emergencia**: `docs/RELEASE.md`.

## Estado actual
- Última versión publicada: **0.1.1** (2026-09-17), publicada a mano.
- La primera versión publicada por el CI será la **0.2.0**.
- Automatización: `ci.yml` (comprobaciones en cada push y PR) y `release.yml` (versión + CHANGELOG + tag + publicación).

## Limitaciones actuales
- La TUI necesita una terminal interactiva: sin ella el programa sale con error a propósito, y no es automatizable sin una PTY, así que la interfaz se valida a mano.
- `install.cmd`/`install.js` (alta de la carpeta en el PATH del usuario) no viajan en el paquete de npm; solo sirven desde una copia local del repositorio.
- Publicar desde este PC sigue exigiendo `npm login` con 2FA: es la vía de emergencia, no la normal.

## Mejoras pendientes (no comprometidas)
- Comando `repo config` para editar `repoconfig.json` desde la TUI.
- Autocompletado de bash/zsh/fish para nombres de repo.
- Pruebas automáticas de la TUI con una PTY.
