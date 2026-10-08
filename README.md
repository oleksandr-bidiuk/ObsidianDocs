**English** | [Русский](README.ru.md)

# Canvas Code Links

Link Canvas cards and notes straight to a line of source code. Write `[Player](../src/Player.cs#L105)` and a click opens the file at that line in VS Code, Cursor, Rider or Obsidian. Built for documenting a game or any code base that lives next to your vault.

Works on desktop and on mobile (iOS / Android).

## Features

- **Relative paths.** Links are resolved from the folder of the current `.canvas` / note first, then from the vault root. Links stay portable across Windows, macOS and Linux.
- **Exact line and column.** `:42`, `:42:15`, `#L42`, `#L42C10`.
- **Several editors.** VS Code (also Insiders), Cursor, JetBrains Rider, Obsidian itself, or your own URI / CLI template.
- **Insert Code Link command.** Builds a link from the clipboard (`path:line`), computes the relative path and checks the file exists.
- **Badges.** Code links in Canvas cards and notes get an icon and tooltip.
- **Mobile.** Built-in read-only code viewer, or open your repository on the web (GitHub, GitLab, github.dev).

## Link syntax

| Format | Example |
|---|---|
| Line | `[script.cs:42](./scripts/script.cs:42)` |
| Line and column | `[script.cs](./scripts/script.cs:42:15)` |
| GitHub style | `[Player.cs](../src/Player.cs#L105)` |
| Explicit scheme | `[script.cs](code:./src/script.cs:50)` |
| Wikilink | `[[./scripts/script.cs:42]]` |
| Obsidian URI | `obsidian://canvas-code-link?file=./script.cs&line=42` |

A link is treated as code when it has a recognized extension (configurable) or an explicit `code:` / `file://` / `vscode://file/` prefix.

## Installation

Until the plugin is available in the community list, install it manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest).
2. Copy them to `<vault>/.obsidian/plugins/canvas-code-links/`.
3. In Obsidian: **Settings → Community plugins**, turn off Restricted mode, reload, and enable **Canvas Code Links**.

On mobile, sync the vault (including the `.obsidian` folder) with Obsidian Sync, iCloud, Syncthing or similar, then enable the plugin on the phone.

## Mobile

A phone cannot launch desktop editors, so choose a mode in **Settings → Canvas Code Links → Mobile**:

| Mode | What it does |
|---|---|
| Built-in code viewer (default) | Shows the file with the target line highlighted. Works offline. |
| Open web URL | Opens a repository URL built from a template, e.g. `https://github.com/OWNER/REPO/blob/main/{relpath}#L{line}` |

The code must be inside the vault (for example a game repo synced with Obsidian Git). Links in the editor are followed with Ctrl/Cmd+click, so on a phone use reading view or rendered Canvas cards.

## Settings

- **Default Code Editor**, plus custom URI and CLI templates (`{path}`, `{uripath}`, `{line}`, `{col}`).
- **Preferred path resolution root** and **fallback resolution**.
- **Recognized code file extensions.**
- **Decorate code links** and **show notification on open.**
- **Mobile open mode** and **web URL template.**

## Privacy and disclosures

- **No telemetry, no accounts, no ads.**
- **Network:** the plugin makes no requests of its own. In *Open web URL* mode on mobile it asks your system to open the URL you configured in the browser.
- **External programs (desktop):** it opens editor URIs (`vscode://`, `cursor://`, `jetbrains://`, or your custom URI) through the operating system. With the *Custom CLI Command* editor it runs the shell command you typed in the settings, with the file path, line and column substituted in. Only set commands you trust.
- **Files outside the vault (desktop):** to check that a linked file exists, the plugin looks at paths resolved from the vault and, for absolute paths, anywhere on disk. It only reads file *existence*; it never reads or changes file contents on desktop. The mobile viewer reads the linked file from inside the vault to display it.

## Development

```bash
npm install
npm test          # tests run against the real src/*.ts (obsidian is mocked)
npm run build     # type-check and produce main.js
npm run dev       # watch mode
```

To release: bump `version` in `manifest.json` and `package.json`, add the version to `versions.json`, then push a tag that equals the version (for example `1.1.1`). The *Release* workflow builds and publishes `main.js`, `manifest.json` and `styles.css`.

## License

[MIT](LICENSE)
