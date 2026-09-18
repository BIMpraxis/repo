**Versión en español: [README.md](README.md)**

# repo

Type `repo` in PowerShell, pick a repository from a TUI menu, and `opencode --auto` opens in it, in the same terminal.

<video src="docs/Demo_repo.mp4" controls width="100%"></video>

## How it works

1. Reads the parent folders from `%USERPROFILE%\.repo\repoconfig.json`.
2. Lists their subfolders as `parent/repo` in a selector with a 12-row window, `Search:` filter and in-place redraw.
3. `Enter` launches `opencode --auto` with the chosen repo as working directory. `Esc` cancels.
4. At the end of the list there is a **«+ Nuevo repo…»** option: pick a parent folder, type a name, and the folder is created; OpenCode then opens in it like in any other repo.
5. When you quit OpenCode you are back in your original folder (a child process cannot persist `cd` in the parent shell).

## TUI dependencies

- **picocolors**: colors (`◆ ◇ ■ ❯ │ └`, green/cyan/dim). Single dependency, installed locally.
- **Node readline**: raw-mode `keypress` for arrows, `Enter`, `Esc` and text filtering.
- The component is a single-select port of `searchMultiselect` (`src/prompts/search-multiselect.ts`) from [vercel-labs/skills](https://github.com/vercel-labs/skills): fixed window with `↑/↓ N more`, clamped cursor with no wrap, and real visual-row counting to erase each frame.
- Requires **Node.js ≥ 22**. No `.ps1` (the shim npm generates is removed on install).

## Install

It installs straight from GitHub: no npm account or registry needed. Requires **Node.js ≥ 22** and Git. Paste literally this line into PowerShell:

```powershell
npm install -g github:BIMpraxis/repo; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force
```

From a local copy of the repository (development):

```powershell
npm install -g .
```

The `repo` command becomes available from any folder.

## Configuration

`%USERPROFILE%\.repo\repoconfig.json` (auto-created empty on first run; add your parent folders):

```json
{ "roots": ["C:\\repos"] }
```

## Keys

| Key     | Action              |
|---------|---------------------|
| `↑ ↓`   | move cursor         |
| text    | filter the list     |
| `Enter` | open the repo in OpenCode |
| `Esc`   | cancel              |

## Uninstall

```powershell
npm rm -g repo-oc
```

Only your config remains in `%USERPROFILE%\.repo\`; delete it if you want.

## License

MIT — see [LICENSE](LICENSE).
