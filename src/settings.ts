import { App, PluginSettingTab, Setting } from "obsidian";
import type CanvasCodeLinksPlugin from "./main";
import { TargetEditor } from "./types";

export class CanvasCodeLinksSettingTab extends PluginSettingTab {
  plugin: CanvasCodeLinksPlugin;

  constructor(app: App, plugin: CanvasCodeLinksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Canvas Code Links Settings" });

    new Setting(containerEl)
      .setName("Default Code Editor")
      .setDesc("The editor to launch when clicking a code link in Canvas or notes.")
      .addDropdown((drop) => {
        drop
          .addOption("vscode", "Visual Studio Code (vscode://)")
          .addOption("cursor", "Cursor (cursor://)")
          .addOption("rider", "JetBrains Rider (jetbrains://rider)")
          .addOption("vscode_insiders", "VS Code Insiders")
          .addOption("obsidian", "Obsidian Internal Editor")
          .addOption("custom_uri", "Custom URI Scheme")
          .addOption("custom_cli", "Custom CLI Command")
          .setValue(this.plugin.settings.targetEditor)
          .onChange(async (value: TargetEditor) => {
            this.plugin.settings.targetEditor = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide conditional fields
          });
      });

    if (this.plugin.settings.targetEditor === "custom_uri") {
      new Setting(containerEl)
        .setName("Custom URI Scheme Template")
        .setDesc("Variables: {path} = full path, {uripath} = encoded uri path, {line} = line number, {col} = column number")
        .addText((text) => {
          text
            .setPlaceholder("myeditor://open?file={path}&line={line}")
            .setValue(this.plugin.settings.customUriTemplate)
            .onChange(async (value) => {
              this.plugin.settings.customUriTemplate = value;
              await this.plugin.saveSettings();
            });
        });
    }

    if (this.plugin.settings.targetEditor === "custom_cli") {
      new Setting(containerEl)
        .setName("Custom CLI Command Template")
        .setDesc("Variables: {path} = full path, {line} = line number, {col} = column number")
        .addText((text) => {
          text
            .setPlaceholder("code -g \"{path}:{line}:{col}\"")
            .setValue(this.plugin.settings.customCliCommand)
            .onChange(async (value) => {
              this.plugin.settings.customCliCommand = value;
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(containerEl)
      .setName("Preferred Path Resolution Root")
      .setDesc("Where relative paths (like ./script.cs or ../src/script.cs) are resolved from first.")
      .addDropdown((drop) => {
        drop
          .addOption("canvas", "Relative to current .canvas file folder (Recommended)")
          .addOption("vault", "Relative to Vault / Repository Root")
          .setValue(this.plugin.settings.preferredRelativeRoot)
          .onChange(async (val: "canvas" | "vault") => {
            this.plugin.settings.preferredRelativeRoot = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Fallback Resolution")
      .setDesc("If a file is not found relative to the .canvas directory, try searching relative to the Vault root.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableFallback)
          .onChange(async (val) => {
            this.plugin.settings.enableFallback = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Recognized Code File Extensions")
      .setDesc("Comma-separated extensions to identify as code links (e.g. cs, ts, js, py).")
      .addTextArea((text) => {
        text
          .setPlaceholder("cs, ts, js, py, cpp, rs, go")
          .setValue(this.plugin.settings.recognizedExtensions.join(", "))
          .onChange(async (val) => {
            const list = val
              .split(",")
              .map((s) => s.trim().replace(/^\./, ""))
              .filter(Boolean);
            this.plugin.settings.recognizedExtensions = list;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Decorate Code Links")
      .setDesc("Render code links inside Canvas cards and notes with an icon and badge styling.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.decorateLinks)
          .onChange(async (val) => {
            this.plugin.settings.decorateLinks = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Show Notification On Open")
      .setDesc("Display an Obsidian Notice when launching a file at a specific line.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showNoticeOnOpen)
          .onChange(async (val) => {
            this.plugin.settings.showNoticeOnOpen = val;
            await this.plugin.saveSettings();
          });
      });
  }
}
