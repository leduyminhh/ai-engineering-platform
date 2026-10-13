#!/usr/bin/env node
// Đề xuất version kế tiếp từ Conventional Commits cho skill git-release.
// Tag Gitflow nằm trên merge commit của production branch, không phải tổ tiên của develop,
// nên lấy tag semver lớn nhất toàn repo thay vì `git describe`.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const HEADER = /^([a-z]+)(?:\([^)]*\))?(!)?: \S/;
const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
const BY_RANK = ['none', 'patch', 'minor', 'major'];

export function parseVersion(tag, prefix = 'v') {
  if (!tag.startsWith(prefix)) return null;
  const m = SEMVER.exec(tag.slice(prefix.length));
  return m ? m.slice(1).map(Number) : null;
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function latestTag(tags, prefix = 'v') {
  let best = null;
  for (const tag of tags) {
    const v = parseVersion(tag, prefix);
    if (v && (!best || cmp(v, best.version) > 0)) best = { tag, version: v };
  }
  return best;
}

export function classify(message) {
  const [header = '', ...rest] = message.replace(/\r\n/g, '\n').trim().split('\n');
  const m = HEADER.exec(header);
  const breaking = (!!m && m[2] === '!') || /^BREAKING[ -]CHANGE: /m.test(rest.join('\n'));
  return { type: m ? m[1] : null, breaking, header };
}

function bumpOf({ type, breaking }) {
  if (breaking) return 'major';
  if (type === 'feat') return 'minor';
  if (type === 'fix' || type === 'perf') return 'patch';
  return 'none';
}

function apply([major, minor, patch], bump) {
  if (bump === 'major') return [major + 1, 0, 0];
  if (bump === 'minor') return [major, minor + 1, 0];
  if (bump === 'patch') return [major, minor, patch + 1];
  return null;
}

/** commits: [{ hash, message }]; current: [major, minor, patch]. */
export function computeNext({ current, commits, hotfix = false, zeroMajorBreaking = 'minor', tagPrefix = 'v' }) {
  const groups = { breaking: [], feat: [], fix: [], other: [] };
  const warnings = [];
  let rank = 0;
  for (const { hash, message } of commits) {
    const c = classify(message);
    const entry = { hash, header: c.header };
    rank = Math.max(rank, RANK[bumpOf(c)]);
    if (c.breaking) groups.breaking.push(entry);
    else if (c.type === 'feat') groups.feat.push(entry);
    else if (c.type === 'fix' || c.type === 'perf') groups.fix.push(entry);
    else groups.other.push(entry);
    if (!c.type) warnings.push(`không theo Conventional Commits: ${hash.slice(0, 7)} ${c.header}`);
    if (hotfix && (c.breaking || c.type === 'feat')) warnings.push(`hotfix chứa commit ${c.breaking ? 'breaking' : 'feat'}: ${hash.slice(0, 7)} ${c.header}`);
  }
  // Hotfix luôn patch+1 kể cả khi chưa có commit: `hotfix start` chạy ngay trên tag.
  let bump = hotfix ? 'patch' : BY_RANK[rank];
  if (bump === 'major' && current[0] === 0 && zeroMajorBreaking === 'minor') bump = 'minor';
  const nextV = apply(current, bump);
  const next = nextV ? nextV.join('.') : null;
  return {
    current: current.join('.'),
    next,
    nextDev: nextV ? `${nextV[0]}.${nextV[1] + 1}.0` : null,
    bump,
    tag: next ? `${tagPrefix}${next}` : null,
    groups,
    warnings,
  };
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseArgs(argv) {
  const opts = { base: null, hotfix: false, tagPrefix: 'v', json: false, zeroBreaking: 'minor' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--hotfix') opts.hotfix = true;
    else if (a === '--tag-prefix') opts.tagPrefix = argv[++i] ?? '';
    else if (a === '--json') opts.json = true;
    else if (a === '--zero-breaking') opts.zeroBreaking = argv[++i];
    else throw new Error(`tham số không hợp lệ: ${a}`);
  }
  if (!opts.base) throw new Error('thiếu --base <ref>');
  if (!['minor', 'major'].includes(opts.zeroBreaking)) throw new Error('--zero-breaking chỉ nhận minor|major');
  return opts;
}

function render(r) {
  const lines = [`current ${r.current}  range ${r.range}`];
  for (const [name, list] of Object.entries(r.groups)) {
    lines.push(`${name} (${list.length})`);
    for (const c of list) lines.push(`  ${c.hash.slice(0, 7)} ${c.header}`);
  }
  lines.push(r.next ? `bump: ${r.bump} → ${r.next} (tag ${r.tag})` : 'bump: none — không có commit cần release');
  for (const w of r.warnings) lines.push(`⚠ ${w}`);
  return lines.join('\n');
}

export function main(argv, cwd = process.cwd()) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`✗ ${e.message}`); return 1; }
  try { git(['rev-parse', '--git-dir'], cwd); } catch { console.error('✗ không phải git repo'); return 1; }
  try { git(['rev-parse', '--verify', '--quiet', `${opts.base}^{commit}`], cwd); } catch { console.error(`✗ ref không tồn tại: ${opts.base}`); return 1; }
  const latest = latestTag(git(['tag', '--list'], cwd).split('\n').map((s) => s.trim()).filter(Boolean), opts.tagPrefix);
  if (!latest) { console.error(`✗ chưa có tag dạng ${opts.tagPrefix}X.Y.Z — hỏi người dùng version khởi điểm`); return 1; }
  const range = `${latest.tag}..${opts.base}`;
  const commits = git(['log', '--no-merges', '--format=%H%x1f%B%x1e', range], cwd)
    .split('\x1e').map((s) => s.trim()).filter(Boolean)
    .map((rec) => { const [hash, message = ''] = rec.split('\x1f'); return { hash, message }; });
  const r = { ...computeNext({ current: latest.version, commits, hotfix: opts.hotfix, zeroMajorBreaking: opts.zeroBreaking, tagPrefix: opts.tagPrefix }), range };
  console.log(opts.json ? JSON.stringify(r, null, 2) : render(r));
  return r.next ? 0 : 2;
}

const invoked = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invoked) process.exitCode = main(process.argv.slice(2));
