// Minimal stand-in for the `obsidian` module so real src/*.ts can run under node.
export const notices = (globalThis.__cclNotices ??= []);

export class Notice {
  constructor(message, timeout) {
    this.message = message;
    this.timeout = timeout;
    notices.push(message);
  }
}

export class TFile {
  constructor(path) {
    this.path = path;
    this.name = path.split("/").pop();
  }
}

export class FileSystemAdapter {
  constructor(basePath) {
    this.basePath = basePath;
  }
  getBasePath() {
    return this.basePath;
  }
}

export class App {
  constructor(basePath = "") {
    const adapter = new FileSystemAdapter(basePath);
    this.vault = { adapter, getAbstractFileByPath: () => null };
    this.workspace = { getActiveFile: () => null, getLeaf: () => ({}) };
  }
}

export class Plugin {
  constructor(app) {
    this.app = app;
    this.commands = [];
    this.domEvents = [];
    this.postProcessors = [];
    this.protocolHandlers = {};
    this._data = null;
  }
  async loadData() { return this._data; }
  async saveData(d) { this._data = d; }
  addSettingTab() {}
  addCommand(c) { this.commands.push(c); }
  registerDomEvent(el, type, cb, opts) { this.domEvents.push({ el, type, cb, opts }); }
  registerMarkdownPostProcessor(cb) { this.postProcessors.push(cb); }
  registerObsidianProtocolHandler(action, cb) { this.protocolHandlers[action] = cb; }
}

export class Modal { constructor(app) { this.app = app; } open() {} close() {} }
export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
export class Setting {}
export class ItemView {}
