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

const stripBom = (t) => (String(t).charCodeAt(0) === 0xfeff ? String(t).slice(1) : String(t));

function parseJson(key, text) {
  try {
    return JSON.parse(stripBom(text));
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
  if (typeof raw !== 'string' && typeof raw !== 'number') throw fail(key, `giá trị ${field} không hợp lệ`);
  const k = String(raw).trim().toUpperCase();
  if (!Object.hasOwn(table, k)) throw fail(key, `giá trị ${field} không hợp lệ`);
  return table[k];
}

// CWE chọn theo owasp-asvs-cwe-mapping.md: injection thực thi lệnh/mã (77, 78, 94, 95), deserialize (502), expression language (917), template injection (1336).
const RCE_CWES = new Set([77, 78, 94, 95, 502, 917, 1336]);
const RCE_LABEL = /remote code execution/i;
const ZAP_SEVERITY = { 3: 'High', 2: 'Medium', 1: 'Low', 0: 'Info' };
const SARIF_LEVEL = { ERROR: 'High', WARNING: 'Medium', NOTE: 'Low', NONE: 'Info' };
const COVERITY_IMPACT = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const NESSUS_RISK = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', NONE: 'Info' };
const BLACKDUCK_SEVERITY = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', NONE: 'Info', UNKNOWN: 'Info', INFO: 'Info' };
const SONAR_SEVERITY = { BLOCKER: 'Critical', CRITICAL: 'High', MAJOR: 'Medium', MINOR: 'Low', INFO: 'Info' };
// impacts.severity của Sonar MQR có thêm BLOCKER/INFO ngoài HIGH/MEDIUM/LOW; thiếu ánh xạ thì report hợp lệ bị exit 2.
const SONAR_IMPACT = { BLOCKER: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', INFO: 'Info' };
const DAY_MS = 24 * 60 * 60 * 1000;

const cweNumbers = (text) => [...String(text).matchAll(/cwe[-_/ ]?0*(\d+)/gi)].map((m) => Number(m[1]));
const isRce = (cwe, title) => cwe.some((c) => RCE_CWES.has(c)) || RCE_LABEL.test(title);
const cweSuffix = (cwe) => (cwe.length ? `+${[...cwe].sort((a, b) => a - b).map((c) => `CWE-${c}`).join('+')}` : '');

function codeFinding(source, file, line, severity, cwe, title) {
  return { source, kind: 'code', severity, key: `${file}:${line}${cweSuffix(cwe)}`, location: `${file}:${line}`, cwe, title, rce: isRce(cwe, title), scope: 'code' };
}

const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, SEVERITIES.length - i]));
const maxSeverity = (list) => list.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));

function addFinding(map, f) {
  const cur = map.get(f.key);
  if (!cur) {
    map.set(f.key, { ...f, sources: [f.source], source: undefined, cve: f.cve || [], cwe: f.cwe || [], labels: [] });
    return;
  }
  if (!cur.sources.includes(f.source)) cur.sources.push(f.source);
  if (RANK[f.severity] > RANK[cur.severity]) cur.severity = f.severity;
  cur.rce = cur.rce || f.rce;
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
    for (const field of ['Vulnerabilities', 'Secrets']) {
      if (res[field] != null && !Array.isArray(res[field])) throw fail(key, `${field} phải là mảng`);
    }
    for (const v of res.Vulnerabilities || []) {
      const id = requireField(key, v, 'VulnerabilityID', 'string');
      const severity = normalizeSeverity(key, 'Severity', requireField(key, v, 'Severity'), TRIVY_SEVERITY);
      if (v.CweIDs != null && (!Array.isArray(v.CweIDs) || v.CweIDs.some((c) => typeof c !== 'string'))) throw fail(key, 'CweIDs phải là mảng chuỗi');
      const cwe = (v.CweIDs || []).flatMap(cweNumbers);
      const title = typeof v.Title === 'string' ? v.Title : '';
      addFinding(map, { source: 'trivy', kind: 'vuln', severity, key: `${id}@${asset}`, location: `${v.PkgName ?? '?'}@${v.InstalledVersion ?? '?'}`, cve: [id], cwe, title, rce: isRce(cwe, title), scope: 'image' });
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

function sarifSeverity(key, res, rule) {
  const score = res.properties?.['security-severity'] ?? rule.properties?.['security-severity'];
  if (score !== undefined && score !== null) {
    const n = typeof score === 'number' || (typeof score === 'string' && score.trim() !== '') ? Number(score) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 10) throw fail(key, 'giá trị security-severity không hợp lệ');
    if (n >= 9) return 'Critical';
    if (n >= 7) return 'High';
    if (n >= 4) return 'Medium';
    return n > 0 ? 'Low' : 'Info';
  }
  const level = res.level ?? rule.defaultConfiguration?.level;
  if (level === undefined || level === null) throw fail(key, 'thiếu security-severity và level');
  return normalizeSeverity(key, 'level', level, SARIF_LEVEL);
}

function readSarif(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.runs)) throw fail(key, 'thiếu mảng runs');
  for (const run of doc.runs) {
    if (run === null || typeof run !== 'object' || Array.isArray(run)) throw fail(key, 'phần tử runs phải là object');
    if (run.results != null && !Array.isArray(run.results)) throw fail(key, 'results phải là mảng');
    const rules = new Map((run?.tool?.driver?.rules || []).map((r) => [r.id, r]));
    for (const res of run?.results || []) {
      const rule = rules.get(res?.ruleId) || {};
      const severity = sarifSeverity(key, res, rule);
      const phys = res.locations?.[0]?.physicalLocation;
      const file = requireField(key, phys?.artifactLocation, 'uri', 'string');
      const line = requireField(key, phys?.region, 'startLine', 'number');
      const tagLists = [rule.properties?.tags, res.properties?.tags].filter((t) => t != null);
      if (tagLists.some((t) => !Array.isArray(t) || t.some((x) => typeof x !== 'string'))) throw fail(key, 'tags phải là mảng chuỗi');
      const tags = tagLists.flat();
      const cwe = [...new Set(tags.flatMap(cweNumbers))];
      const title = [rule.shortDescription?.text, rule.name, res.message?.text].filter((t) => typeof t === 'string').join(' ');
      addFinding(map, codeFinding('sarif', file, line, severity, cwe, title));
    }
  }
}

function readCoverity(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.issues)) throw fail(key, 'thiếu mảng issues');
  for (const issue of doc.issues) {
    const file = requireField(key, issue, 'mainEventFilePathname', 'string');
    const line = requireField(key, issue, 'mainEventLineNumber', 'number');
    const props = requireField(key, issue, 'checkerProperties', 'object');
    const severity = normalizeSeverity(key, 'impact', requireField(key, props, 'impact'), COVERITY_IMPACT);
    const rawCwe = props.cweCategory;
    if (rawCwe != null && typeof rawCwe !== 'string' && typeof rawCwe !== 'number') throw fail(key, 'cweCategory phải là chuỗi hoặc số');
    if (rawCwe != null && !/^(cwe-)?\d+$/i.test(String(rawCwe).trim())) throw fail(key, 'cweCategory phải là số CWE');
    const cwe = rawCwe == null ? [] : cweNumbers(`cwe-${String(rawCwe).replace(/^cwe-/i, '')}`);
    const title = [props.categoryDescription, issue.checkerName].filter((t) => typeof t === 'string').join(' ');
    addFinding(map, codeFinding('coverity', file, line, severity, cwe, title));
  }
}

function readZap(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.site)) throw fail(key, 'thiếu mảng site');
  for (const site of doc.site) {
    const alerts = requireField(key, site, 'alerts', 'object');
    if (!Array.isArray(alerts)) throw fail(key, 'alerts phải là mảng');
    for (const a of alerts) {
      const name = a?.alert ?? a?.name;
      if (typeof name !== 'string') throw fail(key, 'thiếu hoặc sai kiểu trường alert');
      const severity = normalizeSeverity(key, 'riskcode', requireField(key, a, 'riskcode'), ZAP_SEVERITY);
      const cweText = typeof a.cweid === 'string' || typeof a.cweid === 'number' ? String(a.cweid).trim() : a.cweid == null ? '' : null;
      if (cweText === null || (cweText !== '' && !/^-?\d+$/.test(cweText))) throw fail(key, 'cweid không hợp lệ');
      const cwe = Number(cweText || 0) > 0 ? [Number(cweText)] : [];
      const uris = (a.instances || []).map((i) => i?.uri).filter((u) => typeof u === 'string');
      for (const uri of uris.length ? uris : [requireField(key, site, '@name', 'string')]) {
        addFinding(map, { source: 'zap', kind: 'web', severity, key: `${name}@${uri}`, location: uri, cwe, title: name, rce: isRce(cwe, name), scope: 'web' });
      }
    }
  }
}

// CSV tối thiểu: nháy kép, phẩy và xuống dòng trong ô nháy kép, nháy kép đôi.
function parseCsv(key, text) {
  const src = stripBom(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += c;
    }
  }
  if (quoted) throw fail(key, 'CSV có nháy kép không đóng');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function readNessus(key, text, map) {
  const rows = parseCsv(key, text);
  if (!rows.length) throw fail(key, 'CSV rỗng, không có dòng tiêu đề');
  const header = rows[0].map((h) => h.trim());
  for (const col of ['Plugin ID', 'CVE', 'Risk', 'Host']) if (!header.includes(col)) throw fail(key, `thiếu cột ${col}`);
  for (const r of rows.slice(1)) {
    const get = (col) => (r[header.indexOf(col)] ?? '').trim();
    const host = get('Host');
    if (!host) throw fail(key, 'cột Host rỗng');
    const severity = normalizeSeverity(key, 'Risk', get('Risk'), NESSUS_RISK);
    const title = get('Name');
    const port = get('Port');
    const location = port ? `${host}:${port}` : host;
    const cves = [...new Set((get('CVE').match(/CVE-\d{4}-\d+/gi) || []).map((c) => c.toUpperCase()))];
    const base = { source: 'nessus', kind: 'vuln', severity, location, cwe: [], title, rce: isRce([], title), scope: 'host' };
    if (cves.length) {
      for (const cve of cves) addFinding(map, { ...base, key: `${cve}@${host}`, cve: [cve] });
    } else {
      const plugin = get('Plugin ID');
      if (!plugin) throw fail(key, 'cột Plugin ID rỗng ở dòng không có CVE');
      addFinding(map, { ...base, key: `${plugin}@${host}`, cve: [] });
    }
  }
}

function readBlackduck(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.vulnerabilities)) throw fail(key, 'thiếu mảng vulnerabilities (CycloneDX)');
  for (const v of doc.vulnerabilities) {
    const id = requireField(key, v, 'id', 'string');
    const ratings = requireField(key, v, 'ratings', 'object');
    const affects = requireField(key, v, 'affects', 'object');
    if (!Array.isArray(ratings) || !ratings.length) throw fail(key, 'ratings phải là mảng không rỗng');
    if (!Array.isArray(affects) || !affects.length) throw fail(key, 'affects phải là mảng không rỗng');
    const severity = maxSeverity(ratings.map((r) => normalizeSeverity(key, 'severity', requireField(key, r, 'severity'), BLACKDUCK_SEVERITY)));
    if (v.cwes != null && (!Array.isArray(v.cwes) || v.cwes.some((c) => !Number.isInteger(c)))) throw fail(key, 'cwes phải là mảng số nguyên');
    const cwe = v.cwes || [];
    const title = typeof v.description === 'string' ? v.description : '';
    for (const a of affects) {
      const ref = requireField(key, a, 'ref', 'string');
      addFinding(map, { source: 'blackduck', kind: 'vuln', severity, key: `${id}@${ref}`, location: ref, cve: /^CVE-/i.test(id) ? [id.toUpperCase()] : [], cwe, title, rce: isRce(cwe, title), scope: 'component' });
    }
  }
}

function readSonar(key, text, map) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.issues)) throw fail(key, 'thiếu mảng issues');
  for (const issue of doc.issues) {
    // Chỉ VULNERABILITY là chỉ tiêu bảo mật; BUG và CODE_SMELL không vào findings.
    if (requireField(key, issue, 'type', 'string') !== 'VULNERABILITY') continue;
    const levels = [];
    if (issue.severity != null) levels.push(normalizeSeverity(key, 'severity', issue.severity, SONAR_SEVERITY));
    if (issue.impacts != null) {
      if (!Array.isArray(issue.impacts)) throw fail(key, 'impacts phải là mảng');
      for (const imp of issue.impacts) {
        if (imp?.softwareQuality === 'SECURITY') levels.push(normalizeSeverity(key, 'impacts.severity', requireField(key, imp, 'severity'), SONAR_IMPACT));
      }
    }
    if (!levels.length) throw fail(key, 'thiếu severity hoặc impacts SECURITY');
    const component = requireField(key, issue, 'component', 'string');
    const file = component.includes(':') ? component.slice(component.indexOf(':') + 1) : component;
    const line = issue.line == null ? 0 : requireField(key, issue, 'line', 'number');
    const lists = [issue.cwe, issue.tags].filter((l) => l != null);
    if (lists.some((l) => !Array.isArray(l) || l.some((x) => typeof x !== 'string' && typeof x !== 'number'))) throw fail(key, 'cwe và tags phải là mảng chuỗi hoặc số');
    const cwe = [...new Set(lists.flat().flatMap((x) => cweNumbers(/^\s*\d+\s*$/.test(String(x)) ? `cwe-${x}` : String(x))))];
    const title = [issue.message, issue.rule].filter((t) => typeof t === 'string').join(' ');
    addFinding(map, codeFinding('sonar', file, line, maxSeverity(levels), cwe, title));
  }
}

function readKev(key, text, now, warnings) {
  const doc = parseJson(key, text);
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.vulnerabilities)) throw fail(key, 'thiếu mảng vulnerabilities');
  const cves = new Set(doc.vulnerabilities.map((v) => requireField(key, v, 'cveID', 'string').trim().toUpperCase()));
  const released = doc.dateReleased;
  const t = typeof released === 'string' ? Date.parse(released) : NaN;
  if (released == null || released === '') warnings.push('KEV: file không có dateReleased, không kiểm được độ mới');
  else if (Number.isNaN(t)) warnings.push('KEV: dateReleased không đọc được, không kiểm được độ mới');
  else if (now - t > 7 * DAY_MS) warnings.push(`KEV: file phát hành ${Math.floor((now - t) / DAY_MS)} ngày trước, cũ hơn 7 ngày; tải bản mới trước khi kết luận`);
  return cves;
}

const READERS = { gitleaksTree: readGitleaks, gitleaksHistory: readGitleaks, trivy: readTrivy, sarif: readSarif, coverity: readCoverity, zap: readZap, nessus: readNessus, blackduck: readBlackduck, sonar: readSonar };
const labelsZero = () => ({ 'chấp nhận rủi ro': 0, suppress: 0, 'FP đã loại': 0 });

// JSON hợp lệ nhưng sai cấu trúc làm reader ném TypeError: đổi thành lỗi đầu vào (exit 2), không chép message gốc.
function guard(key, fn) {
  try {
    return fn();
  } catch (e) {
    throw e instanceof InputError ? e : fail(key, 'cấu trúc report không đúng');
  }
}

export function gate(inputs, { now = new Date() } = {}) {
  const map = new Map();
  const warnings = [];
  const kevCves = inputs.kev === undefined ? new Set() : guard('kev', () => readKev('kev', inputs.kev, now, warnings));
  for (const k of SOURCE_KEYS) {
    const text = inputs[k];
    if (text === undefined) continue;
    for (const t of Array.isArray(text) ? text : [text]) guard(k, () => READERS[k]?.(k, t, map));
  }
  const findings = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1)).map(({ title, ...f }, i) => ({ id: `F${String(i + 1).padStart(3, '0')}`, ...f, rce: f.kind !== 'secret' && !!f.rce, kev: f.kind !== 'secret' && (f.cve || []).some((c) => kevCves.has(c)) }));
  const count = {
    secret: findings.filter((f) => f.kind === 'secret').length,
    critHigh: findings.filter((f) => f.kind !== 'secret' && (f.severity === 'Critical' || f.severity === 'High')).length,
    rce: findings.filter((f) => f.rce).length,
    kev: findings.filter((f) => f.kev).length,
  };
  const thresholds = Object.fromEntries(Object.entries(count).map(([k, n]) => [k, {
    status: n > 0 ? 'không đạt' : 'chưa đo',
    count: n,
    missing: [],
    labels: labelsZero(),
  }]));
  const overall = Object.values(thresholds).some((t) => t.status === 'không đạt') ? 'không đạt' : 'chưa đo';
  return { thresholds, overall, findings, warnings };
}

export function parseArgs(argv) {
  const files = {};
  const sarif = [];
  const na = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    const known = Object.hasOwn(FLAGS, flag) || Object.hasOwn(REPEATABLE, flag) || flag === '--na';
    if (!known) throw new InputError(`cờ không hợp lệ: ${flag}`);
    if (value === undefined || value.startsWith('--')) throw new InputError(`${flag}: thiếu giá trị`);
    i++;
    if (flag === '--na') {
      const eq = value.indexOf('=');
      if (eq <= 0 || eq === value.length - 1) throw new InputError('--na: cần dạng <nguồn>=<bằng chứng>');
      na[value.slice(0, eq)] = value.slice(eq + 1);
    } else if (Object.hasOwn(REPEATABLE, flag)) {
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
