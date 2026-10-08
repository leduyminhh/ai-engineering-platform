// Output writer + small helpers shared by the CLI and adapters.
import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

export function rmrf(d) { fs.rmSync(d, { recursive: true, force: true }); }

function copyDir(src, dst) {
  ensureDir(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Materialize the file list an adapter returns into outDir.
 * Each entry is one of:
 *   { path, content }   -> write text file
 *   { path, copyFrom }  -> copy a single file
 *   { path, copyDir }   -> copy a directory tree
 * `path` is always relative to outDir and uses '/' separators.
 * Returns the number of files written/copied.
 */
export function writeFiles(outDir, files) {
  let count = 0;
  for (const f of files) {
    const dest = path.join(outDir, f.path);
    if (f.content != null) {
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, f.content, 'utf8');
      count++;
    } else if (f.copyFrom) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(f.copyFrom, dest);
      count++;
    } else if (f.copyDir) {
      if (fs.existsSync(f.copyDir)) { copyDir(f.copyDir, dest); count++; }
    }
  }
  return count;
}

// Plain scalar chỉ an toàn khi không mở đầu bằng ký tự cấu trúc YAML và không chứa ": " / " #";
// mô tả tiếng Việt thường có ": " hoặc dấu " nên phải quote, nếu không parser chặt báo "mapping values are not allowed here".
const PLAIN_UNSAFE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:(?:\s|$)|\s#|\s$|["\n\r\t]/;

/** Chuỗi YAML an toàn: plain khi vô hại, ngược lại double-quoted kiểu JSON (YAML 1.2 chấp nhận). */
export function yamlScalar(v) {
  const s = String(v);
  return s === '' || PLAIN_UNSAFE.test(s) ? JSON.stringify(s) : s;
}

/** Emit a YAML frontmatter block from an ordered list of [key, value] pairs. */
export function frontmatter(pairs) {
  const lines = ['---'];
  for (const [k, v] of pairs) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean' || typeof v === 'number') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}
