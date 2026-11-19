**English version: [README.en.md](README.en.md)**

# repo

Escribes `repo` en PowerShell, eliges un repositorio en un menú TUI y se abre `opencode --auto` en él, en la misma terminal. Al salir de OpenCode, la terminal se queda en la carpeta de ese repositorio.

https://github.com/user-attachments/assets/6ae0ea35-3f04-4c5f-b0ea-779160a3b612

## Cómo funciona

1. Lee las carpetas madre y los accesos directos de `%USERPROFILE%\.repo\repoconfig.json`.
2. Muestra sus subcarpetas como `madre/repo` en un selector con ventana de 12 filas, filtro `Search:` y redibujado in situ. Desplazar el cursor enseña la ruta real del elemento resaltado.
3. Con `Intro` lanza `opencode --auto` con el repo elegido como directorio de trabajo. `Esc` cancela.
4. Al final de la lista hay una opción **«+ Nuevo repo…»**: eliges carpeta madre, escribes un nombre y se crea la carpeta; después se abre OpenCode en ella como en cualquier otro repo.
5. Al salir de OpenCode te quedas en la carpeta del repo elegido. El cambio lo hace una función `repo` que el instalador escribe en tu perfil de PowerShell: un proceso hijo no puede cambiar el directorio de su shell, así que lo cambia la propia shell al recuperar el control.

### Repositorios en la red

El menú **no consulta la red para dibujarse**. Con el servidor apagado, `repo` arranca igual de rápido y sigues eligiendo entre tus repositorios locales.

- **Accesos directos**: una entrada de `shortcuts` es una dirección con nombre. Aparece en el menú aunque el servidor esté caído, sin comprobar que exista.
- **Catálogo local**: `%USERPROFILE%\.repo\network-catalog.json` guarda solo nombres, rutas y fecha de la última actualización correcta. Se lee desde el disco y no se valida contra la red.
- **Actualizar carpetas de red**: `repo --refresh-network-catalog` es la única acción que enumera las raíces remotas. Si una falla, conserva lo que ya tenía guardado.

Al abrir un repositorio de red, `repo` crea una unidad temporal con `pushd`, lanza OpenCode dentro de ella y la libera con `popd` al terminar. CMD no admite una ruta UNC como directorio actual: sin esto, OpenCode arrancaría en `C:\Windows`. Si la unidad no se puede preparar, no se abre nada y el aviso queda en pantalla.

Esto no acelera OpenCode sobre los archivos remotos: una vez abierto, sigue trabajando con ellos en su ubicación original.

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
- `repo --refresh-network-catalog` actualiza el catálogo local de carpetas de red. Solo se ejecuta cuando lo pides.

Se instala en el perfil de cada PowerShell que encuentre en el `PATH` (`powershell` y `pwsh`), por eso el mismo estado puede aparecer dos veces, una por host.

Desde una copia local del repositorio (desarrollo):

```powershell
npm install -g .; repo --install
```

El comando `repo` queda disponible desde cualquier carpeta. Desde `cmd.exe` o con `powershell -NoProfile`, `repo` abre OpenCode pero la terminal no cambia de carpeta.

## Configuración

`%USERPROFILE%\.repo\repoconfig.json` (se autocrea vacía la primera vez). Rellénala **antes del primer `repo`**: si no hay ninguna entrada, el programa sale con «Sin entradas que mostrar».

```json
{
  "roots": ["C:\\_repos", "C:\\_pros"],
  "shortcuts": [
    {
      "name": "Scripts AutoCAD",
      "path": "\\\\servidor\\recurso\\Scripts AutoCAD"
    }
  ]
}
```

- `roots`: carpetas madre locales cuyas subcarpetas se listan como `madre/repo`. Se conserva el formato anterior; una raíz de red aquí nunca se enumera al dibujar el menú.
- `shortcuts` (opcional): pares `name` y `path`. El nombre es lo que ves en el menú; la ruta es la dirección exacta que se abre. No se comprueba que exista.

Los duplicados se resuelven por ruta: mandan los accesos directos, después los repositorios locales y por último el catálogo. Si dos rutas distintas comparten nombre, se conservan las dos.

Para que los repositorios de una carpeta madre de red aparezcan sin escribir accesos uno a uno, ejecuta `repo --refresh-network-catalog` cuando la red esté disponible.

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

## Verificación

```powershell
npm run check
```

Ejecuta las pruebas (lógica del menú, lanzamiento y arranque real de la TUI con terminal simulada), compila los módulos y valida el contenido del paquete y la coherencia entre `package.json` y `CHANGELOG.md`.

## Licencia

MIT — ver [LICENSE](LICENSE).
