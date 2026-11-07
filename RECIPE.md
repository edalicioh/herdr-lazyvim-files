# Files → LazyVim

Build a Herdr Files mod that lets the user open a file from its read-only preview in a Neovim/LazyVim terminal pane.

## Files

- Put the mod in `mods/files-lazyvim/`.
- Start from Herdr's built-in `files` mod, preserving its folder browser, previews, file status markers, refresh behavior, and icons. Keep the upstream attribution and license notice.
- Add an **Open in LazyVim** action to the file preview header.
- On click, inspect Neovim panes in the active tab. If there is one, send it a safely escaped Vim `:edit` command. If there are several, show a popup to choose one. If there are none, start `nvim` with the selected absolute path in another terminal pane.
- Keep directory clicks as expand/collapse actions.

## Runtime and safety

- Use the Herdr mod APIs and types from `~/.config/herdr-app/herdr.d.ts` and `gpui-kit.d.ts`; do not use DOM, HTML, CSS, Node APIs, or timers outside the Herdr API.
- The Files mod reads directory entries and selected text files under the focused pane's working folder. It runs read-only Git commands to show file change markers. On Windows, use PowerShell for directory enumeration when `sh` is unavailable.
- To open a file in an existing editor, use Herdr's `hc` API to send Esc and a Vim `:execute ... fnameescape(...)` command to that terminal. To start an editor, use the app's terminal/pane command APIs. Do not write to repository files as part of browsing or opening them.
- Neovim must be discoverable as `nvim` to Herdr's terminal process. LazyVim must already be installed separately. Detect editors only in the active tab, using pane program metadata or the terminal command.

## Installation

1. Clone this repository.
2. Clone Herdr's built-in Files mod as a personal mod named `files-lazyvim`.
3. Copy this repository's `mods/files-lazyvim/` contents into `~/.config/herdr-app/mods/files-lazyvim/`.
4. In a personal layout, point the Files block at `files-lazyvim`; do not edit a shipped layout. An example block is:

   ```json
   { "id": "files", "type": "block", "content": { "mod": "files-lazyvim" } }
   ```

5. Run `herdr-app check ~/.config/herdr-app/mods/files-lazyvim` and confirm the panel is loaded in Herdr. On Windows, use the equivalent `%USERPROFILE%\.config\herdr-app\mods\files-lazyvim` path.

## Rebuild from an empty folder

Use the current Herdr built-in Files mod as the source, then implement the behavior above. Preserve the existing Files panel API and visuals, add only the preview action and editor-selection flow, and keep the mod name `files-lazyvim`. Include `mods/files-lazyvim/`, this recipe, a representative `preview.png`, and the upstream license/attribution. Do not include a `layouts/` folder.
