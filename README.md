**English version: [README.en.md](README.en.md)**

# repo

Escribes `repo` en PowerShell, eliges un repositorio en un menú TUI y se abre `opencode --auto` en él, en la misma terminal. Al salir de OpenCode, la terminal se queda en la carpeta de ese repositorio.

https://github.com/user-attachments/assets/6ae0ea35-3f04-4c5f-b0ea-779160a3b612

## Cómo funciona

1. Lee las carpetas madre de `%USERPROFILE%\.repo\repoconfig.json`.
2. Muestra sus subcarpetas como `madre/repo` en un selector con ventana de 12 filas, filtro `Search:` y redibujado in situ.
3. Con `Intro` lanza `opencode --auto` con el repo elegido como directorio de trabajo. `Esc` cancela.
4. Al final de la lista hay una opción **«+ Nuevo repo…»**: eliges carpeta madre, escribes un nombre y se crea la carpeta; después se abre OpenCode en ella como en cualquier otro repo.
5. Al salir de OpenCode te quedas en la carpeta del repo elegido. El cambio lo hace una función `repo` que el instalador escribe en tu perfil de PowerShell: un proceso hijo no puede cambiar el directorio de su shell, así que lo cambia la propia shell al recuperar el control.

## Dependencias de la TUI

- **picocolors**: colores (`◆ ◇ ■ ❯ │ └`, verde/cian/atenuado). Única dependencia, instalada en local.
- **Node readline**: `keypress` en modo raw para flechas, `Intro`, `Esc` y filtrado por texto.
- El componente es un port a selección única de `searchMultiselect` (`src/prompts/search-multiselect.ts`) de [vercel-labs/skills](https://github.com/vercel-labs/skills): ventana fija con `↑/↓ N more`, cursor acotado sin wrap y conteo de filas visuales reales para el borrado del fotograma.
- Requiere **Node.js ≥ 22** y **PowerShell en Windows**. El shim `repo.ps1` que genera npm se borra en la instalación y, además, la función del perfil lo eclipsa aunque exista.

## Instalación

Se instala directamente desde GitHub: no hace falta cuenta ni registro de npm. Requiere **Node.js ≥ 22**, **Git** y **PowerShell** (Windows). Pega literalmente esta línea en PowerShell:

```powershell
npm install -g github:BIMpraxis/repo; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force -ErrorAction SilentlyContinue; repo --install
```

`repo --install` escribe en tu perfil de PowerShell (`$PROFILE`) un bloque con la función `repo`, que es la que deja la terminal en el repositorio elegido al salir de OpenCode. Es idempotente: si el bloque ya está, no lo duplica.

Después **abre una terminal nueva** (o ejecuta `. $PROFILE`): el perfil solo se carga al arrancar PowerShell.

- `repo --install --dry-run` muestra el bloque que se escribiría, sin escribir nada.
- `repo --uninstall` retira el bloque y deja el perfil como estaba.

Desde una copia local del repositorio (desarrollo):

```powershell
npm install -g .; repo --install
```

El comando `repo` queda disponible desde cualquier carpeta. Desde `cmd.exe` o con `powershell -NoProfile`, `repo` abre OpenCode pero la terminal no cambia de carpeta.

## Configuración

`%USERPROFILE%\.repo\repoconfig.json` (se autocrea vacía la primera vez). Rellénala **antes del primer `repo`**: si está vacía, el programa sale con «Sin carpetas madre».

```json
{ "roots": ["C:\\repos"] }
```

## Teclas

| Tecla | Acción              |
|-------|---------------------|
| `↑ ↓` | mover cursor        |
| texto | filtrar la lista    |
| `Intro` | abrir el repo en OpenCode |
| `Esc` | cancelar            |

## Desinstalación

```powershell
repo --uninstall; npm rm -g repo-oc
```

El orden importa: `repo --uninstall` retira el bloque del perfil y lo implementa el propio paquete, así que hay que ejecutarlo antes de desinstalar el paquete. Solo queda tu config en `%USERPROFILE%\.repo\`, bórrala si quieres.

## Licencia

MIT — ver [LICENSE](LICENSE).
