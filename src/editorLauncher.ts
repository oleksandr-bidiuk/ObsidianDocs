import * as path from "path";
import { App, Notice } from "obsidian";
import { CanvasCodeLinksSettings, ResolvedCodeTarget } from "./types";

export class EditorLauncher {
  constructor(private app: App, private settings: CanvasCodeLinksSettings) {}

  /**
   * Open the resolved code target in the configured editor
   */
  async openTarget(target: ResolvedCodeTarget): Promise<boolean> {
    const filename = path.basename(target.resolvedPath);
    const { line, column, resolvedPath } = target;

    if (!target.exists) {
      new Notice(`Canvas Code Links: Warning! File not found on disk:\n${resolvedPath}`, 6000);
    }

    if (this.settings.showNoticeOnOpen) {
      new Notice(`Opening ${filename}:${line} in ${this.getEditorDisplayName()}...`, 2500);
    }

    switch (this.settings.targetEditor) {
      case "vscode":
        return this.openInVSCode(resolvedPath, line, column);
      case "vscode_insiders":
        return this.openInVSCodeInsiders(resolvedPath, line, column);
      case "cursor":
        return this.openInCursor(resolvedPath, line, column);
      case "rider":
        return this.openInRider(resolvedPath, line, column);
      case "custom_uri":
        return this.openWithCustomUri(resolvedPath, line, column);
      case "custom_cli":
        return this.openWithCliCommand(resolvedPath, line, column);
      case "obsidian":
        return this.openInObsidian(resolvedPath, line, column);
      default:
        return this.openInVSCode(resolvedPath, line, column);
    }
  }

  private getEditorDisplayName(): string {
    switch (this.settings.targetEditor) {
      case "vscode": return "VS Code";
      case "vscode_insiders": return "VS Code Insiders";
      case "cursor": return "Cursor";
      case "rider": return "JetBrains Rider";
      case "custom_uri": return "Custom URI";
      case "custom_cli": return "CLI Command";
      case "obsidian": return "Obsidian";
      default: return "Editor";
    }
  }

  /**
   * Format absolute path for vscode/cursor/electron URI schemes.
   * Ensures Windows paths like C:\foo\bar become /C:/foo/bar or compatible URI format.
   */
  private formatUriPath(absPath: string): string {
    let normalized = absPath.replace(/\\/g, "/");
    if (/^[a-zA-Z]:\//.test(normalized)) {
      normalized = "/" + normalized;
    }
    return encodeURI(normalized).replace(/#/g, "%23").replace(/\?/g, "%3F");
  }

  /**
   * Open URI with Electron shell or browser fallback
   */
  private async openExternalUri(uri: string): Promise<boolean> {
    try {
      if (typeof window !== "undefined" && (window as any).require) {
        const { shell } = (window as any).require("electron");
        if (shell && shell.openExternal) {
          await shell.openExternal(uri);
          return true;
        }
      }
    } catch (e) {
      console.warn("Electron shell.openExternal failed, falling back to window.open", e);
    }

    try {
      window.open(uri);
      return true;
    } catch (err) {
      console.error("Failed to open URI:", uri, err);
      new Notice(`Failed to open link: ${uri}`);
      return false;
    }
  }

  private async openInVSCode(absPath: string, line: number, col: number): Promise<boolean> {
    const formatted = this.formatUriPath(absPath);
    const uri = `vscode://file${formatted}:${line}:${col}`;
    const success = await this.openExternalUri(uri);
    if (!success) {
      // Fallback to CLI if URI fails
      return this.executeCli(`code -g "${absPath}:${line}:${col}"`);
    }
    return success;
  }

  private async openInVSCodeInsiders(absPath: string, line: number, col: number): Promise<boolean> {
    const formatted = this.formatUriPath(absPath);
    const uri = `vscode-insiders://file${formatted}:${line}:${col}`;
    return this.openExternalUri(uri);
  }

  private async openInCursor(absPath: string, line: number, col: number): Promise<boolean> {
    const formatted = this.formatUriPath(absPath);
    const uri = `cursor://file${formatted}:${line}:${col}`;
    return this.openExternalUri(uri);
  }

  private async openInRider(absPath: string, line: number, col: number): Promise<boolean> {
    // JetBrains Rider protocol
    const uri = `jetbrains://rider/navigate/reference?path=${encodeURIComponent(absPath)}:${line}:${col}`;
    const success = await this.openExternalUri(uri);
    if (!success) {
      return this.executeCli(`rider64.exe --line ${line} "${absPath}"`);
    }
    return success;
  }

  private async openWithCustomUri(absPath: string, line: number, col: number): Promise<boolean> {
    let uri = this.settings.customUriTemplate
      .replace(/\{path\}/g, absPath)
      .replace(/\{uripath\}/g, this.formatUriPath(absPath))
      .replace(/\{line\}/g, String(line))
      .replace(/\{col\}/g, String(col));
    return this.openExternalUri(uri);
  }

  private async openWithCliCommand(absPath: string, line: number, col: number): Promise<boolean> {
    const cmd = this.settings.customCliCommand
      .replace(/\{path\}/g, absPath)
      .replace(/\{line\}/g, String(line))
      .replace(/\{col\}/g, String(col));
    return this.executeCli(cmd);
  }

  private executeCli(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof window !== "undefined" && (window as any).require) {
          const cp = (window as any).require("child_process");
          cp.exec(command, (err: any) => {
            if (err) {
              console.error("CLI exec error:", err);
              new Notice(`Failed to execute command: ${command}`);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } else {
          new Notice("Child process is not available in this environment.");
          resolve(false);
        }
      } catch (e) {
        console.error("Failed to run CLI command:", e);
        resolve(false);
      }
    });
  }

  private async openInObsidian(absPath: string, line: number, col: number): Promise<boolean> {
    // Check if the file is inside the vault
    const adapter = this.app.vault.adapter;
    const vaultBase = (adapter as any).getBasePath ? (adapter as any).getBasePath() : "";
    
    if (vaultBase && absPath.toLowerCase().startsWith(vaultBase.toLowerCase())) {
      let relVault = absPath.substring(vaultBase.length).replace(/^[\\/]+/, "").replace(/\\/g, "/");
      const file = this.app.vault.getAbstractFileByPath(relVault);
      if (file && "stat" in file) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file as any);
        const view = leaf.view as any;
        if (view && view.editor) {
          view.editor.setCursor({ line: Math.max(0, line - 1), ch: Math.max(0, col - 1) });
          view.editor.scrollIntoView({
            from: { line: Math.max(0, line - 1), ch: 0 },
            to: { line: Math.max(0, line - 1), ch: 0 }
          }, true);
        }
        return true;
      }
    }

    new Notice("File is outside vault or not recognized by Obsidian. Opening in system default...");
    return this.openExternalUri(`file:///${absPath.replace(/\\/g, "/")}`);
  }
}
