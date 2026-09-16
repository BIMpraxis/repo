**Versión en español: [README.md](README.md)**

# repo

Type `repo` in PowerShell, pick a repository from a TUI menu, and `opencode --auto` opens in it, in the same terminal.

## How it works

1. Reads the parent folders from `%USERPROFILE%\.repo\repoconfig.json`.
2. Lists their subfolders as `parent/repo` in a selector with a 12-row window, `Search:` filter and in-place redraw.
3. `Enter` launches `opencode --auto` with the chosen repo as working directory. `Esc` cancels.
4. When you quit OpenCode you are back in your original folder (a child process cannot persist `cd` in the parent shell).

## TUI dependencies

- **picocolors**: colors (`◆ ◇ ■ ❯ │ └`, green/cyan/dim). Single dependency, installed locally.
- **Node readline**: raw-mode `keypress` for arrows, `Enter`, `Esc` and text filtering.
- The component is a single-select port of `searchMultiselect` (`src/prompts/search-multiselect.ts`) from [vercel-labs/skills](https://github.com/vercel-labs/skills): fixed window with `↑/↓ N more`, clamped cursor with no wrap, and real visual-row counting to erase each frame.
- Requires **Node.js ≥ 22**. No `.ps1`, no global npm install.

## Install

```
double-click install.cmd   (or: node install.js)
```

Adds this folder to the user PATH (idempotent, edits the registry without truncating). Close and reopen the terminal.

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

Remove this folder from the user PATH and delete it. Nothing else is left behind (the config lives in `%USERPROFILE%\.repo\`).

## License

MIT — see [LICENSE](LICENSE).
