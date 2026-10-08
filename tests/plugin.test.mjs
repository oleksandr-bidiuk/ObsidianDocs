import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "./helpers/load.mjs";

const { Main, DEFAULT_SETTINGS, mock } = await loadSources();

async function boot(active = null) {
  globalThis.document ??= {};
  const app = new mock.App("/vault");
  app.workspace.getActiveFile = () => active;
  const p = new Main(app);
  await p.onload();
  return p;
}

test("onload registers capture-phase click, post-processor, 2 commands, protocol handler", async () => {
  const p = await boot();
  assert.equal(p.domEvents.length, 1);
  assert.equal(p.domEvents[0].type, "click");
  assert.equal(p.domEvents[0].opts, true);
  assert.equal(p.postProcessors.length, 1);
  assert.deepEqual(p.commands.map((c) => c.id).sort(), ["copy-code-link-from-active-file", "insert-code-link-card"]);
  assert.equal(typeof p.protocolHandlers["canvas-code-link"], "function");
});

test("loadSettings merges saved data over defaults", async () => {
  const app = new mock.App("/vault");
  const p = new Main(app);
  p._data = { targetEditor: "cursor" };
  await p.loadSettings();
  assert.equal(p.settings.targetEditor, "cursor");
  assert.equal(p.settings.enableFallback, DEFAULT_SETTINGS.enableFallback);
});

test("loadSettings must not alias DEFAULT_SETTINGS", async () => {
  const p = new Main(new mock.App("/v"));
  await p.loadSettings();
  p.settings.targetEditor = "rider";
  assert.equal(DEFAULT_SETTINGS.targetEditor, "vscode");
});

test("saveSettings persists and the click handler uses the new settings", async () => {
  const p = await boot();
  p.settings.targetEditor = "cursor";
  await p.saveSettings();
  assert.equal(p._data.targetEditor, "cursor");
  assert.equal(p.editorLauncher.settings.targetEditor, "cursor");
  assert.equal(p.linkInterceptor.settings.targetEditor, "cursor");
  assert.equal(p.pathResolver.settings.targetEditor, "cursor");
});

test("protocol handler resolves file and opens at line/col", async () => {
  const p = await boot();
  const calls = [];
  p.editorLauncher.openTarget = async (t) => calls.push(t);
  await p.protocolHandlers["canvas-code-link"]({ file: "/abs/x.cs", line: "30", col: "4" });
  assert.deepEqual([calls[0].line, calls[0].column], [30, 4]);
});

test("protocol handler without file does nothing", async () => {
  const p = await boot();
  let n = 0;
  p.editorLauncher.openTarget = async () => n++;
  await p.protocolHandlers["canvas-code-link"]({});
  assert.equal(n, 0);
});

test("copy-link command is unavailable without an active file", async () => {
  const p = await boot(null);
  const cmd = p.commands.find((c) => c.id === "copy-code-link-from-active-file");
  assert.equal(cmd.checkCallback(true), false);
});

test("copy-link command copies a vault-relative, escaped link", async () => {
  const active = new mock.TFile("src/My Game/Player (v2).cs");
  const p = await boot(active);
  let copied = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: (s) => (copied = s) } } });
  p.commands.find((c) => c.id === "copy-code-link-from-active-file").checkCallback(false);
  assert.equal(copied, "[Player (v2).cs:1](src/My%20Game/Player%20%28v2%29.cs:1)");
});
