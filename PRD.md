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
   *Contrato irrenunciable*: la aplicación solo escribe en ese archivo al crearlo; después lo edita el humano a mano. Los otros dos ficheros que escribe el paquete (el de destino en `%TEMP%` y el perfil de PowerShell) están en la decisión 5.

4. **Instalación global con npm y borrado del shim `.ps1`**  
   npm deja en `%APPDATA%\npm` un envoltorio `repo.ps1` que PowerShell prefiere y que rompe los colores y el modo raw. Borrarlo forma parte del contrato de instalación documentado en el README. Con la función `repo` instalada (decisión 5) el shim queda además eclipsado, pero borrarlo sigue siendo el contrato.

5. **El `cd` lo hace la shell, no el proceso hijo**  
   Un proceso hijo no puede cambiar el directorio de la shell que lo lanzó (verificado). Por eso el paquete instala una función `repo` en el perfil de PowerShell: la función ejecuta `repo.cmd` como siempre y, al recuperar el control, lee la ruta elegida y hace `Set-Location`. La ruta viaja por un fichero en `%TEMP%` cuyo nombre lleva el `PID` de la sesión (o la ruta que indique la variable de entorno `REPO_OC_TARGET`), de modo que dos sesiones simultáneas no se pisan.  
   *Alternativas descartadas, con el motivo medido*:  
   - **Capturar la salida estándar** (TUI por `stderr`, ruta por `stdout`): PowerShell 5.1 decodifica la salida de los procesos nativos con la página de códigos OEM (`ibm850` en este equipo), así que una ruta con acentos llega corrupta (medido: una `ñ` llega como dos caracteres). Además obligaría a duplicar el camino de la TUI.  
   - **Lanzar `opencode` desde la función por su nombre**: en PowerShell resuelve al shim `opencode.ps1` de npm, no a `opencode.cmd` (medido), y cambiaría el binario que se ejecuta hoy.  
   - **Inyectar pulsaciones en la consola padre** (`AttachConsole` + `WriteConsoleInput`): escribe en el prompt de un shell en estado desconocido; frágil y sorprendente.  
   - **Un `repo.ps1` propio en `%APPDATA%\npm`**: npm lo sobrescribe en cada instalación; la función del perfil sobrevive.  
   - **Un fichero de transporte con nombre fijo**: dos sesiones simultáneas se pisaban (fallo detectado en pruebas); el nombre con `PID` lo elimina por diseño.  
   *Contratos y límites*:  
   - El bloque que se escribe en el perfil es **ASCII puro** a propósito: PowerShell 5.1 no detecta UTF-8 sin BOM, así que el bloque debe funcionar con cualquier codificación previa del fichero.  
   - Al escribir el perfil se preserva el BOM si ya existía y los finales de línea se normalizan a CRLF. `--install` es idempotente y `--uninstall` deja el fichero byte a byte como estaba, salvo el bloque.  
   - Solo funciona en **Windows + PowerShell**: desde `cmd.exe` o con `powershell -NoProfile` no hay `cd`, y el comportamiento es el anterior sin errores.  
   - La función se instala bajo demanda (`repo --install`), nunca durante `npm install`; `--uninstall` la retira y debe ejecutarse antes de desinstalar el paquete.  
   - El fichero de destino puede quedar huérfano si se cierra la ventana a lo bruto durante OpenCode; la propia sesión lo reescribe o lo borra en la siguiente ejecución.

## Distribución (contrato)
- **Vía vigente — instalación desde Git**: `npm install -g github:BIMpraxis/repo` (o `npm install -g .` desde una copia). No requiere registro, ni cuenta, ni autenticación.
- **Vía en pausa — registro npm**: paquete `repo-oc` sin scope; responsable `bimpraxis <juliopablo@bimpraxis.com>`. Publica GitHub Actions por OIDC con un «publicador de confianza», sin tokens.
- **Número de versión y CHANGELOG**: los calcula y escribe `semantic-release` a partir de los mensajes de commit (Conventional Commits). Mientras npm esté bloqueado, `release.yml` se lanza solo a mano.
- **Artefacto**: lo determina el campo `files` de `package.json` → `LICENSE`, ambos README y `bin/repo.mjs`. Nada más viaja en el paquete.
- **Verificación previa**: `npm run check` (script `scripts/check.mjs`) y el workflow `ci.yml`.
- **Runbook, estado y trampas**: `docs/RELEASE.md`.

## Estado actual
- Funcionalidad completa y **validada por el humano** (2026-09-17): la entrada «+ Nuevo repo…» funciona y la instalación desde Git (`npm install -g github:BIMpraxis/repo`) se verificó en un equipo real.
- Cambio de directorio al salir de OpenCode y flags `--install`, `--uninstall` y `--dry-run` **validados por el humano** (2026-09-27), incluidos dos sesiones simultáneas y una ruta con acentos.
- Instalación desde GitHub **validada por el humano** (2026-09-27): desinstalación y reinstalación siguiendo el `README.md` publicado, en este equipo.
- Vídeo demo en ambos README **validado por el humano** (2026-09-18): se sirve desde el CDN de GitHub (`user-attachments/assets/...`) como URL desnuda en su propio párrafo, que GitHub convierte en reproductor. *Alternativa descartada*: etiqueta `<video>` con ruta relativa a un `.mp4` commiteado — el sanitizador de GitHub la elimina y deja un párrafo vacío.
- Última versión publicada en npm: **0.1.1** (2026-09-17), a mano. La publicada por CI será la **0.2.0** cuando se reactive.
- **npm en pausa (2026-09-17)**: la cuenta está en solo lectura 72 h (lo dispara el uso de un código de recuperación de 2FA) y aún no existe el publicador de confianza. Por eso `release.yml` se lanza solo a mano.
- **Windows 10 con cuenta local** no ofrece la experiencia de passkeys de Windows 11: el challenge de 2FA con «Windows Hello» en Chrome se queda colgado. Alternativas sin coste, aún **sin probar**: intentarlo en Edge o guardar la passkey en el gestor de Chrome. Detalle en `docs/RELEASE.md`.

## Limitaciones actuales
- La TUI necesita una terminal interactiva: sin ella el programa sale con error a propósito, y no es automatizable sin una PTY, así que la interfaz se valida a mano.
- El `cd` al salir de OpenCode existe solo en **Windows + PowerShell** con la función instalada: en `cmd.exe`, en `bash` o con `powershell -NoProfile` se mantiene el comportamiento anterior.
- `install.cmd`/`install.js` (alta de la carpeta en el PATH del usuario) no viajan en el paquete de npm; solo sirven desde una copia local del repositorio.
- Publicar desde este PC sigue exigiendo `npm login` con 2FA: es la vía de emergencia, no la normal.

## Mejoras pendientes (no comprometidas)
- Comando `repo config` para editar `repoconfig.json` desde la TUI.
- Autocompletado de bash/zsh/fish para nombres de repo.
- Pruebas automáticas de la TUI con una PTY.
- Equivalente del `cd` para `cmd.exe`, que queda fuera por ahora.
- Probar la instalación en un equipo con PowerShell 7 (`pwsh`) instalado; aquí solo hay Windows PowerShell 5.1.

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
