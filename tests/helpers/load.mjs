// Bundles the REAL TypeScript sources with esbuild (obsidian aliased to a mock)
// so tests exercise src/*.ts rather than a hand-copied duplicate.
import { build } from "esbuild";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mockPath = path.join(root, "tests/helpers/obsidianMock.mjs");
let cache;

export async function loadSources() {
  if (cache) return cache;
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "ccl-test-"));
  await build({
    entryPoints: {
      pathResolver: path.join(root, "src/pathResolver.ts"),
      editorLauncher: path.join(root, "src/editorLauncher.ts"),
      linkInterceptor: path.join(root, "src/linkInterceptor.ts"),
      main: path.join(root, "src/main.ts"),
      types: path.join(root, "src/types.ts"),
      pathUtil: path.join(root, "src/pathUtil.ts"),
      mobile: path.join(root, "src/mobile.ts"),
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outdir,
    outExtension: { ".js": ".mjs" },
    alias: { obsidian: mockPath },
    // sources call require("fs") lazily; give the ESM bundle a require
    banner: { js: 'import { createRequire as __cr } from "module"; const require = __cr(import.meta.url);' },
    logLevel: "silent",
  });
  const imp = (n) => import(pathToFileURL(path.join(outdir, n + ".mjs")).href);
  cache = {
    ...(await imp("pathResolver")),
    ...(await imp("editorLauncher")),
    ...(await imp("linkInterceptor")),
    ...(await imp("types")),
    pathUtil: await imp("pathUtil"),
    ...(await imp("mobile")),
    Main: (await imp("main")).default,
    mock: await import(pathToFileURL(mockPath).href),
  };
  return cache;
}
