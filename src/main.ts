import { Plugin, TFile } from "obsidian";
import { CanvasCodeLinksSettings, DEFAULT_SETTINGS } from "./types";
import { PathResolver } from "./pathResolver";
import { EditorLauncher } from "./editorLauncher";
import { LinkInterceptor } from "./linkInterceptor";
import { CanvasCodeLinksSettingTab } from "./settings";
import { InsertCodeLinkModal } from "./insertCodeModal";

export default class CanvasCodeLinksPlugin extends Plugin {
  settings: CanvasCodeLinksSettings = DEFAULT_SETTINGS;
  pathResolver!: PathResolver;
  editorLauncher!: EditorLauncher;
  linkInterceptor!: LinkInterceptor;

  async onload() {
    await this.loadSettings();

    this.pathResolver = new PathResolver(this.app, this.settings);
    this.editorLauncher = new EditorLauncher(this.app, this.settings);
    this.linkInterceptor = new LinkInterceptor(
      this.app,
      this.settings,
      this.pathResolver,
      this.editorLauncher
    );

    this.addSettingTab(new CanvasCodeLinksSettingTab(this.app, this));

    // Register DOM click interceptor in capture phase to take precedence over default navigation
    this.registerDomEvent(
      document,
      "click",
      (evt: MouseEvent) => {
        this.linkInterceptor.handleClick(evt);
      },
      true // Capture phase!
    );

    // Register markdown post processor to add nice badge and icon in Canvas text cards
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.linkInterceptor.markdownPostProcessor(el, ctx);
    });

    // Command: Insert Code Link Card into Canvas or Note
    this.addCommand({
      id: "insert-code-link-card",
      name: "Insert Code Link Card (or Relative Link)",
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        new InsertCodeLinkModal(this.app, this.settings, this.pathResolver, activeFile).open();
      },
    });

    // Command: Copy relative code link from current file (if user is viewing a file in Obsidian)
    this.addCommand({
      id: "copy-code-link-from-active-file",
      name: "Copy relative code link from active file",
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            // Vault-relative path (resolver falls back to the vault root); escape chars that break md links
            const vaultPath = activeFile.path.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
            navigator.clipboard.writeText(`[${activeFile.name}:1](${vaultPath}:1)`);
          }
          return true;
        }
        return false;
      },
    });

    // Protocol handler: obsidian://canvas-code-link?file=...&line=...
    this.registerObsidianProtocolHandler("canvas-code-link", async (params) => {
      const filePath = params["file"];
      const line = parseInt(params["line"] || "1", 10);
      const col = parseInt(params["col"] || "1", 10);
      if (filePath) {
        const activeFile = this.app.workspace.getActiveFile();
        const parsed = {
          originalLink: filePath,
          filePath,
          line,
          column: col,
          isCodeLink: true,
        };
        const resolved = await this.pathResolver.resolveTarget(parsed, activeFile);
        await this.editorLauncher.openTarget(resolved);
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update dependencies
    if (this.pathResolver) {
      this.pathResolver = new PathResolver(this.app, this.settings);
    }
    if (this.editorLauncher) {
      this.editorLauncher = new EditorLauncher(this.app, this.settings);
    }
    if (this.linkInterceptor) {
      this.linkInterceptor = new LinkInterceptor(
        this.app,
        this.settings,
        this.pathResolver,
        this.editorLauncher
      );
    }
  }
}
