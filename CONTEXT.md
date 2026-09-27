# repo-oc

## Language

**Carpeta madre / madre**: directorio superior que contiene repositorios; la configuración apunta a madres, no a repos. _Avoid_: directorio raíz, carpeta base.

**Repo / repositorio**: carpeta concreta dentro de una madre donde se desarrolla un proyecto. La TUI lista `madre/repo`. _Avoid_: proyecto, módulo.

**Root / raíz**: carpeta madre concreta apuntada en `repoconfig.json`; singular de madres. _Avoid_: carpeta madre en plural.

**Elegido**: item seleccionado por el cursor en la TUI, confirmado con Intro. _Avoid_: seleccionado, marcado, target.

**Nuevo repo**: entrada al final del menú que crea una carpeta dentro de una carpeta madre y lanza OpenCode en ella. _Avoid_: crear repositorio, alta de repo.

**Función `repo`**: bloque que la instalación escribe en el perfil de PowerShell y que, tras cerrar OpenCode, deja la terminal en el directorio del repo elegido. _Avoid_: alias, envoltorio, wrapper.

**Fichero de destino**: fichero temporal en `%TEMP%` donde `repo` escribe la ruta elegida para que la función `repo` haga el `cd`; su nombre lleva el `PID` de la sesión. _Avoid_: fichero de traspaso, fichero de estado.

**Bloque del perfil**: fragmento del perfil de PowerShell delimitado por `# >>> repo-oc >>>` y `# <<< repo-oc <<<` que `repo --install` escribe y `repo --uninstall` retira. _Avoid_: sección, trozo de perfil.

**Lanzar**: ejecutar `opencode --auto` con el repo elegido como cwd actual del proceso hijo. _Avoid_: abrir (ambiguo en Windows entre icono/terminal), ejecutar (genérico).

**Publicar**: subir una versión al registro público de npm. Lo hace el CI al llegar cambios a `main`; a mano solo como emergencia. _Avoid_: desplegar.

**Release**: conjunto que produce una publicación: entrada en el CHANGELOG, tag `vX.Y.Z`, release en GitHub y versión en npm. _Avoid_: usar «publicación» para todo el conjunto.

**Publicador de confianza** (trusted publisher): permiso que npm concede a un workflow concreto de GitHub para publicar sin token, mediante OIDC. _Avoid_: token de automatización.

**Provenance** (atestación de procedencia): prueba firmada que npm genera sola al publicar por OIDC y que liga el paquete con el workflow que lo construyó. _Avoid_: firma, certificado.

**Shim**: envoltorio que npm crea en `%APPDATA%\npm` al instalar globalmente (`repo`, `repo.cmd`, `repo.ps1`). En PowerShell gana `repo.ps1` y hay que borrarlo; una vez instalada la **función `repo`**, esta lo eclipsa aunque exista. _Avoid_: wrapper, enlace, alias.

**Instalación desde Git**: instalar el CLI con `npm install -g github:BIMpraxis/repo`, sin registro ni cuenta; es la vía vigente. _Avoid_: instalación desde npm (en pausa).

## Relationships

- Una **carpeta madre** contiene uno o más **repositorios** (subcarpetas directas).
- Un **repositorio** pertenece a exactamente una **carpeta madre**.
- El proceso hijo hereda la terminal del **elegido** por la TUI; al terminar, la **función `repo`** deja la terminal en el directorio del repositorio **elegido**.
- El **fichero de destino** comunica la ruta del **elegido** desde el proceso hijo hasta la **función `repo`**.
- El **bloque del perfil** contiene la **función `repo`**.
- Un **release** agrupa una **publicación**, un tag y una entrada de CHANGELOG.
- Un **publicador de confianza** autoriza exactamente un workflow; sin él, la **publicación** desde el CI falla.
- Una **publicación** sube solo los archivos declarados en `files`; el resto del repositorio no viaja.
- Un **shim** es el punto de entrada del comando instalado; su variante `.ps1` rompe la TUI y la **función `repo`** lo eclipsa.

## Example dialogue

> **Dev:** ¿`repo` guarda la lista en algún sitio o se relee cada vez?  
> **Experto:** Se relee; `repoconfig.json` contiene solo las madres, y los repos se escanean en cada arranque.

> **Dev:** ¿Por qué no hace el `cd` el propio `repo.mjs`?  
> **Experto:** Porque un proceso hijo no puede cambiar el directorio de su shell; lo hace la **función `repo`** leyendo el **fichero de destino**.

> **Dev:** ¿Entonces publico yo el paquete cuando quiera sacar versión?  
> **Experto:** No: tú solo escribes el commit y lo subes a `main`. El **release** (versión, CHANGELOG, tag y **publicación**) lo hace el CI.

## Flagged ambiguities

- "instalar" puede significar `npm install -g repo-oc` (paquete de npm global) o `npm install . -g` (probar la copia local) — se resuelve por contexto.
