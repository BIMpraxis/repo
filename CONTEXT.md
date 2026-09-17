# repo-oc

## Language

**Carpeta madre / madre**: directorio superior que contiene repositorios; la configuración apunta a madres, no a repos. _Avoid_: directorio raíz, carpeta base.

**Repo / repositorio**: carpeta concreta dentro de una madre donde se desarrolla un proyecto. La TUI lista `madre/repo`. _Avoid_: proyecto, módulo.

**Root / raíz**: carpeta madre concreta apuntada en `repoconfig.json`; singular de madres. _Avoid_: carpeta madre en plural.

**Elegido**: item seleccionado por el cursor en la TUI, confirmado con Intro. _Avoid_: seleccionado, marcado, target.

**Nuevo repo**: entrada al final del menú que crea una carpeta dentro de una carpeta madre y lanza OpenCode en ella. _Avoid_: crear repositorio, alta de repo.

**Lanzar**: ejecutar `opencode --auto` con el repo elegido como cwd actual del proceso hijo. _Avoid_: abrir (ambiguo en Windows entre icono/terminal), ejecutar (genérico).

**Publicar**: subir una versión al registro público de npm. Lo hace el CI al llegar cambios a `main`; a mano solo como emergencia. _Avoid_: desplegar.

**Release**: conjunto que produce una publicación: entrada en el CHANGELOG, tag `vX.Y.Z`, release en GitHub y versión en npm. _Avoid_: usar «publicación» para todo el conjunto.

**Publicador de confianza** (trusted publisher): permiso que npm concede a un workflow concreto de GitHub para publicar sin token, mediante OIDC. _Avoid_: token de automatización.

**Provenance** (atestación de procedencia): prueba firmada que npm genera sola al publicar por OIDC y que liga el paquete con el workflow que lo construyó. _Avoid_: firma, certificado.

**Shim**: envoltorio que npm crea en `%APPDATA%\npm` al instalar globalmente (`repo`, `repo.cmd`, `repo.ps1`). En PowerShell gana `repo.ps1` y hay que borrarlo. _Avoid_: wrapper, enlace, alias.

**Instalación desde Git**: instalar el CLI con `npm install -g github:BIMpraxis/repo`, sin registro ni cuenta; es la vía vigente. _Avoid_: instalación desde npm (en pausa).

## Relationships

- Una **carpeta madre** contiene uno o más **repositorios** (subcarpetas directas).
- Un **repositorio** pertenece a exactamente una **carpeta madre**.
- El proceso hijo hereda la terminal del proceso **elegido** por la TUI; al terminar, vuelve el control a la terminal original.
- Un **release** agrupa una **publicación**, un tag y una entrada de CHANGELOG.
- Un **publicador de confianza** autoriza exactamente un workflow; sin él, la **publicación** desde el CI falla.
- Una **publicación** sube solo los archivos declarados en `files`; el resto del repositorio no viaja.
- Un **shim** es el único punto de entrada del comando instalado, y su variante `.ps1` rompe la TUI.

## Example dialogue

> **Dev:** ¿`repo` guarda la lista en algún sitio o se relee cada vez?  
> **Experto:** Se relee; `repoconfig.json` contiene solo las madres, y los repos se escanean en cada arranque.

> **Dev:** ¿Entonces publico yo el paquete cuando quiera sacar versión?  
> **Experto:** No: tú solo escribes el commit y lo subes a `main`. El **release** (versión, CHANGELOG, tag y **publicación**) lo hace el CI.

## Flagged ambiguities

- "instalar" puede significar `npm install -g repo-oc` (paquete de npm global) o `npm install . -g` (probar la copia local) — se resuelve por contexto.
