#!/usr/bin/env node
// Dựng branch `dist` CỤC BỘ chứa build/claude (marketplace plugin-mode). Không push: người dùng tự quyết.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './lib/plugins.mjs';
import { checkCommitMessage } from '../core/skills/git-workflow/scripts/check-commit-message.mjs';

const BRANCH = 'dist';

function listRel(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listRel(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Thuần: file (tương đối, POSIX) của build/claude sẽ vào dist — bỏ drafts/ — và message commit. */
export function distPlan({ buildDir, sourceSha }) {
  const files = listRel(buildDir).filter((f) => !f.startsWith('drafts/'));
  const message = [
    `chore(dist): publish claude marketplace from ${String(sourceSha).slice(0, 7)}`,
    '',
    'Thay đổi:',
    '- Đóng gói build/claude (không gồm drafts/) thành marketplace plugin-mode của Claude Code.',
    '',
    'Lý do:',
    '- Branch dist là nguồn để người dùng chạy claude plugin marketplace add <owner>/<repo>@dist.',
    '',
  ].join('\n');
  return { files, message };
}

/** Thuần: "owner/repo" từ remote GitHub (https hoặc ssh); khác → null. */
export function parseGithubSlug(url) {
  const m = String(url || '').trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

const gitOut = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function removeWorktree(repoRoot, wt) {
  try { execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: repoRoot, stdio: 'pipe' }); } catch { /* rơi về rmSync */ }
  // Junction/thư mục sót trên Windows: xoá bằng Node, không dùng rm -rf.
  try { fs.rmSync(wt, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  try { execFileSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'pipe' }); } catch { /* bỏ qua */ }
}

function branchExists(repoRoot, branch) {
  try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: repoRoot, stdio: 'pipe' }); return true; } catch { return false; }
}

/**
 * Cập nhật branch `dist` cục bộ từ buildDir. Trả { plan, committed }. Ném khi lỗi (CLI bắt → exit 1).
 * `build:false` bỏ bước dựng (test). KHÔNG push, không đụng remote.
 */
export function publishDist({ repoRoot = REPO_ROOT, buildDir = path.join(repoRoot, 'build', 'claude'), build = true, dryRun = false, log = console } = {}) {
  if (build) execFileSync(process.execPath, [path.join(repoRoot, 'cli', 'build.mjs'), '--target', 'claude'], { cwd: repoRoot, stdio: 'inherit' });
  if (!fs.existsSync(path.join(buildDir, '.claude-plugin', 'marketplace.json'))) {
    throw new Error(`Thiếu ${path.join(buildDir, '.claude-plugin', 'marketplace.json')} — build claude chưa chạy?`);
  }
  const sourceSha = gitOut(repoRoot, 'rev-parse', '--short=7', 'HEAD');
  const plan = distPlan({ buildDir, sourceSha });
  if (dryRun) {
    log.log(`[dist] --dry-run: ${plan.files.length} file sẽ vào branch ${BRANCH}:`);
    for (const f of plan.files) log.log(`  ${f}`);
    log.log(`[dist] message commit:\n${plan.message}`);
    return { plan, committed: false };
  }
  if (gitOut(repoRoot, 'status', '--porcelain')) {
    log.log(`[dist] cảnh báo: working tree có thay đổi chưa commit — dist chứa build hiện tại nhưng message ghi ${sourceSha}.`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-dist-'));
  const wt = path.join(tmp, 'wt');
  try {
    if (branchExists(repoRoot, BRANCH)) gitOut(repoRoot, 'worktree', 'add', wt, BRANCH);
    else gitOut(repoRoot, 'worktree', 'add', '--orphan', '-b', BRANCH, wt);

    for (const e of fs.readdirSync(wt)) if (e !== '.git') fs.rmSync(path.join(wt, e), { recursive: true, force: true });
    for (const rel of plan.files) {
      const dest = path.join(wt, ...rel.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(buildDir, ...rel.split('/')), dest);
    }
    gitOut(wt, 'add', '-A');
    if (!gitOut(wt, 'status', '--porcelain')) {
      log.log(`[dist] branch ${BRANCH} đã khớp build hiện tại — không có commit mới.`);
      return { plan, committed: false };
    }
    const msgFile = path.join(tmp, 'commit-msg.txt');
    fs.writeFileSync(msgFile, plan.message, 'utf8');
    const errs = checkCommitMessage(fs.readFileSync(msgFile));
    if (errs.length) throw new Error(`Commit message không hợp lệ: ${errs.join('; ')}`);
    gitOut(wt, 'commit', '-q', '-F', msgFile);
    log.log(`[dist] đã commit ${gitOut(repoRoot, 'rev-parse', '--short', BRANCH)} lên branch ${BRANCH} (cục bộ, CHƯA push).`);
    return { plan, committed: true };
  } finally {
    removeWorktree(repoRoot, wt);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  try {
    const { committed } = publishDist({ dryRun });
    if (dryRun) return 0;
    let slug = null;
    try { slug = parseGithubSlug(gitOut(REPO_ROOT, 'remote', 'get-url', 'origin')); } catch { /* không có origin */ }
    console.log('\nBước tiếp theo (do bạn thực hiện, script này không push):');
    if (committed) console.log(`  git push origin ${BRANCH}`);
    console.log(`  claude plugin marketplace add ${slug || '<owner>/<repo>'}@${BRANCH}`);
    return 0;
  } catch (e) {
    console.error(`[dist] lỗi: ${e.message}`);
    return 1;
  }
}

const invoked = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invoked) process.exitCode = main(process.argv.slice(2));
