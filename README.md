<div align="center">

# SPADE

### A focused desktop workspace for your PDFs

Open, organize, annotate, and export PDF documents with a clean, native-feeling editor for Windows, macOS, and Linux.

[![Build desktop apps](https://github.com/bioinfoguru/spade/actions/workflows/build.yml/badge.svg)](https://github.com/bioinfoguru/spade/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-see%20repository-lightgrey.svg)](#license)

</div>

---

## Make your PDFs easier to work with

SPADE brings common document tasks into one desktop app. Reorder pages, make notes, add visual markups, and save your edits back to a PDF without juggling separate tools.

### What you can do

- **Read and navigate** — browse page thumbnails, document outlines, and searchable text.
- **Organize pages** — reorder, rotate, duplicate, crop, and remove pages.
- **Mark up documents** — highlight text, draw, add shapes and sticky notes, and place text or images.
- **Combine files** — merge PDFs into the open document or combine files into a new one.
- **Work comfortably** — use undo and redo, zoom controls, light and dark themes, and keyboard shortcuts.
- **Keep control of your files** — open and export PDFs from your desktop workflow.

## Get SPADE

Download the latest published version from [GitHub Releases](https://github.com/bioinfoguru/spade/releases/latest). Windows, macOS, and Linux installers are attached to each release.

| Platform | Build output |
| --- | --- |
| Windows | Installer bundle (`.msi` and/or `.exe`) |
| macOS | Disk image (`.dmg`) |
| Linux | Linux packages (such as `.deb` and `.AppImage`) |

Installation prompts can vary by operating system.

## Run from source

### Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) stable toolchain
- Tauri system prerequisites for your OS: [Windows](https://v2.tauri.app/start/prerequisites/#windows), [macOS](https://v2.tauri.app/start/prerequisites/#macos), or [Linux](https://v2.tauri.app/start/prerequisites/#linux)

### Start the app

```bash
git clone git@github.com:bioinfoguru/spade.git
cd spade
pnpm install
pnpm tauri dev
```

Create a production build with:

```bash
pnpm tauri build
```

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Open PDF | `Ctrl` + `O` | `⌘` + `O` |
| Save PDF | `Ctrl` + `S` | `⌘` + `S` |
| Undo | `Ctrl` + `Z` | `⌘` + `Z` |
| Redo | `Ctrl` + `Y` or `Ctrl` + `Shift` + `Z` | `⌘` + `Y` or `⌘` + `Shift` + `Z` |
| Zoom in / out | `Ctrl` + `+` / `-` | `⌘` + `+` / `-` |
| Return to Select tool | `Esc` | `Esc` |

## Build checks

Pushing a `v*` tag runs a parallel GitHub Actions matrix for Windows, macOS, and Linux. Each job checks the frontend build, packages the desktop app, and publishes its installer to the GitHub Release. You can also run **Build desktop apps** manually from the Actions tab to build downloadable workflow artifacts without updating a release. Ordinary branch pushes do not run this workflow.

### Publish a release

Update the app version in `src-tauri/tauri.conf.json` (`version`) and keep it aligned with `package.json` and `src-tauri/Cargo.toml`. Run `sync-to-github.bat v0.2.0` to sync the branch and tag that commit; the script pushes the tag to start the three-platform release build. Without the version argument, it only pushes the branch. Tags with a suffix such as `v0.2.0-beta.1` are marked as prereleases.

## Contributing

Ideas, bug reports, and pull requests are welcome. Please include your operating system and steps to reproduce when reporting an issue.

## License

No license file is currently included. All rights are reserved unless the repository owner adds a license granting reuse permissions.
