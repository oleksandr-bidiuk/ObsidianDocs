export type TargetEditor = 
  | 'vscode' 
  | 'vscode_insiders'
  | 'cursor' 
  | 'rider' 
  | 'custom_uri' 
  | 'custom_cli' 
  | 'obsidian';

export interface CanvasCodeLinksSettings {
  targetEditor: TargetEditor;
  customUriTemplate: string;
  customCliCommand: string;
  preferredRelativeRoot: 'canvas' | 'vault';
  enableFallback: boolean;
  recognizedExtensions: string[];
  decorateLinks: boolean;
  showNoticeOnOpen: boolean;
  mobileOpenMode: 'viewer' | 'web_url';
  mobileWebUrlTemplate: string;
}

export const DEFAULT_SETTINGS: CanvasCodeLinksSettings = {
  targetEditor: 'vscode',
  customUriTemplate: 'vscode://file/{path}:{line}:{col}',
  customCliCommand: 'code -g "{path}:{line}:{col}"',
  preferredRelativeRoot: 'canvas',
  enableFallback: true,
  recognizedExtensions: [
    'cs', 'ts', 'js', 'jsx', 'tsx', 'py', 'cpp', 'c', 'h', 'hpp', 
    'rs', 'go', 'java', 'kt', 'swift', 'rb', 'php', 'lua', 
    'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'css', 'scss', 
    'sh', 'ps1', 'sql', 'md', 'txt'
  ],
  decorateLinks: true,
  showNoticeOnOpen: true,
  mobileOpenMode: 'viewer',
  mobileWebUrlTemplate: 'https://github.com/OWNER/REPO/blob/main/{relpath}#L{line}',
};

export interface ParsedCodeLink {
  originalLink: string;
  filePath: string;
  line: number;
  column: number;
  isCodeLink: boolean;
}

export interface ResolvedCodeTarget {
  resolvedPath: string;
  line: number;
  column: number;
  exists: boolean;
  /** Path relative to the vault root, or null when the file is outside the vault */
  vaultPath: string | null;
  baseSource: 'canvas' | 'vault' | 'absolute' | 'not_found';
}
