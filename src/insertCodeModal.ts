import { App, Modal, Notice, Setting, TFile, FileSystemAdapter, ItemView } from "obsidian";
import * as path from "./pathUtil";
import { CanvasCodeLinksSettings } from "./types";
import { PathResolver } from "./pathResolver";

export class InsertCodeLinkModal extends Modal {
  private filePath: string = "";
  private line: number = 1;
  private column: number = 1;
  private title: string = "";
  private format: "markdown" | "card" | "protocol" = "markdown";
  private previewEl!: HTMLElement;

  constructor(
    app: App,
    private settings: CanvasCodeLinksSettings,
    private pathResolver: PathResolver,
    private targetCanvasFile: TFile | null
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("code-link-modal-content");

    this.titleEl.setText("Insert Code Link Card");

    const canvasName = this.targetCanvasFile ? this.targetCanvasFile.basename + ".canvas" : "No Canvas Active";
    contentEl.createEl("p", {
      text: `Context: ${canvasName} (paths will be calculated relative to this file)`,
      cls: "setting-item-description",
    });

    // Quick Paste from Clipboard button
    new Setting(contentEl)
      .setName("Clipboard Import")
      .setDesc("Quickly parse file and line from clipboard text")
      .addButton((btn) => {
        btn.setButtonText("Paste from Clipboard").onClick(async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
              this.parseAndApplyClipboard(clipText);
            } else {
              new Notice("Clipboard is empty.");
            }
          } catch (e) {
            new Notice("Failed to read clipboard: " + e);
          }
        });
      });

    // File Path Setting
    const fileSetting = new Setting(contentEl)
      .setName("File Path")
      .setDesc("Relative path (e.g. ./src/script.cs) or absolute path")
      .addText((text) => {
        text
          .setPlaceholder("./src/script.cs")
          .setValue(this.filePath)
          .onChange((val) => {
            this.filePath = val.trim();
            this.updateAutoTitle();
            this.updatePreview();
          });
      });

    // Line & Column Setting
    new Setting(contentEl)
      .setName("Line Number")
      .setDesc("Target line number in the source file")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue(String(this.line))
          .onChange((val) => {
            this.line = parseInt(val, 10) || 1;
            this.updateAutoTitle();
            this.updatePreview();
          });
      });

    // Custom Title Setting
    new Setting(contentEl)
      .setName("Card / Link Title")
      .setDesc("Visible text on the card or link")
      .addText((text) => {
        text
          .setPlaceholder("script.cs:42")
          .setValue(this.title)
          .onChange((val) => {
            this.title = val;
            this.updatePreview();
          });
      });

    // Format Setting
    new Setting(contentEl)
      .setName("Format Style")
      .setDesc("Choose format for card or markdown link")
      .addDropdown((drop) => {
        drop
          .addOption("markdown", "Markdown Link [file:line](./path:line)")
          .addOption("card", "Rich Code Card (Heading + Badge)")
          .addOption("protocol", "Code Protocol [file:line](code:./path:line)")
          .setValue(this.format)
          .onChange((val: any) => {
            this.format = val;
            this.updatePreview();
          });
      });

    // Preview container
    contentEl.createEl("div", { text: "Generated Output Preview:", cls: "setting-item-name" });
    this.previewEl = contentEl.createEl("div", { cls: "code-link-preview-box" });
    this.updatePreview();

    // Action buttons
    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText("Copy to Clipboard")
          .onClick(() => {
            const content = this.generateOutputText();
            navigator.clipboard.writeText(content);
            new Notice("Copied code link to clipboard!");
            this.close();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText("Insert into Canvas / Note")
          .setCta()
          .onClick(async () => {
            await this.insertIntoActiveView();
            this.close();
          });
      });
  }

  private parseAndApplyClipboard(clipText: string) {
    const parsed = this.pathResolver.parseLink(clipText);
    if (parsed) {
      this.filePath = parsed.filePath;
      this.line = parsed.line;
      this.column = parsed.column;

      // If clipboard was an absolute path, convert to relative if canvas is active
      if (this.targetCanvasFile && path.isAbsolute(this.filePath)) {
        this.filePath = this.pathResolver.makeRelativePath(this.targetCanvasFile, this.filePath);
      }

      this.updateAutoTitle();
      this.onOpen(); // Re-render inputs
      new Notice(`Parsed from clipboard: ${this.filePath}:${this.line}`);
    } else {
      this.filePath = clipText.trim();
      this.updateAutoTitle();
      this.onOpen();
    }
  }

  private updateAutoTitle() {
    if (!this.filePath) return;
    const base = path.basename(this.filePath.replace(/\\/g, "/"));
    this.title = `${base}:${this.line}`;
  }

  private generateOutputText(): string {
    const rawPath = this.filePath || "./script.cs";
    const lineSuffix = `:${this.line}`;
    const displayTitle = this.title || `${path.basename(rawPath)}:${this.line}`;

    if (this.format === "markdown") {
      return `[${displayTitle}](${rawPath}${lineSuffix})`;
    } else if (this.format === "protocol") {
      return `[${displayTitle}](code:${rawPath}${lineSuffix})`;
    } else {
      // Rich card format
      return `### 📄 ${displayTitle}\n\n[▶ Open in VS Code](${rawPath}${lineSuffix})\n`;
    }
  }

  private previewSeq = 0;

  private async updatePreview() {
    if (!this.previewEl) return;
    const seq = ++this.previewSeq;
    const text = this.generateOutputText();
    
    // Also show resolved path verification
    const parsed = this.pathResolver.parseLink(this.filePath + ":" + this.line);
    let status = "";
    if (parsed) {
      const resolved = await this.pathResolver.resolveTarget(parsed, this.targetCanvasFile);
      if (seq !== this.previewSeq) return; // a newer update superseded this one
      status = resolved.exists 
        ? `\n\n✓ Exists on disk: ${resolved.resolvedPath}` 
        : `\n\n⚠ File not yet found at: ${resolved.resolvedPath}`;
    }

    this.previewEl.setText(text + status);
  }

  private async insertIntoActiveView() {
    const content = this.generateOutputText();
    const activeView = (this.app.workspace as any).getActiveViewOfType?.(ItemView) 
      || this.app.workspace.activeLeaf?.view as any;

    // Check if active view is Canvas
    if (activeView && activeView.getViewType() === "canvas") {
      const canvas = activeView.canvas;
      if (canvas && typeof canvas.createTextNode === "function") {
        // Find center of current viewport
        const center = canvas.viewport?.getCenter?.() || { x: 0, y: 0 };
        canvas.createTextNode({
          pos: { x: center.x - 120, y: center.y - 60 },
          size: { width: 280, height: 140 },
          text: content,
          save: true,
        });
        new Notice("Added code link card to Canvas!");
        return;
      }
    }

    // Check if active view is Markdown editor
    const mdView = (this.app.workspace.getActiveViewOfType as any)("markdown");
    if (mdView && mdView.editor) {
      mdView.editor.replaceSelection(content);
      new Notice("Inserted code link into note!");
      return;
    }

    // Fallback: Copy to clipboard
    await navigator.clipboard.writeText(content);
    new Notice("Canvas editor not focused. Code link copied to clipboard!");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
