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
- **Vía vigente — instalación desde Git**: `npm install -g github:BIMpraxis/repo` (o `npm install -g .` desde una copia). No requiere registro, ni cuenta, ni autenticación.
- **Vía en pausa — registro npm**: paquete `repo-oc` sin scope; responsable `bimpraxis <juliopablo@bimpraxis.com>`. Publica GitHub Actions por OIDC con un «publicador de confianza», sin tokens.
- **Número de versión y CHANGELOG**: los calcula y escribe `semantic-release` a partir de los mensajes de commit (Conventional Commits). Mientras npm esté bloqueado, `release.yml` se lanza solo a mano.
- **Artefacto**: lo determina el campo `files` de `package.json` → `LICENSE`, ambos README y `bin/repo.mjs`. Nada más viaja en el paquete.
- **Verificación previa**: `npm run check` (script `scripts/check.mjs`) y el workflow `ci.yml`.
- **Runbook, estado y trampas**: `docs/RELEASE.md`.

## Estado actual
- Funcionalidad completa y **validada por el humano** (2026-09-17): la entrada «+ Nuevo repo…» funciona y la instalación desde Git (`npm install -g github:BIMpraxis/repo`) se verificó en un equipo real.
- Última versión publicada en npm: **0.1.1** (2026-09-17), a mano. La publicada por CI será la **0.2.0** cuando se reactive.
- **npm en pausa (2026-09-17)**: la cuenta está en solo lectura 72 h (lo dispara el uso de un código de recuperación de 2FA) y aún no existe el publicador de confianza. Por eso `release.yml` se lanza solo a mano.
- **Windows 10 con cuenta local** no ofrece la experiencia de passkeys de Windows 11: el challenge de 2FA con «Windows Hello» en Chrome se queda colgado. Alternativas sin coste, aún **sin probar**: intentarlo en Edge o guardar la passkey en el gestor de Chrome. Detalle en `docs/RELEASE.md`.

## Limitaciones actuales
- La TUI necesita una terminal interactiva: sin ella el programa sale con error a propósito, y no es automatizable sin una PTY, así que la interfaz se valida a mano.
- `install.cmd`/`install.js` (alta de la carpeta en el PATH del usuario) no viajan en el paquete de npm; solo sirven desde una copia local del repositorio.
- Publicar desde este PC sigue exigiendo `npm login` con 2FA: es la vía de emergencia, no la normal.

## Mejoras pendientes (no comprometidas)
- Comando `repo config` para editar `repoconfig.json` desde la TUI.
- Autocompletado de bash/zsh/fish para nombres de repo.
- Pruebas automáticas de la TUI con una PTY.

## Regla de guiado de interfaces (informe de negligencia, 2026-09-17)

**Qué pasó.** El objetivo era registrar el «publicador de confianza» de npm desde el navegador. El agente dio instrucciones de interfaz sin comprobar la página real que el usuario tenía delante:

- Una URL con `?activeTab=settings` que abría el README en lugar de los ajustes.
- Un botón «Settings» que el usuario ya tenía abierto.
- Un botón «Guardar» que no existía: el real era **«Set up connection»**.
- Un enlace de código de recuperación que no estaba a la vista (quedaba fuera del área visible).
- En total, el usuario tuvo que enviar una captura por paso para corregir cada instrucción.

Además, el agente recomendó el camino del teléfono con QR y, antes, había indicado usar un **código de recuperación** sin advertir que npm aplica **72 horas de solo lectura** por ese motivo. El resultado fue la cuenta npm bloqueada temporalmente.

**Causa raíz.**

1. Improvisar instrucciones desde la memoria en lugar de verificarlas en fuentes primarias.
2. Confundir «lo que sé del producto» con «lo que hay en la pantalla del usuario».
3. Proponer atajos de autenticación sin evaluar sus consecuencias.
4. Trasladar al usuario el coste de verificar cada paso.

**Impacto.** Tiempo perdido en una tarea de minutos, publicación en pausa y cuenta en solo lectura 72 h.

**Reglas permanentes (contrato irrenunciable).**

1. Ninguna instrucción sobre una interfaz sin haber verificado antes la documentación oficial de esa pantalla concreta. Si no se puede verificar, se dice y no se pulsa nada.
2. Las acciones de autenticación (códigos de recuperación, QR, passkeys, solicitudes de 2FA) nunca se proponen como atajo; antes de sugerirlas se advierte por escrito de su efecto.
3. Si lo que el usuario ve no coincide con lo descrito, se detiene el flujo: no hay intentos a ciegas ni «prueba esto otro».
4. En tareas de interfaz, un único paso por mensaje, con el texto literal del control y su ubicación (sección y posición en la página), nunca descripciones genéricas.
5. Todo paso de interfaz declara antes qué cambia y qué riesgo tiene. Si el riesgo es de seguridad o irreversible, exige confirmación explícita previa.
6. El agente no delega en el usuario la verificación de sus propias instrucciones.

## Convenciones de repositorio

- Los traspasos (`handoff_*.md`) **se commitean**: no se ignoran en `.gitignore`, no se borran automáticamente y no se pregunta por ello.
