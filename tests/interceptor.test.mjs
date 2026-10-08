import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "./helpers/load.mjs";

const { PathResolver, LinkInterceptor, DEFAULT_SETTINGS, mock } = await loadSources();

// Tiny fake element: enough surface for LinkInterceptor.
function el(tag, attrs = {}, text = "") {
  const classes = new Set();
  const children = [];
  const e = {
    tagName: tag.toUpperCase(), textContent: text, children, attrs: { ...attrs },
    classList: { add: (c) => classes.add(c), has: (c) => classes.has(c) },
    hasAttribute: (k) => k in e.attrs,
    getAttribute: (k) => e.attrs[k] ?? null,
    setAttribute: (k, v) => { e.attrs[k] = v; },
    closest: () => e,
    matches: (sel) => sel.split(",").some((c) => attrs.class && c.trim() === "." + attrs.class),
    querySelector: (s) => children.find((c) => s === ".code-icon" && c.className === "code-icon") ?? null,
    prepend: (c) => children.unshift(c),
  };
  return e;
}
const click = (target) => {
  const evt = { target, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() {} };
  return evt;
};

function setup(over = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...over };
  const app = new mock.App("/vault");
  const resolver = new PathResolver(app, settings);
  const opened = [];
  const launcher = { openTarget: async (t) => { opened.push(t); return true; } };
  return { li: new LinkInterceptor(app, settings, resolver, launcher), opened };
}

test("click on code link is intercepted and opened with the right line", async () => {
  const { li, opened } = setup();
  const evt = click(el("a", { href: "./Player.cs:77" }));
  await li.handleClick(evt);
  assert.equal(evt.prevented, true);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].line, 77);
});

test("click on ordinary link is left alone", async () => {
  const { li, opened } = setup();
  const evt = click(el("a", { href: "https://example.com" }));
  await li.handleClick(evt);
  assert.equal(evt.prevented, false);
  assert.equal(opened.length, 0);
});

test("click prefers data-code-link, then data-href, then href", async () => {
  const { li, opened } = setup();
  await li.handleClick(click(el("a", { "data-code-link": "a.cs:1", "data-href": "b.cs:2", href: "c.cs:3" })));
  await li.handleClick(click(el("a", { "data-href": "b.cs:2", href: "c.cs:3" })));
  assert.deepEqual(opened.map((o) => o.line), [1, 2]);
});

test("click with no target is ignored", async () => {
  const { li } = setup();
  await li.handleClick({ target: null });
});

test("post-processor decorates code links only, with title and icon", () => {
  const { li } = setup({ targetEditor: "cursor" });
  const code = el("a", { href: "./x.cs:9" });
  const web = el("a", { href: "https://example.com" });
  const root = { querySelectorAll: () => [code, web] };
  globalThis.createSpan = () => ({ className: "", createSvg: () => ({ createSvg: () => ({}) }) });
  const icon = [];
  code.prepend = (c) => { c.className = "code-icon"; icon.push(c); };
  li.markdownPostProcessor(root, {});
  assert.equal(code.classList.has("canvas-code-link-badge"), true);
  assert.equal(code.attrs["data-code-link"], "./x.cs:9");
  assert.match(code.attrs.title, /CURSOR at line 9/);
  assert.equal(icon.length, 1);
  assert.equal(web.classList.has("canvas-code-link-badge"), false);
});

test("post-processor does nothing when decorateLinks is off", () => {
  const { li } = setup({ decorateLinks: false });
  const code = el("a", { href: "./x.cs:9" });
  li.markdownPostProcessor({ querySelectorAll: () => [code] }, {});
  assert.equal(code.classList.has("canvas-code-link-badge"), false);
});

test("editor (CodeMirror) link opens on Ctrl/Cmd+click only", async () => {
  const { li, opened } = setup();
  const cm = () => el("span", { class: "cm-url" }, "(./Player.cs:77)");
  const plain = click(cm());
  await li.handleClick(plain);
  assert.equal(plain.prevented, false);
  const ctrl = click(cm());
  ctrl.ctrlKey = true;
  await li.handleClick(ctrl);
  assert.equal(ctrl.prevented, true);
  assert.equal(opened[0].line, 77);
});
