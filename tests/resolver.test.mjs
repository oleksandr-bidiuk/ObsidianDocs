import test from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import * as fs from "fs";

// Mock minimal PathResolver logic for direct node execution testing
class TestPathResolver {
  constructor(vaultBase, settings) {
    this.vaultBase = vaultBase;
    this.settings = settings;
  }

  parseLink(rawLink) {
    if (!rawLink || typeof rawLink !== "string") return null;
    let link = rawLink.trim();

    const mdMatch = link.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (mdMatch) {
      link = mdMatch[2].trim();
    }

    const wikiMatch = link.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (wikiMatch) {
      link = wikiMatch[1].trim();
    }

    let isExplicitCodeScheme = false;
    if (/^code:\/\//i.test(link)) {
      link = link.replace(/^code:\/\//i, "");
      isExplicitCodeScheme = true;
    } else if (/^code:/i.test(link)) {
      link = link.replace(/^code:/i, "");
      isExplicitCodeScheme = true;
    } else if (/^vscode:\/\/file\//i.test(link)) {
      link = link.replace(/^vscode:\/\/file\//i, "");
      isExplicitCodeScheme = true;
    }

    try {
      link = decodeURIComponent(link);
    } catch {}

    let line = 1;
    let column = 1;
    let filePath = link;

    const queryMatch = filePath.match(/\?(?:.*&)?line=(\d+)(?:&(?:.*&)?col=(\d+))?/i);
    if (queryMatch) {
      line = parseInt(queryMatch[1], 10) || 1;
      if (queryMatch[2]) column = parseInt(queryMatch[2], 10) || 1;
      filePath = filePath.substring(0, filePath.indexOf("?"));
    }

    const hashMatch = filePath.match(/#(?:L)?(\d+)(?:[C:](\d+))?$/i);
    if (hashMatch) {
      line = parseInt(hashMatch[1], 10) || 1;
      if (hashMatch[2]) column = parseInt(hashMatch[2], 10) || 1;
      filePath = filePath.substring(0, filePath.lastIndexOf("#"));
    }

    const colonMatch = filePath.match(/(?<!^[a-zA-Z]):(\d+)(?::(\d+))?$/);
    if (colonMatch) {
      line = parseInt(colonMatch[1], 10) || 1;
      if (colonMatch[2]) column = parseInt(colonMatch[2], 10) || 1;
      filePath = filePath.substring(0, filePath.length - colonMatch[0].length);
    }

    filePath = filePath.trim();
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "";
    const isRecognizedExt = this.settings.recognizedExtensions.includes(ext);

    return {
      originalLink: rawLink,
      filePath,
      line,
      column,
      isCodeLink: isExplicitCodeScheme || isRecognizedExt || line > 1,
    };
  }

  resolveTarget(parsed, canvasRelativePath) {
    const canvasDir = path.dirname(path.join(this.vaultBase, canvasRelativePath));
    const rawPath = parsed.filePath;

    // Check canvas relative
    const fromCanvas = path.resolve(canvasDir, rawPath);
    if (fs.existsSync(fromCanvas)) {
      return { resolvedPath: path.normalize(fromCanvas), line: parsed.line, column: parsed.column, exists: true, baseSource: 'canvas' };
    }

    // Check vault relative fallback
    if (this.settings.enableFallback) {
      const sanitized = rawPath.replace(/^(\.[\/\\])+/, "");
      const fromVault = path.resolve(this.vaultBase, sanitized);
      if (fs.existsSync(fromVault)) {
        return { resolvedPath: path.normalize(fromVault), line: parsed.line, column: parsed.column, exists: true, baseSource: 'vault' };
      }
    }

    return { resolvedPath: path.normalize(fromCanvas), line: parsed.line, column: parsed.column, exists: false, baseSource: 'not_found' };
  }
}

test("Link parsing: markdown link with colon line", () => {
  const resolver = new TestPathResolver("C:/testVault", {
    recognizedExtensions: ["cs", "ts", "py"],
    enableFallback: true,
  });

  const parsed = resolver.parseLink("[script.cs:42](./scripts/script.cs:42)");
  assert.equal(parsed.filePath, "./scripts/script.cs");
  assert.equal(parsed.line, 42);
  assert.equal(parsed.column, 1);
  assert.equal(parsed.isCodeLink, true);
});

test("Link parsing: markdown link with #L line", () => {
  const resolver = new TestPathResolver("C:/testVault", {
    recognizedExtensions: ["cs", "ts", "py"],
    enableFallback: true,
  });

  const parsed = resolver.parseLink("[GameManager.cs](../src/GameManager.cs#L105)");
  assert.equal(parsed.filePath, "../src/GameManager.cs");
  assert.equal(parsed.line, 105);
  assert.equal(parsed.column, 1);
  assert.equal(parsed.isCodeLink, true);
});

test("Link parsing: line and column :42:15", () => {
  const resolver = new TestPathResolver("C:/testVault", {
    recognizedExtensions: ["cs", "ts", "py"],
    enableFallback: true,
  });

  const parsed = resolver.parseLink("code:./script.cs:42:15");
  assert.equal(parsed.filePath, "./script.cs");
  assert.equal(parsed.line, 42);
  assert.equal(parsed.column, 15);
  assert.equal(parsed.isCodeLink, true);
});

test("Link parsing: wikilink format [[../src/script.cs#L88]]", () => {
  const resolver = new TestPathResolver("C:/testVault", {
    recognizedExtensions: ["cs", "ts", "py"],
    enableFallback: true,
  });

  const parsed = resolver.parseLink("[[../src/script.cs#L88]]");
  assert.equal(parsed.filePath, "../src/script.cs");
  assert.equal(parsed.line, 88);
  assert.equal(parsed.isCodeLink, true);
});

test("Path resolution: relative to canvas folder", () => {
  // Create a temporary mock directory structure
  const tmpDir = path.join(process.cwd(), "test_mock_vault");
  const docsDir = path.join(tmpDir, "docs");
  const srcDir = path.join(tmpDir, "src");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const scriptFile = path.join(srcDir, "Player.cs");
  fs.writeFileSync(scriptFile, "// test code");

  try {
    const resolver = new TestPathResolver(tmpDir, {
      recognizedExtensions: ["cs"],
      enableFallback: true,
    });

    const parsed = resolver.parseLink("[Player](../src/Player.cs:20)");
    const resolved = resolver.resolveTarget(parsed, "docs/architecture.canvas");

    assert.equal(resolved.exists, true);
    assert.equal(resolved.baseSource, "canvas");
    assert.equal(resolved.resolvedPath, path.normalize(scriptFile));
    assert.equal(resolved.line, 20);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Path resolution: fallback to vault root when canvas relative doesn't match", () => {
  const tmpDir = path.join(process.cwd(), "test_mock_vault_fallback");
  const docsSubDir = path.join(tmpDir, "docs", "subfolder");
  const srcDir = path.join(tmpDir, "src");
  fs.mkdirSync(docsSubDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const scriptFile = path.join(srcDir, "Enemy.cs");
  fs.writeFileSync(scriptFile, "// test enemy code");

  try {
    const resolver = new TestPathResolver(tmpDir, {
      recognizedExtensions: ["cs"],
      enableFallback: true,
    });

    // Link specifies src/Enemy.cs from a canvas in docs/subfolder/test.canvas
    const parsed = resolver.parseLink("[Enemy](src/Enemy.cs:50)");
    const resolved = resolver.resolveTarget(parsed, "docs/subfolder/test.canvas");

    assert.equal(resolved.exists, true);
    assert.equal(resolved.baseSource, "vault");
    assert.equal(resolved.resolvedPath, path.normalize(scriptFile));
    assert.equal(resolved.line, 50);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
