import test from "node:test";
import assert from "node:assert/strict";
import * as nodePath from "node:path";
import { loadSources } from "./helpers/load.mjs";

const { pathUtil: p } = await loadSources();

test("normalize / resolve / dirname / basename / join agree with node posix", () => {
  for (const x of ["/a/b/../c", "/a/./b//c/", "a/../../b", "/", "./x"]) {
    assert.equal(p.normalize(x), nodePath.posix.normalize(x).replace(/(.)\/$/, "$1") || ".");
  }
  assert.equal(p.resolve("/v/docs", "../src/a.cs"), "/v/src/a.cs");
  assert.equal(p.resolve("/v/docs", "/abs/a.cs"), "/abs/a.cs");
  assert.equal(p.dirname("/v/docs/a.canvas"), "/v/docs");
  assert.equal(p.dirname("/a"), "/");
  assert.equal(p.basename("/v/docs/a.cs"), "a.cs");
  assert.equal(p.basename("a\\b\\c.cs"), "c.cs");
  assert.equal(p.join("/v", "docs", "..", "src"), "/v/src");
});

test("relative", () => {
  assert.equal(p.relative("/v/docs/sub", "/v/src/a.cs"), "../../src/a.cs");
  assert.equal(p.relative("/v/docs", "/v/docs/a.cs"), "a.cs");
  assert.equal(p.relative("/v/docs", "/v/docs"), "");
});

test("Windows drive paths", () => {
  assert.equal(p.isAbsolute("C:\\proj\\a.cs"), true);
  assert.equal(p.normalize("C:\\proj\\..\\x\\a.cs"), "C:/x/a.cs");
  assert.equal(p.dirname("C:/proj/a.cs"), "C:/proj");
  assert.equal(p.dirname("C:/a.cs"), "C:/");
  assert.equal(p.relative("C:/v/docs", "C:/v/src/a.cs"), "../src/a.cs");
  assert.equal(p.relative("C:/v", "D:/x/a.cs"), "D:/x/a.cs");
  assert.equal(p.resolve("C:/v/docs", "../a.cs"), "C:/v/a.cs");
});

test("relative paths and isAbsolute", () => {
  assert.equal(p.isAbsolute("./a"), false);
  assert.equal(p.isAbsolute("/a"), true);
  assert.equal(p.normalize("../a"), "../a");
});
