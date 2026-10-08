import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import { CanvasCodeLinksSettings, ParsedCodeLink } from "./types";
import { PathResolver } from "./pathResolver";
import { EditorLauncher } from "./editorLauncher";

export class LinkInterceptor {
  constructor(
    private app: App,
    private settings: CanvasCodeLinksSettings,
    private pathResolver: PathResolver,
    private editorLauncher: EditorLauncher
  ) {}

  /**
   * Global click handler attached with capture: true to intercept before Obsidian navigation
   */
  async handleClick(evt: MouseEvent): Promise<void> {
    const target = evt.target as HTMLElement;
    if (!target) return;

    // Only intercept if the user clicked on an actual link or code badge, NOT on the card container
    const linkEl = target.closest("a, .canvas-code-link-badge, [data-code-link]");
    if (!linkEl) return;

    let linkCandidate = "";

    if (linkEl.hasAttribute("data-code-link")) {
      linkCandidate = linkEl.getAttribute("data-code-link") || "";
    } else if (linkEl.hasAttribute("data-href")) {
      linkCandidate = linkEl.getAttribute("data-href") || "";
    } else if (linkEl.hasAttribute("href")) {
      linkCandidate = linkEl.getAttribute("href") || "";
    }

    if (!linkCandidate && linkEl.tagName.toLowerCase() === "a") {
      const text = linkEl.textContent?.trim() || "";
      if (text.match(/\.[a-zA-Z0-9]+(?::\d+|#L?\d+)/)) {
        linkCandidate = text;
      }
    }

    if (!linkCandidate) return;

    const parsed = this.pathResolver.parseLink(linkCandidate);
    if (!parsed || !parsed.isCodeLink) return;

    // Intercept event
    evt.preventDefault();
    evt.stopPropagation();
    evt.stopImmediatePropagation();

    // Determine the source file (e.g. current .canvas file)
    const activeFile = this.app.workspace.getActiveFile();
    const resolved = this.pathResolver.resolveTarget(parsed, activeFile);

    await this.editorLauncher.openTarget(resolved);
  }

  /**
   * Markdown post-processor to decorate code links inside Canvas cards and notes
   */
  markdownPostProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!this.settings.decorateLinks) return;

    const links = el.querySelectorAll("a.internal-link, a.external-link, a");
    links.forEach((a) => {
      const linkCandidate = a.getAttribute("data-href") || a.getAttribute("href") || "";
      const parsed = this.pathResolver.parseLink(linkCandidate);
      if (parsed && parsed.isCodeLink) {
        a.classList.add("canvas-code-link-badge");
        a.setAttribute("data-code-link", linkCandidate);
        a.setAttribute("title", `Open in ${this.settings.targetEditor.toUpperCase()} at line ${parsed.line}`);

        // Add code icon if not already added
        if (!a.querySelector(".code-icon")) {
          const iconSpan = document.createElement("span");
          iconSpan.className = "code-icon";
          iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
          a.prepend(iconSpan);
        }
      }
    });
  }
}
