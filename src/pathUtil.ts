/**
 * Pure path helpers (no Node dependency) so the plugin loads on Obsidian mobile.
 * All results use forward slashes; Windows drive paths (C:/...) are supported.
 */
const DRIVE = /^[a-zA-Z]:(\/|$)/;

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export function isAbsolute(p: string): boolean {
  const s = toPosix(p);
  return s.startsWith("/") || DRIVE.test(s);
}

export function normalize(p: string): string {
  let s = toPosix(p);
  let drive = "";
  const d = s.match(/^([a-zA-Z]:)(\/|$)/);
  if (d) {
    drive = d[1];
    s = s.slice(2);
  }
  const abs = s.startsWith("/");
  const out: string[] = [];
  for (const seg of s.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!abs && !drive) out.push("..");
      continue;
    }
    out.push(seg);
  }
  const body = out.join("/");
  if (abs || drive) return drive + "/" + body;
  return body || ".";
}

export function resolve(base: string, rel: string): string {
  if (isAbsolute(rel)) return normalize(rel);
  return normalize((base || "/") + "/" + rel);
}

export function join(...parts: string[]): string {
  return normalize(parts.join("/"));
}

export function dirname(p: string): string {
  const n = normalize(p);
  const i = n.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  if (i === 2 && DRIVE.test(n)) return n.slice(0, 3);
  return n.slice(0, i);
}

export function basename(p: string): string {
  const s = toPosix(p).replace(/\/+$/, "");
  return s.substring(s.lastIndexOf("/") + 1);
}

export function relative(from: string, to: string): string {
  const a = normalize(from);
  const b = normalize(to);
  const da = a.match(/^[a-zA-Z]:/)?.[0].toLowerCase();
  const db = b.match(/^[a-zA-Z]:/)?.[0].toLowerCase();
  if (da !== db) return b;
  const as = a.split("/").filter((x) => x && !/^[a-zA-Z]:$/.test(x));
  const bs = b.split("/").filter((x) => x && !/^[a-zA-Z]:$/.test(x));
  let i = 0;
  while (i < as.length && i < bs.length && as[i] === bs[i]) i++;
  return [...as.slice(i).map(() => ".."), ...bs.slice(i)].join("/");
}
