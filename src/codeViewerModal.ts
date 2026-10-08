import { App, Modal, Notice } from "obsidian";
import { sliceLines } from "./mobile";

/** Read-only code viewer used on mobile, where no external editor can be launched. */
export class CodeViewerModal extends Modal {
  constructor(
    app: App,
    public vaultPath: string,
    public line: number,
    public column: number
  ) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ccl-viewer");
    this.titleEl.setText(`${this.vaultPath}:${this.line}`);

    let text: string;
    try {
      text = await this.app.vault.adapter.read(this.vaultPath);
    } catch {
      new Notice(`Canvas Code Links: cannot read ${this.vaultPath}`);
      this.close();
      return;
    }

    const { startLine, lines } = sliceLines(text, this.line);
    const box = contentEl.createDiv({ cls: "ccl-viewer-code" });
    let targetEl: HTMLElement | null = null;
    lines.forEach((content, i) => {
      const n = startLine + i;
      const row = box.createDiv({ cls: "ccl-viewer-line" });
      row.createSpan({ cls: "ccl-viewer-num", text: String(n) });
      row.createSpan({ cls: "ccl-viewer-text", text: content || " " });
      if (n === this.line) {
        row.addClass("ccl-viewer-target");
        targetEl = row;
      }
    });
    (targetEl as HTMLElement | null)?.scrollIntoView({ block: "center" });
  }

  onClose() {
    this.contentEl.empty();
  }
}
