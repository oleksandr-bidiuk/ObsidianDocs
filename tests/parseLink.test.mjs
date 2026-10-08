import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "./helpers/load.mjs";

const { PathResolver, DEFAULT_SETTINGS, mock } = await loadSources();
const resolver = () => new PathResolver(new mock.App("/vault"), { ...DEFAULT_SETTINGS });
const parse = (s) => resolver().parseLink(s);

test("parseLink: invalid input returns null", () => {
  assert.equal(parse(""), null);
  assert.equal(parse(null), null);
  assert.equal(parse(42), null);
});

test("parseLink: :line, :line:col, #L, #LxCy, #L:col", () => {
  assert.deepEqual(pick(parse("a/b.cs:42")), ["a/b.cs", 42, 1]);
  assert.deepEqual(pick(parse("a/b.cs:42:7")), ["a/b.cs", 42, 7]);
  assert.deepEqual(pick(parse("a/b.cs#L42")), ["a/b.cs", 42, 1]);
  assert.deepEqual(pick(parse("a/b.cs#L42C10")), ["a/b.cs", 42, 10]);
  assert.deepEqual(pick(parse("a/b.cs#L42:10")), ["a/b.cs", 42, 10]);
  assert.deepEqual(pick(parse("a/b.cs#42")), ["a/b.cs", 42, 1]);
});

test("parseLink: query form ?line=&col=", () => {
  assert.deepEqual(pick(parse("a/b.cs?line=9&col=3")), ["a/b.cs", 9, 3]);
});

test("parseLink: explicit schemes mark link as code even without known extension", () => {
  const p = parse("code:./Makefile");
  assert.equal(p.isCodeLink, true);
  assert.equal(p.filePath, "./Makefile");
  assert.equal(parse("code://./x.cs:3").line, 3);
  assert.equal(parse("vscode://file/home/me/x.cs:3").filePath, "home/me/x.cs");
});

test("parseLink: file:// prefix is stripped", () => {
  // NOTE: strips the leading slash too, so /home/x becomes home/x (see known-bug test below)
  assert.equal(parse("file:///C:/proj/x.cs:5").filePath, "C:/proj/x.cs");
  assert.equal(parse("file:///C:/proj/x.cs:5").line, 5);
});

test("parseLink: Windows drive letter is not mistaken for a line", () => {
  const p = parse("C:\\proj\\x.cs:12");
  assert.equal(p.filePath, "C:\\proj\\x.cs");
  assert.equal(p.line, 12);
});

test("parseLink: URI-encoded spaces are decoded; bad encoding doesn't throw", () => {
  assert.equal(parse("my%20dir/x.cs:1").filePath, "my dir/x.cs");
  assert.doesNotThrow(() => parse("100%/x.cs:1"));
});

test("parseLink: markdown and wiki wrappers, with alias", () => {
  assert.equal(parse("[l](./x.cs:5)").filePath, "./x.cs");
  assert.equal(parse("[[./x.cs:5|label]]").line, 5);
});

test("parseLink: recognized extension is case-insensitive; unknown ext is not code", () => {
  assert.equal(parse("X.CS").isCodeLink, true);
  assert.equal(parse("photo.png").isCodeLink, false);
  assert.equal(parse("https://example.com/").isCodeLink, false);
});

test("parseLink: custom recognizedExtensions is respected", () => {
  const r = new PathResolver(new mock.App("/v"), { ...DEFAULT_SETTINGS, recognizedExtensions: ["gd"] });
  assert.equal(r.parseLink("a.gd").isCodeLink, true);
  assert.equal(r.parseLink("a.cs").isCodeLink, false);
});

// ---- Known bugs: assert DESIRED behaviour, skipped until fixed ----
test("BUG: plain note link with a number is hijacked as a code link", { skip: "known bug: line > 1 makes any link a code link" }, () => {
  assert.equal(parse("[[Chapter:5]]").isCodeLink, false);
  assert.equal(parse("Note#5").isCodeLink, false);
});

test("BUG: file:///home/x/y.cs loses leading slash", { skip: "known bug: file:// regex eats the root slash on POSIX" }, () => {
  assert.equal(parse("file:///home/me/x.cs:5").filePath, "/home/me/x.cs");
});

function pick(p) { return [p.filePath, p.line, p.column]; }
