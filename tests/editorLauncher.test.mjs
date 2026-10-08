import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "./helpers/load.mjs";

const { EditorLauncher, DEFAULT_SETTINGS, mock } = await loadSources();

// Capture URIs/commands instead of launching anything.
function harness(settings) {
  const opened = [];
  const execd = [];
  globalThis.window = {
    require: (m) =>
      m === "electron"
        ? { shell: { openExternal: async (u) => void opened.push(u) } }
        : { exec: (c, cb) => { execd.push(c); cb(null); } },
    open: (u) => opened.push(u),
  };
  mock.notices.length = 0;
  const l = new EditorLauncher(new mock.App("/vault"), { ...DEFAULT_SETTINGS, showNoticeOnOpen: false, ...settings });
  return { l, opened, execd };
}
const target = (p, over = {}) => ({ resolvedPath: p, line: 12, column: 3, exists: true, baseSource: "canvas", ...over });

test("vscode: builds vscode://file URI with line and column", async () => {
  const { l, opened } = harness({ targetEditor: "vscode" });
  assert.equal(await l.openTarget(target("/home/me/My Game/Player.cs")), true);
  assert.deepEqual(opened, ["vscode://file/home/me/My%20Game/Player.cs:12:3"]);
});

test("vscode: Windows path gets a leading slash and forward slashes", async () => {
  const { l, opened } = harness({ targetEditor: "vscode" });
  await l.openTarget(target("C:\\proj\\Player.cs"));
  assert.equal(opened[0], "vscode://file/C:/proj/Player.cs:12:3");
});

test("vscode: # and ? in path are escaped", async () => {
  const { l, opened } = harness({ targetEditor: "vscode" });
  await l.openTarget(target("/a/C#/x?.cs"));
  assert.equal(opened[0], "vscode://file/a/C%23/x%3F.cs:12:3");
});

test("cursor and insiders use their own schemes", async () => {
  let h = harness({ targetEditor: "cursor" });
  await h.l.openTarget(target("/a.cs"));
  assert.equal(h.opened[0], "cursor://file/a.cs:12:3");
  h = harness({ targetEditor: "vscode_insiders" });
  await h.l.openTarget(target("/a.cs"));
  assert.equal(h.opened[0], "vscode-insiders://file/a.cs:12:3");
});

test("rider: jetbrains navigate URI", async () => {
  const { l, opened } = harness({ targetEditor: "rider" });
  await l.openTarget(target("/a b.cs"));
  assert.equal(opened[0], "jetbrains://rider/navigate/reference?path=%2Fa%20b.cs:12:3");
});

test("custom_uri substitutes {path} {uripath} {line} {col}", async () => {
  const { l, opened } = harness({ targetEditor: "custom_uri", customUriTemplate: "x://{path}|{uripath}|{line}|{col}" });
  await l.openTarget(target("/a b.cs"));
  assert.equal(opened[0], "x:///a b.cs|/a%20b.cs|12|3");
});

test("custom_cli substitutes placeholders and runs the command", async () => {
  const { l, execd } = harness({ targetEditor: "custom_cli", customCliCommand: 'code -g "{path}:{line}:{col}"' });
  assert.equal(await l.openTarget(target("/a.cs")), true);
  assert.deepEqual(execd, ['code -g "/a.cs:12:3"']);
});

test("missing file shows a warning notice but still opens", async () => {
  const { l, opened } = harness({ targetEditor: "vscode" });
  await l.openTarget(target("/gone.cs", { exists: false }));
  assert.ok(mock.notices.some((n) => /not found/i.test(n)));
  assert.equal(opened.length, 1);
});

test("showNoticeOnOpen=true announces the editor", async () => {
  const { l } = harness({ targetEditor: "cursor", showNoticeOnOpen: true });
  await l.openTarget(target("/a.cs"));
  assert.ok(mock.notices.some((n) => /Cursor/.test(n)));
});

test("obsidian editor: file outside vault falls back to system open", async () => {
  const { l, opened } = harness({ targetEditor: "obsidian" });
  await l.openTarget(target("/elsewhere/a.cs"));
  assert.equal(opened[0], "file:////elsewhere/a.cs");
});
