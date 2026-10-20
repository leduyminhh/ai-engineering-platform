// Đọc template của skill core `artifact-templates`: khối header `<!-- artifact-template … -->` và bảng mục lục.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Không import plugins.mjs: plugins.mjs dùng initDocFiles(), import vòng sẽ làm TEMPLATES_DIR đọc CORE_DIR khi chưa khởi tạo.
export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'core', 'skills', 'artifact-templates', 'references');

// File template → đường dẫn sinh ra ở project đích (aip init --full và cây templates/ của skill *-init).
const INIT_DOC_MAP = [
  ['requirement.template.md', 'docs/requests/_TEMPLATE/requirement.md'],
  ['design.template.md', 'docs/requests/_TEMPLATE/design.md'],
  ['plan.template.md', 'docs/requests/_TEMPLATE/plan.md'],
];

const INDEX_HEAD = ['Loại', 'Template', 'Validator', 'Nguồn'];

export function templateHeader(text) {
  const m = text.match(/<!-- artifact-template\r?\n([\s\S]*?)-->/);
  if (!m) return null;
  const f = {};
  for (const line of m[1].split(/\r?\n/)) {
    const c = line.match(/^(type|version|validator|sources):\s*(.*)$/);
    if (c) f[c[1]] = c[2].trim();
  }
  return { type: f.type ?? '', version: Number(f.version), validator: f.validator ?? '', sources: f.sources ?? '' };
}

// Bỏ cả dòng trống ngay sau khối để phần còn lại không bắt đầu bằng dòng trống thừa.
export function stripTemplateHeader(text) {
  return text.replace(/<!-- artifact-template\r?\n[\s\S]*?-->[ \t]*(?:\r?\n)?(?:\r?\n)?/, '');
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function templateIndex(skillMd) {
  const lines = skillMd.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith('|') && JSON.stringify(cells(l)) === JSON.stringify(INDEX_HEAD));
  if (start === -1) return [];
  const rows = [];
  for (const l of lines.slice(start + 2)) {
    if (!l.startsWith('|')) break;
    const [type, tpl, validator, sources] = cells(l);
    const link = tpl.match(/\]\(([^)]+)\)/);
    rows.push({ type, file: link ? link[1] : tpl, validator, sources });
  }
  return rows;
}

/** File docs cần sinh ở project đích, nội dung đã bỏ khối header của template. */
export function initDocFiles() {
  return INIT_DOC_MAP.map(([file, rel]) => ({
    rel,
    content: stripTemplateHeader(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8')),
  }));
}
