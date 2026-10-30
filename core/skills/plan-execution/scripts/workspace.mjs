// Thư mục chạy của một plan: <gốc repo chính>/.aip/runs/<request>/<part>/ (ledger, brief, review package); không phải CLI, chỉ được import.
// Cách dùng: resolveWorkspace(<thư mục request | đường dẫn plan.md>, deps?) → { dir, root, request, part, plan, fallback }; tạo dir và <root>/.aip/.gitignore.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import nodeFs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PLAN_RE = /(?:^|\/)docs\/requests\/([^/]+)\/(?:plan\.md|parts\/(\d{2}-[a-z0-9][a-z0-9-]*)\/plan\.md)$/;
// Chỉ lỗi quyền/FS chỉ-đọc mới đáng lui về gốc worktree; ENOSPC, EIO... là lỗi môi trường thật nên phải lộ ra.
const FALLBACK_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Git trên Windows có thể trả `E:\repo\.git`; chỉ đổi `\` khi là đường dẫn ổ đĩa để không phá tên thư mục POSIX chứa `\`.
const fwd = (p) => (/^[A-Za-z]:[\\/]/.test(p) ? p.replace(/\\/g, '/') : p);
// Ổ đĩa Windows không phân biệt hoa thường (`e:/repo` = `E:\repo`); đường dẫn POSIX thì có.
const key = (p) => { const n = fwd(p).replace(/\/+$/, ''); return /^[A-Za-z]:/.test(n) ? n.toLowerCase() : n; };

export function resolveWorkspace(planArg, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const git = deps.git ?? defaultGit;
  const fs = { ...nodeFs, ...deps.fs };
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));

  let abs = path.resolve(cwd, planArg);
  let isDir = false;
  try { isDir = fs.statSync(abs).isDirectory(); } catch { /* chưa tồn tại: coi là đường dẫn file plan */ }
  if (isDir) abs = path.join(abs, 'plan.md');

  const m = PLAN_RE.exec(abs.replace(/\\/g, '/'));
  const request = m ? m[1] : path.basename(path.dirname(abs));
  const part = m?.[2] ?? 'root';

  // Gốc repo chính (không phải gốc worktree): worktree con bị xoá cùng .aip/ của nó, còn trạng thái chạy phải sống qua việc dọn worktree.
  let main = cwd;
  let top = cwd;
  try {
    main = path.dirname(fwd(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)));
    top = fwd(git(['rev-parse', '--show-toplevel'], cwd));
  } catch { /* không phải repo hoặc không có git: dùng cwd */ }

  const create = (root) => {
    // .aip là symlink thì ledger, brief bị ghi ra chỗ nó trỏ tới, ngoài repo: từ chối thay vì đi theo.
    let link = false;
    try { link = fs.lstatSync(path.join(root, '.aip')).isSymbolicLink(); } catch (e) { if (e?.code !== 'ENOENT') throw e; }
    if (link) throw new Error(`${path.join(root, '.aip')} là symlink, từ chối ghi workspace qua symlink`);
    const dir = path.join(root, '.aip', 'runs', request, part);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(root, '.aip', '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
    return { dir, root: path.normalize(root), request, part, plan: abs, fallback: false };
  };

  try {
    return create(main);
  } catch (e) {
    // Ở chính gốc repo chính thì không còn chỗ lui: thử lại cùng thư mục chỉ lặp lỗi.
    if (!FALLBACK_CODES.has(e?.code) || key(main) === key(top)) throw e;
  }
  const res = { ...create(top), fallback: true };
  stderr(`aip: không ghi được ${path.join(main, '.aip')}, dùng ${res.dir}\n`);
  return res;
}
