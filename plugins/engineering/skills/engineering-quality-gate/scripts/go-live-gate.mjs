#!/usr/bin/env node
// Đếm bốn chỉ tiêu ngưỡng go-live (secret, Critical/High, RCE, KEV) từ report đã xuất. Chỉ báo, không chặn: exit 0 khi đọc được input.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export class InputError extends Error {
  constructor(message, source) {
    super(message);
    this.name = 'InputError';
    this.source = source;
  }
}

const FLAGS = {
  '--gitleaks-tree': 'gitleaksTree',
  '--gitleaks-history': 'gitleaksHistory',
  '--trivy': 'trivy',
  '--coverity': 'coverity',
  '--zap': 'zap',
  '--nessus': 'nessus',
  '--blackduck': 'blackduck',
  '--sonar': 'sonar',
  '--kev': 'kev',
  '--fp': 'fp',
  '--accepted': 'accepted',
};
const REPEATABLE = { '--sarif': 'sarif' };
const FLAG_OF = { ...Object.fromEntries(Object.entries(FLAGS).map(([f, k]) => [k, f])), sarif: '--sarif' };
const SOURCE_KEYS = ['gitleaksTree', 'gitleaksHistory', 'trivy', 'coverity', 'zap', 'nessus', 'blackduck', 'sonar', 'sarif', 'kev'];
const SOURCE_NAME = { gitleaksTree: 'gitleaks-tree', gitleaksHistory: 'gitleaks-history' };
const sourceName = (k) => SOURCE_NAME[k] || k;

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const TRIVY_SEVERITY = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNKNOWN: 'Info' };

// Thông báo lỗi chỉ nêu tên cờ và tên trường: report có thể chứa secret nên không chép giá trị hay message gốc của JSON.parse.
const fail = (key, detail) => new InputError(`${FLAG_OF[key]}: ${detail}`, key);

function parseJson(key, text) {
  try {
    return JSON.parse(String(text).replace(/^﻿/, ''));
  } catch {
    throw fail(key, 'JSON không hợp lệ');
  }
}

function requireField(key, obj, field, type) {
  if (obj === null || typeof obj !== 'object' || obj[field] === undefined || obj[field] === null || (type && typeof obj[field] !== type)) {
    throw fail(key, `thiếu hoặc sai kiểu trường ${field}`);
  }
  return obj[field];
}

function normalizeSeverity(key, field, raw, table) {
  const s = table[String(raw).trim().toUpperCase()];
  if (!s) throw fail(key, `giá trị ${field} không hợp lệ`);
  return s;
}

const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, SEVERITIES.length - i]));

function addFinding(map, f) {
  const cur = map.get(f.key);
  if (!cur) {
    map.set(f.key, { ...f, sources: [f.source], source: undefined, cve: f.cve || [], cwe: f.cwe || [], labels: [] });
    return;
  }
  if (!cur.sources.includes(f.source)) cur.sources.push(f.source);
  if (RANK[f.severity] > RANK[cur.severity]) cur.severity = f.severity;
  for (const c of f.cve || []) if (!cur.cve.includes(c)) cur.cve.push(c);
  for (const c of f.cwe || []) if (!cur.cwe.includes(c)) cur.cwe.push(c);
}

function readGitleaks(key, text, map) {
  const items = parseJson(key, text);
  if (!Array.isArray(items)) throw fail(key, 'report phải là mảng');
  for (const it of items) {
    const rule = requireField(key, it, 'RuleID', 'string');
    const file = requireField(key, it, 'File', 'string');
    const line = requireField(key, it, 'StartLine', 'number');
    addFinding(map, { source: sourceName(key), kind: 'secret', severity: 'Secret', key: `${rule}@${file}:${line}`, location: `${file}:${line}`, scope: 'code' });
  }
}

function readTrivy(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc) || !('Results' in doc || 'ArtifactName' in doc)) {
    throw fail(key, 'thiếu trường Results hoặc ArtifactName');
  }
  if (doc.Results != null && !Array.isArray(doc.Results)) throw fail(key, 'Results phải là mảng');
  const digest = String(doc.Metadata?.RepoDigests?.[0] ?? '').split('@')[1];
  const asset = `image:${digest || doc.ArtifactName || 'unknown'}`;
  for (const res of doc.Results || []) {
    if (res === null || typeof res !== 'object') throw fail(key, 'phần tử Results phải là object');
    for (const v of res.Vulnerabilities || []) {
      const id = requireField(key, v, 'VulnerabilityID', 'string');
      const severity = normalizeSeverity(key, 'Severity', requireField(key, v, 'Severity'), TRIVY_SEVERITY);
      addFinding(map, { source: 'trivy', kind: 'vuln', severity, key: `${id}@${asset}`, location: `${v.PkgName ?? '?'}@${v.InstalledVersion ?? '?'}`, cve: [id], scope: 'image' });
    }
    for (const s of res.Secrets || []) {
      const rule = requireField(key, s, 'RuleID', 'string');
      const line = requireField(key, s, 'StartLine', 'number');
      const where = s.Layer?.DiffID || res.Target || 'unknown';
      // Không đọc Match/Code: hai trường này chứa giá trị secret.
      addFinding(map, { source: 'trivy', kind: 'secret', severity: 'Secret', key: `${rule}@${where}:${line}`, location: `layer ${where}:${line}`, scope: 'image' });
    }
  }
}

const READERS = { gitleaksTree: readGitleaks, gitleaksHistory: readGitleaks, trivy: readTrivy };
const labelsZero = () => ({ 'chấp nhận rủi ro': 0, suppress: 0, 'FP đã loại': 0 });

export function gate(inputs, { now = new Date() } = {}) {
  void now;
  const map = new Map();
  for (const k of SOURCE_KEYS) {
    const text = inputs[k];
    if (text === undefined) continue;
    for (const t of Array.isArray(text) ? text : [text]) READERS[k]?.(k, t, map);
  }
  const findings = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1)).map((f, i) => ({ id: `F${String(i + 1).padStart(3, '0')}`, ...f }));
  const count = {
    secret: findings.filter((f) => f.kind === 'secret').length,
    critHigh: findings.filter((f) => f.kind !== 'secret' && (f.severity === 'Critical' || f.severity === 'High')).length,
    rce: 0,
    kev: 0,
  };
  const thresholds = Object.fromEntries(Object.entries(count).map(([k, n]) => [k, {
    status: n > 0 ? 'không đạt' : 'chưa đo',
    count: n,
    missing: [],
    labels: labelsZero(),
  }]));
  const overall = Object.values(thresholds).some((t) => t.status === 'không đạt') ? 'không đạt' : 'chưa đo';
  return { thresholds, overall, findings, warnings: [] };
}

export function parseArgs(argv) {
  const files = {};
  const sarif = [];
  const na = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    const known = flag in FLAGS || flag in REPEATABLE || flag === '--na';
    if (!known) throw new InputError(`cờ không hợp lệ: ${flag}`);
    if (value === undefined || value.startsWith('--')) throw new InputError(`${flag}: thiếu giá trị`);
    i++;
    if (flag === '--na') {
      const eq = value.indexOf('=');
      if (eq <= 0 || eq === value.length - 1) throw new InputError('--na: cần dạng <nguồn>=<bằng chứng>');
      na[value.slice(0, eq)] = value.slice(eq + 1);
    } else if (flag in REPEATABLE) {
      sarif.push(value);
    } else {
      if (FLAGS[flag] in files) throw new InputError(`${flag}: chỉ được dùng một lần`);
      files[FLAGS[flag]] = value;
    }
  }
  if (!SOURCE_KEYS.some((k) => files[k] !== undefined || (k === 'sarif' && sarif.length))) {
    throw new InputError('thiếu đối số: cần ít nhất một cờ nguồn (vd --trivy <file>)');
  }
  return { files, sarif, na };
}

function readFile(key, file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new InputError(`${FLAG_OF[key]}: không đọc được file`, key);
  }
}

export function main(argv) {
  let args;
  const named = {};
  try {
    args = parseArgs(argv);
    const inputs = { na: args.na };
    for (const [k, file] of Object.entries(args.files)) { named[k] = file; inputs[k] = readFile(k, file); }
    if (args.sarif.length) { named.sarif = args.sarif.join(', '); inputs.sarif = args.sarif.map((f) => readFile('sarif', f)); }
    process.stdout.write(`${JSON.stringify(gate(inputs), null, 2)}\n`);
    return 0;
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    console.error(`Lỗi đầu vào: ${e.message}${e.source && named[e.source] ? ` (file: ${named[e.source]})` : ''}`);
    return 2;
  }
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
