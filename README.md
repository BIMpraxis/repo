**English version: [README.en.md](README.en.md)**

# repo

Escribes `repo` en PowerShell, eliges un repositorio en un menú TUI y se abre `opencode --auto` en él, en la misma terminal.

<video src="docs/Demo_repo.mp4" controls width="100%"></video>

## Cómo funciona

1. Lee las carpetas madre de `%USERPROFILE%\.repo\repoconfig.json`.
2. Muestra sus subcarpetas como `madre/repo` en un selector con ventana de 12 filas, filtro `Search:` y redibujado in situ.
3. Con `Intro` lanza `opencode --auto` con el repo elegido como directorio de trabajo. `Esc` cancela.
4. Al final de la lista hay una opción **«+ Nuevo repo…»**: eliges carpeta madre, escribes un nombre y se crea la carpeta; después se abre OpenCode en ella como en cualquier otro repo.
5. Al salir de OpenCode vuelves a tu carpeta original (un proceso hijo no puede hacer `cd` persistente en la shell padre).

## Dependencias de la TUI

- **picocolors**: colores (`◆ ◇ ■ ❯ │ └`, verde/cian/atenuado). Única dependencia, instalada en local.
- **Node readline**: `keypress` en modo raw para flechas, `Intro`, `Esc` y filtrado por texto.
- El componente es un port a selección única de `searchMultiselect` (`src/prompts/search-multiselect.ts`) de [vercel-labs/skills](https://github.com/vercel-labs/skills): ventana fija con `↑/↓ N more`, cursor acotado sin wrap y conteo de filas visuales reales para el borrado del fotograma.
- Requiere **Node.js ≥ 22**. Sin `.ps1` (la cuña que genera npm se elimina en la instalación).

## Instalación

Se instala directamente desde GitHub: no hace falta cuenta ni registro de npm. Requiere **Node.js ≥ 22** y Git. Pega literalmente esta línea en PowerShell:

```powershell
npm install -g github:BIMpraxis/repo; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force
```

Desde una copia local del repositorio (desarrollo):

```powershell
npm install -g .
```

El comando `repo` queda disponible desde cualquier carpeta.

## Configuración

`%USERPROFILE%\.repo\repoconfig.json` (se autocrea vacía la primera vez; añade tus carpetas madre):

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
npm rm -g repo-oc
```

Solo queda tu config en `%USERPROFILE%\.repo\`, bórrala si quieres.

## Licencia

MIT — ver [LICENSE](LICENSE).
