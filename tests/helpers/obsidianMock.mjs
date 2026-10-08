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

// Shared via globalThis because the bundled sources inline their own copy of this module.
export const Platform = (globalThis.__cclPlatform ??= { isMobile: false, isDesktop: true, isDesktopApp: true });
export const modals = (globalThis.__cclModals ??= []);

export class App {
  // `files` = vault-relative files visible to the mobile adapter: { "src/a.cs": "contents" }
  constructor(basePath = "", files = {}) {
    const adapter = new FileSystemAdapter(basePath);
    adapter.exists = async (p) => p in files;
    adapter.read = async (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    };
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

export class Modal { constructor(app) { this.app = app; } open() { modals.push(this); } close() {} }
export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
export class Setting {}
export class ItemView {}
