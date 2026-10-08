/** Helpers for the mobile open modes (no DOM / Obsidian dependency, so they are unit-testable). */

/**
 * Build a web URL (GitHub, GitLab, github.dev, ...) from a template.
 * Variables: {relpath} (vault-relative, URL-encoded), {filename}, {line}, {col}.
 * Returns null when the template is unset/still the placeholder or the file is outside the vault.
 */
export function buildWebUrl(
  template: string,
  vaultPath: string | null,
  line: number,
  column: number
): string | null {
  if (!vaultPath || !template.trim() || /OWNER|REPO/.test(template)) return null;
  const encoded = vaultPath.split("/").map(encodeURIComponent).join("/");
  const filename = encodeURIComponent(vaultPath.substring(vaultPath.lastIndexOf("/") + 1));
  return template
    .replace(/\{relpath\}/g, encoded)
    .replace(/\{filename\}/g, filename)
    .replace(/\{line\}/g, String(line))
    .replace(/\{col\}/g, String(column));
}

/** Pick the window of lines the in-app viewer renders (whole file when small). */
export function sliceLines(
  text: string,
  line: number,
  radius = 2000
): { startLine: number; lines: string[]; total: number } {
  const all = text.split(/\r?\n/);
  const target = Math.min(Math.max(line, 1), all.length);
  const start = Math.max(1, target - radius);
  const end = Math.min(all.length, target + radius);
  return { startLine: start, lines: all.slice(start - 1, end), total: all.length };
}
