// Pin: ví dụ CI review chỉ đọc (docs/requests/2026-10-21-ci-runner), AC1.2–AC1.4.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const file = path.join(REPO_ROOT, 'templates', 'ci', 'claude-review.example.yml');
  const exists = fs.existsSync(file);
  const yml = exists ? fs.readFileSync(file, 'utf8') : '';

  // Dòng chú thích bị bỏ có chủ đích: lời giải thích trong ví dụ được phép nhắc tới pull_request_target, gh api...
  // Chỉ phần YAML thật mới bị kiểm các chuỗi cấm.
  const code = (s) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const indent = (l) => l.match(/^ */)[0].length;
  // Khối neo: từ dòng `key:` đến dòng kế tiếp có thụt lề <= dòng khóa (bỏ dòng trống). Trả mọi khối khớp.
  const blocks = (s, key) => {
    const lines = s.split('\n');
    const re = new RegExp(`^\\s*${key}:`);
    const res = [];
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      const base = indent(lines[i]);
      const out = [lines[i]];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== '' && indent(lines[j]) <= base) break;
        out.push(lines[j]);
      }
      res.push(out.join('\n'));
    }
    return res;
  };
  const block = (s, key) => blocks(s, key)[0] ?? '';
  const SHA = /@([0-9a-f]{40}|<full-40-char-commit-sha>)$/;
  const ALLOWED = new Set(['Read', 'Grep', 'Glob', 'Bash(git diff *)', 'Bash(git log *)']);

  // Mỗi hàm trả danh sách vi phạm (rỗng = đạt) để cùng chạy trên file thật và trên các biến thể đột biến.
  const ac12 = (s) => {
    const c = code(s);
    const v = [];
    if (/pull_request_target/.test(c)) v.push('pull_request_target');
    if (!/^\s+pull_request:/m.test(block(c, 'on'))) v.push('thiếu on.pull_request');
    const perms = blocks(c, 'permissions');
    if (perms.length === 0) v.push('thiếu permissions');
    for (const p of perms) {
      const keys = p.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).sort();
      if (keys.join('|') !== 'contents: read|pull-requests: read') v.push(`permissions sai: ${keys.join(',')}`);
    }
    const uses = c.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
    if (uses.length === 0) v.push('không có uses');
    // Chú thích cuối dòng (vd `# v1`) không phải một phần của ref nên bỏ trước khi so SHA.
    for (const u of uses) if (!SHA.test(u.replace(/\s+#.*$/, '').trim())) v.push(`uses không ghim SHA: ${u.trim()}`);
    return v;
  };

  const ac13 = (s) => {
    const c = code(s);
    const v = [];
    if (/bypassPermissions|--dangerously-skip-permissions/.test(c)) v.push('bypass');
    // prompt và claude_args lấy từ bản gốc: dòng `#` trong scalar nhiều dòng là nội dung thật, không được bỏ.
    const args = block(s, 'claude_args').replace(/\s+/g, ' ');
    if (!/--permission-mode dontAsk\b/.test(args)) v.push('thiếu --permission-mode dontAsk');
    if (!/--max-turns \d+/.test(args)) v.push('thiếu --max-turns');
    if (!/--max-budget-usd \d+(\.\d+)?/.test(args)) v.push('thiếu --max-budget-usd');
    if (/(^|\s)--tools\b/.test(args)) v.push('có cờ --tools');
    if ((args.match(/--allowedTools\b/g) ?? []).length !== 1) v.push('cần đúng một --allowedTools');
    const m = args.match(/--allowedTools\s+"([^"]*)"/);
    if (!m) v.push('thiếu --allowedTools dạng "..."');
    else {
      // split(',') đơn giản: tên công cụ hợp lệ không chứa dấu phẩy, mục nào bị cắt sai sẽ ngoài tập và fail closed.
      const items = m[1].split(',').map((x) => x.trim()).filter(Boolean);
      for (const it of items) if (!ALLOWED.has(it)) v.push(`allowedTools ngoài tập: ${it}`);
      if (items.length === 0) v.push('allowedTools rỗng');
    }
    const prompt = block(s, 'prompt');
    const body = prompt.replace(/^\s*prompt:\s*\|?[>-]?\s*/, '').replace(/^\s*["']/, '').trim();
    if (!/^\/[a-z0-9-]+:[a-z0-9-]+ /.test(body)) v.push('prompt không mở bằng /<plugin>:<skill> ');
    if (/github\.event\.pull_request\.(title|body|head\.ref)/.test(prompt.replace(/\s+/g, ''))) v.push('prompt chứa title/body/head.ref');
    if (prompt.includes('${{')) v.push('prompt chứa ${{');
    return v;
  };

  const ac14 = (s) => {
    const c = code(s);
    const v = [];
    for (const w of ['track_progress', 'use_sticky_comment', 'mcp__github_inline_comment', 'gh pr comment', 'gh pr review', 'gh api']) {
      if (c.includes(w)) v.push(`có ${w}`);
    }
    if (!/display_report:\s*true/.test(c) && !/actions\/upload-artifact@/.test(c)) v.push('thiếu display_report/upload-artifact');
    return v;
  };

  ok(exists, 'P6a AC1.2: templates/ci/claude-review.example.yml tồn tại');
  const run3 = (s) => ({ ac12: ac12(s), ac13: ac13(s), ac14: ac14(s) });
  const good = run3(yml);
  ok(exists && good.ac12.length === 0, `P6a AC1.2: on pull_request (không _target), permissions chỉ contents+pull-requests read, mọi uses ghim SHA ${good.ac12.join('; ')}`);
  ok(exists && good.ac13.length === 0, `P6a AC1.3: claude_args dontAsk + max-turns + max-budget + allowedTools trong tập; prompt mở bằng /plugin:skill, không nội suy event ${good.ac13.join('; ')}`);
  ok(exists && good.ac14.length === 0, `P6a AC1.4: không bình luận/ghi PR, có job summary hoặc artifact ${good.ac14.join('; ')}`);
  if (!exists) return;

  // Đối chứng: mỗi biến thể phá đúng một quy tắc của file tốt; AC nào không được nêu phải vẫn sạch.
  // Mẫu thay không khớp thì ném lỗi và nhóm này tự đỏ, nên pin không thể giả xanh.
  const sub = (a, b) => (s) => { if (!s.includes(a)) throw new Error(`mẫu đột biến không khớp: ${a}`); return s.replace(a, b); };
  const TOOLS_END = 'Bash(git log *)"';
  const mutants = [
    ['(a) thêm Edit vào allowedTools', sub(TOOLS_END, 'Bash(git log *),Edit"'), { ac13: 'allowedTools ngoài tập: Edit' }],
    ['(b) thêm Bash(*)', sub(TOOLS_END, 'Bash(git log *),Bash(*)"'), { ac13: 'allowedTools ngoài tập: Bash(*)' }],
    ['(c) contents: write', sub('contents: read', 'contents: write'), { ac12: 'permissions sai' }],
    ['(d) id-token: write', sub('      pull-requests: read\n', '      pull-requests: read\n      id-token: write\n'), { ac12: 'permissions sai' }],
    ['(e) prompt nội suy body', sub('HEAD^1..HEAD"', 'HEAD^1..HEAD ${{ github.event.pull_request.body }}"'), { ac13: 'prompt chứa title/body/head.ref' }],
    ['(e2) prompt nội suy ${{ khác', sub('HEAD^1..HEAD"', 'HEAD^1..HEAD ${{ github.sha }}"'), { ac13: 'prompt chứa ${{' }],
    ['(f) pull_request_target là khóa thật', sub('  pull_request:\n', '  pull_request_target:\n  pull_request:\n'), { ac12: 'pull_request_target' }],
    ['(g) uses ghim @v4', sub('actions/checkout@<full-40-char-commit-sha>', 'actions/checkout@v4'), { ac12: 'uses không ghim SHA' }],
    ['(h) cờ --allowedTools thứ hai', sub('--max-budget-usd 2', '--max-budget-usd 2 --allowedTools "Edit"'), { ac13: 'cần đúng một --allowedTools' }],
    ['(h2) cờ --tools', sub('--max-budget-usd 2', '--max-budget-usd 2 --tools "Edit"'), { ac13: 'có cờ --tools' }],
    ['(i) track_progress', sub('display_report: true\n', 'display_report: true\n          track_progress: true\n'), { ac14: 'có track_progress' }],
    ['(i2) gh pr comment', sub('    steps:\n', '    steps:\n      - run: gh pr comment 1 --body x\n'), { ac14: 'có gh pr comment' }],
    ['(j) khối permissions thứ hai ở cấp workflow', sub('\njobs:\n', '\npermissions:\n  contents: write\n\njobs:\n'), { ac12: 'permissions sai' }],
    ['(k) write-all', sub('contents: read', 'write-all'), { ac12: 'permissions sai' }],
  ];
  for (const [name, mutate, expect] of mutants) {
    let r;
    try { r = run3(mutate(yml)); } catch (e) { ok(false, `P6a đối chứng ${name}: ${e.message}`); continue; }
    for (const ac of ['ac12', 'ac13', 'ac14']) {
      const want = expect[ac];
      const pass = want ? r[ac].some((m) => m.includes(want)) : r[ac].length === 0;
      ok(pass, `P6a đối chứng ${name}: ${ac} ${want ? `phải báo "${want}"` : 'phải sạch'}, thực tế [${r[ac].join('; ')}]`);
    }
  }

  // Biến thể hợp lệ: chú thích cuối dòng uses và dòng # trong scalar nhiều dòng không được làm pin đỏ oan.
  const rv = run3(sub('actions/checkout@<full-40-char-commit-sha>', 'actions/checkout@<full-40-char-commit-sha>  # đã rà soát')(yml));
  ok(rv.ac12.length === 0, `P6a AC1.2: chú thích cuối dòng uses không làm hỏng kiểm SHA [${rv.ac12.join('; ')}]`);
  const multi = yml.replace(/^( +)claude_args: .*$/m, (_, sp) => `${sp}claude_args: |\n${sp}  --permission-mode dontAsk\n${sp}  # lý do\n${sp}  --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *)" --max-turns 20 --max-budget-usd 2`);
  ok(multi !== yml && ac13(multi).length === 0, `P6a AC1.3: dòng # trong claude_args nhiều dòng không làm hỏng parse [${ac13(multi).join('; ')}]`);
  const multiBad = multi.replace('# lý do', '# lý do\n            --allowedTools "Edit"');
  ok(ac13(multiBad).some((m) => m.includes('cần đúng một --allowedTools')), 'P6a AC1.3: cờ --allowedTools thứ hai trong scalar nhiều dòng vẫn bị bắt');
}
