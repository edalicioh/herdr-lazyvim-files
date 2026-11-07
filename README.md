# Herdr Files → LazyVim

A personal Herdr mod that adds an **Open in LazyVim** action to the Files panel’s file preview.

## Behavior

- Clicking a file in Files opens Herdr’s read-only preview.
- The preview header offers Open in LazyVim.
- The action checks for Neovim panes in the active tab. One editor opens the file directly; multiple editors bring up a chooser; no editor starts Neovim in a new pane with that file.
- Folder clicks keep their normal expand and collapse behavior.

The editor chooser lists the Neovim panes Herdr identifies through pane program metadata or the terminal command. To make an editor discoverable, launch Neovim directly as a Herdr pane, rather than running it as a child process inside PowerShell.

## Requirements

- Herdr desktop app with a personal layout that uses this mod in its Files panel.
- Neovim available as nvim to Herdr’s terminal process.
- A Neovim configuration such as LazyVim already installed.

## Install on Windows

Run these steps from a clone of this repository in PowerShell.

~~~powershell
herdr-app do mod.clone --name files --as files-lazyvim
$appHome = Join-Path $env:USERPROFILE '.config\herdr-app'
Copy-Item -Path '.\mods\files-lazyvim\*' -Destination (Join-Path $appHome 'mods\files-lazyvim') -Recurse -Force
herdr-app check (Join-Path $appHome 'mods\files-lazyvim')
~~~

In a personal layout, set the block with id files to use files-lazyvim:

~~~json
{ "id": "files", "type": "block", "content": { "mod": "files-lazyvim" } }
~~~

Clone Herdr’s shipped main layout first if you do not already have a personal layout. The mod does not edit shipped layouts.

Check the running app with:

~~~powershell
herdr-app status
~~~

## License and attribution

The mod is derived from Herdr’s shipped Files mod. Herdr’s original license and source attribution are included in LICENSE and NOTICE. The per-file LazyVim routing and editor chooser are modifications by Edalicio Heinzen.