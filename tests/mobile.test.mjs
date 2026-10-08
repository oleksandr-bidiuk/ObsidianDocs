import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "./helpers/load.mjs";

const { buildWebUrl, sliceLines, PathResolver, EditorLauncher, DEFAULT_SETTINGS, mock } = await loadSources();
const GH = "https://github.com/me/game/blob/main/{relpath}#L{line}";

test("buildWebUrl: encodes segments and fills variables", () => {
  assert.equal(buildWebUrl(GH, "src/My Game/Player.cs", 42, 3), "https://github.com/me/game/blob/main/src/My%20Game/Player.cs#L42");
  assert.equal(buildWebUrl("https://github.dev/me/game/blob/main/{relpath}?l={line}:{col}&n={filename}", "a/b.cs", 1, 2),
    "https://github.dev/me/game/blob/main/a/b.cs?l=1:2&n=b.cs");
});

test("buildWebUrl: null for placeholder/empty template or file outside vault", () => {
  assert.equal(buildWebUrl(DEFAULT_SETTINGS.mobileWebUrlTemplate, "a.cs", 1, 1), null);
  assert.equal(buildWebUrl("  ", "a.cs", 1, 1), null);
  assert.equal(buildWebUrl(GH, null, 1, 1), null);
});

test("sliceLines: whole small file; windowed large file; clamps line", () => {
  const small = sliceLines("a\r\nb\nc", 2);
  assert.deepEqual([small.startLine, small.lines, small.total], [1, ["a", "b", "c"], 3]);
  const big = sliceLines(Array.from({ length: 10000 }, (_, i) => `l${i + 1}`).join("\n"), 5000, 10);
  assert.deepEqual([big.startLine, big.lines.length, big.lines[10]], [4990, 21, "l5000"]);
  assert.equal(sliceLines("a\nb", 99).startLine, 1);
});

// ---- mobile path resolution + launcher (Platform.isMobile = true) ----
const files = { "src/Player.cs": "class Player {}", "docs/Local.cs": "//" };
const canvas = (p) => new mock.TFile(p);
function mobile(settings = {}) {
  mock.Platform.isMobile = true;
  const app = new mock.App("", files);
  const set = { ...DEFAULT_SETTINGS, showNoticeOnOpen: false, ...settings };
  return { r: new PathResolver(app, set), l: new EditorLauncher(app, set) };
}
test.afterEach(() => { mock.Platform.isMobile = false; mock.modals.length = 0; mock.notices.length = 0; });

test("mobile resolve: canvas-relative via vault adapter, with vaultPath", async () => {
  const { r } = mobile();
  const t = await r.resolveTarget(r.parseLink("../src/Player.cs:7"), canvas("docs/a.canvas"));
  assert.deepEqual([t.exists, t.baseSource, t.vaultPath, t.line], [true, "canvas", "src/Player.cs", 7]);
});

test("mobile resolve: vault-root fallback and missing file", async () => {
  const { r } = mobile();
  const a = await r.resolveTarget(r.parseLink("src/Player.cs"), canvas("docs/sub/a.canvas"));
  assert.deepEqual([a.exists, a.baseSource], [true, "vault"]);
  const b = await r.resolveTarget(r.parseLink("./Nope.cs:3"), canvas("docs/a.canvas"));
  assert.deepEqual([b.exists, b.baseSource], [false, "not_found"]);
});

test("mobile resolve: absolute path outside the vault is not found", async () => {
  const { r } = mobile();
  const t = await r.resolveTarget(r.parseLink("/etc/x.cs:1"), canvas("docs/a.canvas"));
  assert.equal(t.exists, false);
});

test("mobile launcher: viewer mode opens the code viewer for the vault file", async () => {
  const { r, l } = mobile();
  const t = await r.resolveTarget(r.parseLink("../src/Player.cs:7"), canvas("docs/a.canvas"));
  assert.equal(await l.openTarget(t), true);
  assert.equal(mock.modals.length, 1);
  assert.deepEqual([mock.modals[0].vaultPath, mock.modals[0].line], ["src/Player.cs", 7]);
});

test("mobile launcher: web_url mode opens the built URL", async () => {
  const { r, l } = mobile({ mobileOpenMode: "web_url", mobileWebUrlTemplate: GH });
  const opened = [];
  globalThis.window = { open: (u) => opened.push(u) };
  const t = await r.resolveTarget(r.parseLink("src/Player.cs:9"), null);
  await l.openTarget(t);
  assert.deepEqual(opened, ["https://github.com/me/game/blob/main/src/Player.cs#L9"]);
  assert.equal(mock.modals.length, 0);
});

test("mobile launcher: web_url with placeholder template falls back to viewer and tells the user", async () => {
  const { r, l } = mobile({ mobileOpenMode: "web_url" });
  const t = await r.resolveTarget(r.parseLink("src/Player.cs:9"), null);
  await l.openTarget(t);
  assert.equal(mock.modals.length, 1);
  assert.ok(mock.notices.some((n) => /settings/i.test(n)));
});

test("mobile launcher: missing file does not open anything", async () => {
  const { r, l } = mobile();
  const t = await r.resolveTarget(r.parseLink("./Nope.cs:3"), canvas("docs/a.canvas"));
  assert.equal(await l.openTarget(t), false);
  assert.equal(mock.modals.length, 0);
  assert.ok(mock.notices.some((n) => /not found/i.test(n)));
});

test("mobile: never touches desktop-only APIs (no window.require)", async () => {
  const { r, l } = mobile();
  globalThis.window = { require() { throw new Error("desktop API used on mobile"); } };
  const t = await r.resolveTarget(r.parseLink("src/Player.cs:2"), null);
  assert.equal(await l.openTarget(t), true);
});
