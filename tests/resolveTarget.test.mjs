import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadSources } from "./helpers/load.mjs";

const { PathResolver, DEFAULT_SETTINGS, mock } = await loadSources();

function makeVault() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccl-vault-")));
  fs.mkdirSync(path.join(dir, "docs/sub"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/Player.cs"), "//");
  fs.writeFileSync(path.join(dir, "docs/Local.cs"), "//");
  return dir;
}
const mk = (dir, over = {}) => new PathResolver(new mock.App(dir), { ...DEFAULT_SETTINGS, ...over });
const canvas = (p) => new mock.TFile(p);

test("resolveTarget: relative to canvas folder", () => {
  const dir = makeVault();
  try {
    const r = mk(dir);
    const t = r.resolveTarget(r.parseLink("../src/Player.cs:20"), canvas("docs/a.canvas"));
    assert.deepEqual([t.exists, t.baseSource, t.line], [true, "canvas", 20]);
    assert.equal(t.resolvedPath, path.join(dir, "src/Player.cs"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: falls back to vault root", () => {
  const dir = makeVault();
  try {
    const r = mk(dir);
    const t = r.resolveTarget(r.parseLink("src/Player.cs:1"), canvas("docs/sub/a.canvas"));
    assert.deepEqual([t.exists, t.baseSource], [true, "vault"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: preferredRelativeRoot=vault checks vault first", () => {
  const dir = makeVault();
  try {
    fs.writeFileSync(path.join(dir, "Local.cs"), "//");
    const r = mk(dir, { preferredRelativeRoot: "vault" });
    const t = r.resolveTarget(r.parseLink("./Local.cs"), canvas("docs/a.canvas"));
    assert.equal(t.baseSource, "vault");
    assert.equal(t.resolvedPath, path.join(dir, "Local.cs"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: enableFallback=false does not try the second root", () => {
  const dir = makeVault();
  try {
    const r = mk(dir, { enableFallback: false });
    const t = r.resolveTarget(r.parseLink("src/Player.cs:1"), canvas("docs/sub/a.canvas"));
    assert.deepEqual([t.exists, t.baseSource], [false, "not_found"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: missing file reports not_found with a candidate path", () => {
  const dir = makeVault();
  try {
    const r = mk(dir);
    const t = r.resolveTarget(r.parseLink("./Nope.cs:3"), canvas("docs/a.canvas"));
    assert.equal(t.exists, false);
    assert.equal(t.resolvedPath, path.join(dir, "docs/Nope.cs"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: absolute path is used as-is", () => {
  const dir = makeVault();
  try {
    const abs = path.join(dir, "src/Player.cs");
    const r = mk(dir);
    const t = r.resolveTarget(r.parseLink(abs + ":9"), canvas("docs/a.canvas"));
    assert.deepEqual([t.exists, t.baseSource, t.line], [true, "absolute", 9]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("resolveTarget: no current file uses vault root", () => {
  const dir = makeVault();
  try {
    const r = mk(dir, { preferredRelativeRoot: "canvas" });
    const t = r.resolveTarget(r.parseLink("src/Player.cs"), null);
    assert.equal(t.exists, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("makeRelativePath: produces ./ and ../ forms with forward slashes", () => {
  const dir = makeVault();
  const r = mk(dir);
  assert.equal(r.makeRelativePath(canvas("docs/a.canvas"), path.join(dir, "docs/Local.cs")), "./Local.cs");
  assert.equal(r.makeRelativePath(canvas("docs/sub/a.canvas"), path.join(dir, "src/Player.cs")), "../../src/Player.cs");
  fs.rmSync(dir, { recursive: true, force: true });
});
