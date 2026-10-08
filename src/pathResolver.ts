import * as path from "path";
import * as fs from "fs";
import { App, FileSystemAdapter, TFile } from "obsidian";
import { CanvasCodeLinksSettings, ParsedCodeLink, ResolvedCodeTarget } from "./types";

export class PathResolver {
  constructor(private app: App, private settings: CanvasCodeLinksSettings) {}

  /**
   * Get the absolute filesystem path of the vault root
   */
  getVaultBasePath(): string {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    // Fallback for custom or test environments
    return (adapter as any).basePath || "";
  }

  /**
   * Get the absolute filesystem directory of a given vault file (e.g. .canvas file)
   */
  getFileDirectory(file: TFile): string {
    const vaultBase = this.getVaultBasePath();
    const fullFilePath = path.join(vaultBase, file.path);
    return path.dirname(fullFilePath);
  }

  /**
   * Parse a raw link string (from markdown [text](url), [[wikilink]], or canvas node)
   */
  parseLink(rawLink: string): ParsedCodeLink | null {
    if (!rawLink || typeof rawLink !== "string") return null;

    let link = rawLink.trim();

    // Remove markdown link wrapper if whole markdown link passed: [label](url)
    const mdMatch = link.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (mdMatch) {
      link = mdMatch[2].trim();
    }

    // Remove wikilink wrapper: [[url]] or [[url|label]]
    const wikiMatch = link.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (wikiMatch) {
      link = wikiMatch[1].trim();
    }

    let isExplicitCodeScheme = false;

    // Remove prefixes like code://, code:, vscode://file/, file://
    if (/^code:\/\//i.test(link)) {
      link = link.replace(/^code:\/\//i, "");
      isExplicitCodeScheme = true;
    } else if (/^code:/i.test(link)) {
      link = link.replace(/^code:/i, "");
      isExplicitCodeScheme = true;
    } else if (/^file:\/\/\/?/i.test(link)) {
      link = link.replace(/^file:\/\/\/?/i, "");
      isExplicitCodeScheme = true;
    } else if (/^vscode:\/\/file\//i.test(link)) {
      link = link.replace(/^vscode:\/\/file\//i, "");
      isExplicitCodeScheme = true;
    }

    // Clean URI encoding (e.g. %20 -> space)
    try {
      link = decodeURIComponent(link);
    } catch {
      // Ignore URI decode errors
    }

    let line = 1;
    let column = 1;
    let filePath = link;

    // Match query parameter ?line=42&col=10
    const queryMatch = filePath.match(/\?(?:.*&)?line=(\d+)(?:&(?:.*&)?col=(\d+))?/i);
    if (queryMatch) {
      line = parseInt(queryMatch[1], 10) || 1;
      if (queryMatch[2]) {
        column = parseInt(queryMatch[2], 10) || 1;
      }
      filePath = filePath.substring(0, filePath.indexOf("?"));
    }

    // Match hash fragment: #L42C10 or #L42:10 or #42 or #L42
    const hashMatch = filePath.match(/#(?:L)?(\d+)(?:[C:](\d+))?$/i);
    if (hashMatch) {
      line = parseInt(hashMatch[1], 10) || 1;
      if (hashMatch[2]) {
        column = parseInt(hashMatch[2], 10) || 1;
      }
      filePath = filePath.substring(0, filePath.lastIndexOf("#"));
    }

    // Match colon notation at end: :line:col or :line (e.g. script.cs:42:5 or script.cs:42)
    // Avoid matching drive letter on Windows (e.g. C:)
    const colonMatch = filePath.match(/(?<!^[a-zA-Z]):(\d+)(?::(\d+))?$/);
    if (colonMatch) {
      line = parseInt(colonMatch[1], 10) || 1;
      if (colonMatch[2]) {
        column = parseInt(colonMatch[2], 10) || 1;
      }
      filePath = filePath.substring(0, filePath.length - colonMatch[0].length);
    }

    // Normalize forward/backward slashes
    filePath = filePath.trim();

    // Check extension
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "";

    const isRecognizedExt = this.settings.recognizedExtensions.map(e => e.toLowerCase()).includes(ext);

    const isCodeLink = isExplicitCodeScheme || isRecognizedExt || line > 1;

    return {
      originalLink: rawLink,
      filePath,
      line,
      column,
      isCodeLink,
    };
  }

  /**
   * Resolve relative or absolute filePath to absolute path on disk
   */
  resolveTarget(parsed: ParsedCodeLink, currentFile: TFile | null): ResolvedCodeTarget {
    const vaultBase = this.getVaultBasePath();
    const rawPath = parsed.filePath;

    // If it's already an absolute path on Windows (e.g. C:\...) or Unix (/...)
    if (path.isAbsolute(rawPath) || /^[a-zA-Z]:[\\/]/.test(rawPath)) {
      const exists = fs.existsSync(rawPath);
      return {
        resolvedPath: path.normalize(rawPath),
        line: parsed.line,
        column: parsed.column,
        exists,
        baseSource: exists ? "absolute" : "not_found",
      };
    }

    let canvasDir = "";
    if (currentFile) {
      canvasDir = this.getFileDirectory(currentFile);
    } else {
      canvasDir = vaultBase;
    }

    const preferredOrder = this.settings.preferredRelativeRoot === "canvas" 
      ? ["canvas", "vault"] 
      : ["vault", "canvas"];

    // Try canvas directory resolution
    const resolveFromCanvas = () => {
      const candidate = path.resolve(canvasDir, rawPath);
      return {
        path: candidate,
        exists: fs.existsSync(candidate),
      };
    };

    // Try vault base directory resolution
    const resolveFromVault = () => {
      // Strip leading ./ if present for vault relative resolution
      const sanitized = rawPath.replace(/^(\.[\/\\])+/, "");
      const candidate = path.resolve(vaultBase, sanitized);
      return {
        path: candidate,
        exists: fs.existsSync(candidate),
      };
    };

    let firstCandidatePath = "";

    for (const source of preferredOrder) {
      if (source === "canvas") {
        const res = resolveFromCanvas();
        if (!firstCandidatePath) firstCandidatePath = res.path;
        if (res.exists) {
          return {
            resolvedPath: path.normalize(res.path),
            line: parsed.line,
            column: parsed.column,
            exists: true,
            baseSource: "canvas",
          };
        }
      } else if (source === "vault") {
        const res = resolveFromVault();
        if (!firstCandidatePath) firstCandidatePath = res.path;
        if (res.exists) {
          return {
            resolvedPath: path.normalize(res.path),
            line: parsed.line,
            column: parsed.column,
            exists: true,
            baseSource: "vault",
          };
        }
      }

      if (!this.settings.enableFallback) {
        break;
      }
    }

    // If file doesn't exist on disk yet, return normalized preferred candidate path
    return {
      resolvedPath: path.normalize(firstCandidatePath || path.resolve(canvasDir, rawPath)),
      line: parsed.line,
      column: parsed.column,
      exists: false,
      baseSource: "not_found",
    };
  }

  /**
   * Calculate clean relative path from current canvas to target file on disk
   */
  makeRelativePath(fromCanvasFile: TFile, targetAbsoluteDiskPath: string): string {
    const canvasDir = this.getFileDirectory(fromCanvasFile);
    let rel = path.relative(canvasDir, targetAbsoluteDiskPath);

    // Normalize to forward slashes for clean markdown portability
    rel = rel.replace(/\\/g, "/");

    if (!rel.startsWith("./") && !rel.startsWith("../")) {
      rel = "./" + rel;
    }
    return rel;
  }
}
