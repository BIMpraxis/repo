**Versión en español: [README.md](README.md)**

# repo

Type `repo` in PowerShell, pick a repository from a TUI menu, and `opencode --auto` opens in it, in the same terminal. When you quit OpenCode, the terminal stays in that repository's folder.

https://github.com/user-attachments/assets/6ae0ea35-3f04-4c5f-b0ea-779160a3b612

## How it works

1. Reads the parent folders from `%USERPROFILE%\.repo\repoconfig.json`.
2. Lists their subfolders as `parent/repo` in a selector with a 12-row window, `Search:` filter and in-place redraw.
3. `Enter` launches `opencode --auto` with the chosen repo as working directory. `Esc` cancels.
4. At the end of the list there is a **«+ Nuevo repo…»** option: pick a parent folder, type a name, and the folder is created; OpenCode then opens in it like in any other repo.
5. When you quit OpenCode the terminal stays in the chosen repo's folder. The change is made by a `repo` function that the installer writes into your PowerShell profile: a child process cannot change its shell's directory, so the shell itself changes it when it regains control.

## TUI dependencies

- **picocolors**: colors (`◆ ◇ ■ ❯ │ └`, green/cyan/dim). Single dependency, installed locally.
- **Node readline**: raw-mode `keypress` for arrows, `Enter`, `Esc` and text filtering.
- The component is a single-select port of `searchMultiselect` (`src/prompts/search-multiselect.ts`) from [vercel-labs/skills](https://github.com/vercel-labs/skills): fixed window with `↑/↓ N more`, clamped cursor with no wrap, and real visual-row counting to erase each frame.
- Requires **Node.js ≥ 22** and **PowerShell on Windows**. The `repo.ps1` shim npm generates is removed on install and, besides, the profile function shadows it even if it exists.

## Install

It installs straight from GitHub: no npm account or registry needed. Requires **Node.js ≥ 22**, **Git** and **PowerShell** (Windows). Paste literally this line into PowerShell:

```powershell
npm install -g github:BIMpraxis/repo; Remove-Item "$env:APPDATA\npm\repo.ps1" -Force -ErrorAction SilentlyContinue; repo --install
```

`repo --install` writes a block with the `repo` function into your PowerShell profile (`$PROFILE`); that function is what leaves the terminal in the chosen repository when you quit OpenCode. It is idempotent: if the block is already there, it is not duplicated.

Then **open a new terminal** (or run `. $PROFILE`): the profile is only loaded when PowerShell starts.

- `repo --install --dry-run` shows the block without writing anything.
- `repo --uninstall` removes the block and leaves the profile as it was.

From a local copy of the repository (development):

```powershell
npm install -g .; repo --install
```

The `repo` command becomes available from any folder. From `cmd.exe` or with `powershell -NoProfile`, `repo` opens OpenCode but the terminal does not change folder.

## Configuration

`%USERPROFILE%\.repo\repoconfig.json` (auto-created empty on first run). Fill it in **before the first `repo`**: if it is empty, the program exits with «Sin carpetas madre». Example:

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
repo --uninstall; npm rm -g repo-oc
```

Order matters: `repo --uninstall` removes the profile block and is implemented by the package itself, so it must run before uninstalling the package. Only your config remains in `%USERPROFILE%\.repo\`; delete it if you want.

## License

MIT — see [LICENSE](LICENSE).
