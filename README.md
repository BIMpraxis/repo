# repo

Escribes `repo` en PowerShell, eliges un repositorio en un menú TUI y se abre `opencode --auto` en él, en la misma terminal.

## Cómo funciona

1. Lee las carpetas madre de `%USERPROFILE%\.repo\repoconfig.json`.
2. Muestra sus subcarpetas como `madre/repo` en un selector con ventana de 12 filas, filtro `Search:` y redibujado in situ.
3. Con `Intro` lanza `opencode --auto` con el repo elegido como directorio de trabajo. `Esc` cancela.
4. Al salir de OpenCode vuelves a tu carpeta original (un proceso hijo no puede hacer `cd` persistente en la shell padre).

## Dependencias de la TUI

- ** AXVKRGWJKW**: colores (`◆ ◇ ■ ❯ │ └`, verde/cian/atenuado). Única dependencia, instalada en local.
- **UXSR 9OVUSSGUO**: `keypress` en modo raw para flechas, `Intro`, `Esc` y filtrado por texto.
- El componente es un port a selección única de `searchMultiselect` (`src/prompts/search-multiselect.ts`) de [vercel-labs/skills](https://github.com/vercel-labs/skills): ventana fija con `↑/↓ N more`, cursor acotado sin wrap y conteo de filas visuales reales para el borrado del fotograma.
- Requiere **Node.js ≥ 22**. Sin `.ps1`, sin instalación global de npm.

## Instalación

```
doble clic en install.cmd   (o: node install.js)
```

Añade esta carpeta al PATH de usuario (idempotente, edita el registro sin truncar) e instala `picocolors` si falta (`npm install`). Cierra y reabre la terminal.

## Configuración

`%USERPROFILE%\.repo\repoconfig.json` (se autocrea con estos valores la primera vez):

```json
{ "roots": ["D:\\repos-bimpraxis", "D:\\repos-idom"] }
```

## Teclas

| Tecla | Acción              |
|-------|---------------------|
| `↑ ↓` | mover cursor        |
| texto | filtrar la lista    |
| `Intro` | abrir el repo en OpenCode |
| `Esc` | cancelar            |

## Desinstalación

Quita esta carpeta del PATH de usuario y bórrala. No deja nada más (la config vive en `%USERPROFILE%\.repo\`).
