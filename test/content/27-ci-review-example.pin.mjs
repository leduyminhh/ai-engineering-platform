// Pin: ví dụ CI review chỉ đọc (docs/requests/2026-10-21-ci-runner), AC1.2–AC1.4.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const file = path.join(REPO_ROOT, 'templates', 'ci', 'claude-review.example.yml');
  const exists = fs.existsSync(file);
  const yml = exists ? fs.readFileSync(file, 'utf8') : '';

  // Bỏ dòng chú thích để các chuỗi cấm chỉ bị bắt ở phần YAML thật, không bị bắt ở lời giải thích.
  const code = (s) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const indent = (l) => l.match(/^ */)[0].length;
  // Khối neo: từ dòng `key:` đến dòng kế tiếp có thụt lề <= dòng khóa (bỏ dòng trống).
  const block = (s, key) => {
    const lines = s.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^\\s*${key}:`).test(l));
    if (i < 0) return '';
    const base = indent(lines[i]);
    const out = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '' && indent(lines[j]) <= base) break;
      out.push(lines[j]);
    }
    return out.join('\n');
  };
  const SHA = /@([0-9a-f]{40}|<full-40-char-commit-sha>)\s*$/;
  const ALLOWED = new Set(['Read', 'Grep', 'Glob', 'Bash(git diff *)', 'Bash(git log *)']);

  // Mỗi hàm trả danh sách vi phạm (rỗng = đạt) để cùng chạy trên file thật và trên mẫu xấu đối chứng.
  const ac12 = (s) => {
    const c = code(s);
    const v = [];
    if (/pull_request_target/.test(c)) v.push('pull_request_target');
    if (!/^\s+pull_request:/m.test(block(c, 'on'))) v.push('thiếu on.pull_request');
    const perm = block(c, 'permissions').split('\n').slice(1).map((l) => l.trim()).filter(Boolean).sort();
    if (perm.join('|') !== ['contents: read', 'pull-requests: read'].sort().join('|')) v.push(`permissions: ${perm.join(',')}`);
    const uses = c.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
    if (uses.length === 0) v.push('không có uses');
    for (const u of uses) if (!SHA.test(u.trim())) v.push(`uses không ghim SHA: ${u.trim()}`);
    return v;
  };

  const ac13 = (s) => {
    const c = code(s);
    const v = [];
    if (/bypassPermissions|--dangerously-skip-permissions/.test(c)) v.push('bypass');
    const args = block(c, 'claude_args').replace(/\s+/g, ' ');
    if (!/--permission-mode dontAsk\b/.test(args)) v.push('thiếu --permission-mode dontAsk');
    if (!/--max-turns \d+/.test(args)) v.push('thiếu --max-turns');
    if (!/--max-budget-usd \d+(\.\d+)?/.test(args)) v.push('thiếu --max-budget-usd');
    const m = args.match(/--allowedTools\s+"([^"]*)"/);
    if (!m) v.push('thiếu --allowedTools dạng "..."');
    else {
      // Tách theo dấu phẩy ngoài ngoặc để `Bash(git diff *)` không bị cắt giữa chừng.
      const items = m[1].split(',').map((x) => x.trim()).filter(Boolean);
      for (const it of items) if (!ALLOWED.has(it)) v.push(`allowedTools ngoài tập: ${it}`);
      if (items.length === 0) v.push('allowedTools rỗng');
    }
    const prompt = block(c, 'prompt');
    const body = prompt.replace(/^\s*prompt:\s*\|?[>-]?\s*/, '').replace(/^\s*["']/, '').trim();
    if (!/^\/[a-z0-9-]+:[a-z0-9-]+ /.test(body)) v.push('prompt không mở bằng /<plugin>:<skill> ');
    if (/github\.event\.pull_request\.(title|body|head\.ref)/.test(prompt.replace(/\s+/g, ''))) v.push('prompt chứa title/body/head.ref');
    if (/\$\{\{\s*github\.event\./.test(prompt)) v.push('prompt chứa ${{ github.event.');
    return v;
  };

  const ac14 = (s) => {
    const c = code(s);
    const v = [];
    for (const w of ['track_progress', 'use_sticky_comment', 'mcp__github_inline_comment', 'gh pr comment', 'gh pr review', 'gh api']) {
      if (c.includes(w)) v.push(`có ${w}`);
    }
    if (/(issues|pull-requests|contents):\s*write/.test(c)) v.push('quyền write');
    if (!/display_report:\s*true/.test(c) && !/actions\/upload-artifact@/.test(c)) v.push('thiếu display_report/upload-artifact');
    return v;
  };

  ok(exists, 'P6a AC1.2: templates/ci/claude-review.example.yml tồn tại');
  const r12 = ac12(yml), r13 = ac13(yml), r14 = ac14(yml);
  ok(exists && r12.length === 0, `P6a AC1.2: on pull_request (không _target), permissions chỉ contents+pull-requests read, mọi uses ghim SHA ${r12.join('; ')}`);
  ok(exists && r13.length === 0, `P6a AC1.3: claude_args dontAsk + max-turns + max-budget + allowedTools trong tập; prompt mở bằng /plugin:skill, không nội suy event ${r13.join('; ')}`);
  ok(exists && r14.length === 0, `P6a AC1.4: không bình luận/ghi PR, không quyền write, có job summary hoặc artifact ${r14.join('; ')}`);

  // Đối chứng: YAML xấu cố ý phải bị từng kiểm tra bắt, nếu không pin là giả.
  const bad = [
    'on:',
    '  pull_request_target:',
    'permissions:',
    '  contents: write',
    '  pull-requests: read',
    'jobs:',
    '  review:',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: anthropics/claude-code-action@v1',
    '        with:',
    '          track_progress: true',
    '          prompt: "/backend:backend-code-review ${{ github.event.pull_request.body }}"',
    '          claude_args: --permission-mode bypassPermissions --allowedTools "Bash,Read"',
    '',
  ].join('\n');
  ok(ac12(bad).length >= 3, 'P6a AC1.2: đối chứng bắt được pull_request_target, quyền write, uses không ghim SHA');
  ok(ac13(bad).length >= 4, 'P6a AC1.3: đối chứng bắt được bypass, Bash trần, thiếu max-turns, prompt nội suy body');
  ok(ac14(bad).length >= 2, 'P6a AC1.4: đối chứng bắt được track_progress, quyền write, thiếu job summary');
}
