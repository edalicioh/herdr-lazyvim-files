// Herdr's Files panel with VS Code's Material Icon Theme icons: a lazy file browser for the
// focused pane's folder, with bounded read-only previews.
//
// Modified from Herdr's shipped `files` mod (https://github.com/herdrdev/herdr-app, Apache-2.0):
// added DIR, icon() and the Material Icon Theme icons in the rows and the preview header.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings, window, props, terminals, hc, run, openOverlay, closeOverlay, notify } from "herdr";
import ICONS from "./icons.js";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;
const DIR = "mods/file-icons-lazyvim";

function editorsInTab(tabId) {
  const all = terminals();
  return panes().filter(p => p.tab === tabId && p.terminal).flatMap(p => {
    const term = all.find(t => t.address === p.terminal || t.terminal === p.terminal);
    const exe = String(term?.argv?.[0] ?? "").split(/[\\/]/).pop().replace(/\.exe$/i, "").toLowerCase();
    const key = String(p.program?.key ?? "").toLowerCase();
    const name = String(p.program?.name ?? "").toLowerCase();
    if (exe !== "nvim" && key !== "nvim" && name !== "neovim") return [];
    return [{ terminal: p.terminal, pane: p.pane, title: p.title || p.program?.name || "Neovim", cwd: p.cwd || "" }];
  });
}

async function sendFileToEditor(editor, file) {
  const escaped = file.replace(/\\/g, "/").replace(/'/g, "''");
  const command = ':execute "edit " . fnameescape(\'' + escaped + '\')';
  const normal = await hc(["keys", editor.terminal, "esc"]);
  if (normal.code !== 0) throw new Error(normal.stderr || "Could not focus the editor");
  const result = await hc(["send", editor.terminal, command]);
  if (result.code !== 0) throw new Error(result.stderr || "Could not open the file");
}

function editorPicker(p, t) {
  const stop = (_e, cx) => cx.stop_propagation();
  const rows = (p.editors ?? []).map(editor => h_flex().id("editor-" + editor.terminal.replace(/[^a-z0-9_-]/gi, "-"))
    .h(38).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer().text_size(12)
    .text_color(t.foreground).hover(s => s.bg(t.hover))
    .on_mouse_down("left", stop)
    .on_click(async () => {
      try {
        await sendFileToEditor(editor, p.file);
        closeOverlay(p.overlay);
        notify({ title: "Opened in LazyVim", body: p.file, level: "success" });
      } catch (e) { notify({ title: "Could not open in LazyVim", body: String(e), level: "error" }); }
    })
    .child(div().w(34).flex_none().text_color(t.dim).child(editor.terminal))
    .child(div().flex_1().min_w(0).truncate().child(editor.title + " · " + editor.cwd)));
  const cancel = div().id("editor-picker-cancel").h(30).px(9).flex_none().flex().items_center().rounded(6)
    .cursor_pointer().text_size(12).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
    .on_mouse_down("left", stop).on_click(() => closeOverlay(p.overlay)).child("Cancel");
  return v_flex().id("file-icons-lazyvim-picker").w(380).max_h(360).gap(6).p(9).bg(t.popover).text_color(t.foreground)
    .child(div().h(24).flex_none().font_semibold().text_size(13).child("Choose a LazyVim panel"))
    .child(v_flex().id("editor-choices").max_h(280).overflow_y_scrollbar().gap(2).children(rows))
    .child(h_flex().h(30).flex_none().justify_end().child(cancel));
}

// Material Icon Theme's rules, as VS Code applies them: names match case-insensitively; a
// path rule (".github/workflows") beats a name, a name beats an extension, and the longest
// extension wins ("spec.ts" over "ts"). Light themes check the theme's light table first.
const bare = name => name.replace(/^__(.+)__$/, "$1").replace(/^[._-]/, "");
const opened = id => id.endsWith("_light") ? `${id.slice(0, -6)}-open_light` : `${id}-open`;
function lookup(table, key, dark) { return (dark ? undefined : ICONS.light[table][key]) ?? ICONS[table][key]; }
function icon(path, dir, open, dark) {
  const parts = path.toLowerCase().split("/"), name = parts[parts.length - 1];
  const table = dir ? "folderNames" : "fileNames", find = key => lookup(table, key, dark) ?? (dir ? lookup(table, bare(key), dark) : undefined);
  let id;
  for (let i = 0; !id && i < parts.length - 1; i++) id = find(parts.slice(i).join("/"));
  if (dir) {
    id ??= find(name) ?? ICONS.folder;
    return `${DIR}/icons/${open ? opened(id) : id}.svg`;
  }
  id ??= lookup(table, name, dark);
  for (let dot = name.indexOf("."); !id && dot !== -1; dot = name.indexOf(".", dot + 1)) id = lookup("fileExtensions", name.slice(dot + 1), dark);
  return `${DIR}/icons/${id ?? ICONS.file}.svg`;
}

async function directory(path, on) {
  if (!on && window()?.platform === "windows") {
    const r = await exec("powershell", ["-NoProfile", "-Command", "& { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)) } }) | ConvertTo-Json -Compress }", path]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  }
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ] && [ ! -L "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    if (props()?.role === "editor-picker") return;
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async cx => {
      try { while (this.watched === root) { await watchFolder(root); if (this.watched === root) this.refresh(cx); } }
      catch { if (this.watched === root) this.watched = null; }
    });
  }

  async loadFolder(path, context) {
    const on = this.on, root = this.root;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (key() !== context || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    if (this.loading) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      this.context = context; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set();
      this.pending = new Set(); this.marks = {}; this.show(null); this.watched = null; this.error = null; this.limited = false;
    }
    if (!cwd) return;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) await this.loadFolder(path, context);
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=normal"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${top.stdout.trim()}/${entry.slice(3)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
          }
        }
        if (key() !== context) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (key() === context) this.error = String(e); }
          finally { this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  show(path, cx) {
    this.code?.release(); this.code = null; this.file = path; this.fileError = null;
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.file !== path || key() !== context) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const t = theme(), ext = path.includes(".") ? path.split(".").pop() : "txt";
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          font_family: settings().font_family, font_size: 12,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      } catch { if (this.file === path && key() === context) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  async openInLazyVim() {
    if (!this.file || !this.root) return;
    const file = this.root.replace(/[\\/]+$/, "") + "/" + this.file.replace(/\\/g, "/");
    const space = spaces().find(s => s.active);
    const tab = space?.tabs?.find(t => t.active);
    const editors = tab ? editorsInTab(tab.id) : [];
    if (editors.length > 1) {
      openOverlay({ mod: "file-icons-lazyvim", kind: "popup", at: "pointer", width: 380,
        height: Math.min(360, 64 + editors.length * 38), props: { role: "editor-picker", file, editors } });
      return;
    }
    if (editors.length === 1) {
      try {
        await sendFileToEditor(editors[0], file);
        notify({ title: "Opened in LazyVim", body: this.file, level: "success" });
      } catch (e) { notify({ title: "Could not open in LazyVim", body: String(e), level: "error" }); }
      return;
    }
    const target = panes().find(p => p.tab === tab?.id && p.terminal && p.focused)
      ?? panes().find(p => p.tab === tab?.id && p.terminal);
    if (!target) {
      notify({ title: "No terminal pane in this tab", body: "Open a terminal first, then try again.", level: "warning" });
      return;
    }
    try { await run("pane.split", { direction: "right", pane: target.pane, argv: ["nvim", file] }); }
    catch (e) { notify({ title: "Could not open LazyVim", body: String(e), level: "error" }); }
  }

  rows(prefix, depth, out, t, dark) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.show(path, cx))
        .child(entry.dir ? svg(`${DIR}/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(image(icon(path, entry.dir, open, dark)).size(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t, dark);
    }
    return out;
  }

  render(cx) {
    const p = props() ?? {};
    if (p.role === "editor-picker") return editorPicker(p, theme());
    if (key() !== this.context) this.refresh(cx);
    const t = theme(), dark = Boolean(settings().dark);
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(h_flex().flex_1().min_w(0).gap(6).justify_end().items_center().text_size(12).text_color(t.dim)
          .when(Boolean(this.file), el => el.child(image(icon(this.file, false, false, dark)).size(14).flex_none()))
          .child(div().min_w(0).truncate().child(this.file ?? this.root?.split(/[\\/]/).pop() ?? "")))
        .when(Boolean(this.file), el => el.child(h_flex().id("open-in-lazyvim").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
          .cursor_pointer().text_size(11.5).text_color(t.accent).hover(s => s.bg(t.hover))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(() => this.openInLazyVim())
          .child(svg(`${DIR}/icons/${ICONS.file}.svg`).size(13)).child("Open in LazyVim"))))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t, dark))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}
