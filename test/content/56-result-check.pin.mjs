// Pin: docs/requests/2026-11-25-agent-session-result-contract — result-check.mjs (dòng aip-report, agent_result) và tài liệu đi kèm.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, REPO_ROOT } = ctx;
  const scriptPath = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'result-check.mjs');
  if (!fs.existsSync(scriptPath)) { ok(false, 'AC3.1: result-check.mjs tồn tại'); return; }
  const rc = await import(pathToFileURL(scriptPath).href);
  const roots = [];
  const write = (name, body) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'result-check-'));
    roots.push(root);
    const abs = path.join(root, name);
    fs.writeFileSync(abs, body);
    return abs;
  };
  const cli = (args) => {
    const r = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* exit 2 không in JSON */ }
    return { code: r.status, json };
  };
  const rules = (res) => res.violations.map((v) => v.rule);

  try {
    // AC2.1–AC2.5: dòng aip-report
    const GOOD = 'aip-report v1 from=part-02 status=complete hash=abc1234 tests=pass minor=2 file=.aip/runs/x/02-y/progress.md';
    // note giữ dưới trần 120 nên phần đệm nằm ở file=; chữ có dấu kiểm cách đếm code point.
    const pad = (n) => {
      const head = 'aip-report v1 from=part-02 status=blocked note="thiếu quyền ghi" file=';
      return `${head}${'ệ'.repeat(n - [...head].length)}`;
    };
    const LINES = [
      ['AC2.1: dòng mẫu hợp lệ', GOOD, true],
      ['AC2.2: complete thiếu hash', 'aip-report v1 from=part-02 status=complete tests=pass', false, 'hash'],
      ['AC2.2: complete thiếu tests', 'aip-report v1 from=part-02 status=complete hash=abc1234', false, 'tests'],
      ['AC2.3: blocked thiếu note', 'aip-report v1 from=root status=blocked', false, 'note'],
      ['AC2.3: failed thiếu note', 'aip-report v1 from=root status=failed', false, 'note'],
      ['AC2.3: blocked có note', 'aip-report v1 from=root status=blocked note="thiếu quyền ghi .aip"', true],
      ['AC2.5: thiếu v1', 'aip-report from=root status=blocked note="x"', false],
      ['AC2.5: status ngoài tập', 'aip-report v1 from=root status=done hash=abc1234 tests=pass', false],
      ['AC2.5: giá trị có khoảng trắng ngoài note', 'aip-report v1 from=part 02 status=complete hash=abc1234 tests=pass', false],
      ['note chứa = và khoảng trắng', 'aip-report v1 from=root status=failed note="a=b c  d"', true],
      ['dòng kết thúc \\r', `${GOOD}\r`, true],
      ['AC2.3: note rỗng', 'aip-report v1 from=root status=blocked note=""', false, 'note'],
      ['AC2.3: note không nháy kép', 'aip-report v1 from=root status=blocked note=abc', false, 'note'],
      ['AC2.3: note mở nháy không đóng', 'aip-report v1 from=root status=blocked note="abc', false, 'note'],
      ['AC2.3: note 121 code point', `aip-report v1 from=root status=blocked note="${'ệ'.repeat(121)}"`, false, 'note'],
      ['khoá lạ', `${GOOD} extra=1`, false, 'extra'],
      ['khoá lặp', `${GOOD} minor=3`, false, 'minor'],
      ['nháy kép ngoài note', 'aip-report v1 from="root" status=blocked note="x"', false, 'from'],
      ['nhiều dòng', `${GOOD}\n${GOOD}`, false],
    ];
    for (const [name, line, good, key] of LINES) {
      const res = rc.checkReportLine(line);
      ok(res.ok === good && (good ? res.violations.length === 0 : res.violations.length > 0), name);
      if (key) ok(res.violations.some((v) => v.detail.includes(key)), `${name}: detail nêu ${key}`);
    }
    // AC2.4: trần đếm theo code point, note có chữ tiếng Việt có dấu
    const at400 = pad(400);
    const at401 = pad(401);
    ok([...at400].length === 400 && [...at401].length === 401, 'AC2.4: dựng đúng dòng 400 và 401 code point');
    ok(rc.checkReportLine(at400).ok === true, 'AC2.4: 400 code point đạt');
    ok(rules(rc.checkReportLine(at401)).includes('line-too-long'), 'AC2.4: 401 code point vi phạm line-too-long');

    // AC3.1: CLI --line và đối số sai
    const good = cli(['--line', GOOD]);
    ok(good.code === 0 && good.json?.ok === true && Array.isArray(good.json.violations) && Array.isArray(good.json.not_run),
      'AC3.1: --line hợp lệ exit 0, JSON { ok, violations, not_run }');
    const bad = cli(['--line', 'aip-report v1 from=root status=blocked']);
    ok(bad.code === 1 && bad.json?.ok === false && bad.json.violations.every((v) => v.rule && v.detail),
      'AC3.1: --line vi phạm exit 1, violations có rule và detail');
    const report = write('task-1-report.md', 'agent_result:\n  status: completed\n  summary: "x"\n');
    const dir = path.dirname(report);
    for (const [name, args] of [
      ['không đối số', []],
      ['thiếu --role', [report]],
      ['--role lạ', [report, '--role', 'foo']],
      ['file không tồn tại', [path.join(dir, 'missing.md'), '--role', 'worker']],
      ['đường dẫn là thư mục', [dir, '--role', 'worker']],
      ['--plan không kèm --task', [report, '--role', 'worker', '--plan', report]],
      ['--line kèm --role', ['--line', GOOD, '--role', 'worker']],
    ]) ok(cli(args).code === 2, `AC3.1: ${name} → exit 2`);

    // AC3.7: script chỉ đọc file và chỉ import node:* và ./task-brief.mjs
    const sha = () => createHash('sha256').update(fs.readFileSync(report)).digest('hex');
    const before = sha();
    cli([report, '--role', 'worker']);
    ok(sha() === before, 'AC3.7: file report không đổi sau khi chạy script');
    const src = fs.readFileSync(scriptPath, 'utf8');
    const imports = [...src.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    ok(imports.length > 0 && imports.every((s) => s.startsWith('node:') || s === './task-brief.mjs'),
      `AC3.7: import chỉ node:* và ./task-brief.mjs (có: ${imports.join(', ')})`);

    // AC3.2: 11 luật, mỗi luật một ca đạt + một ca vi phạm trên hàm thuần
    const ar = (body) => `agent_result:\n${body.trim().split('\n').map((l) => `  ${l}`).join('\n')}\n`;
    const parse = (body) => rc.parseAgentResult(ar(body));
    const check = (body, opts) => rc.checkAgentResult(parse(body), { role: 'worker', ...opts });
    const PLAN = [
      '# P', '', '### Task 1: a', '**Kind:** BE', '**Files:**', '- Modify: `core/x.mjs`', '- Test: `test/x.mjs`', '',
      '### Task 2: b', '**Kind:** TOOLING', '**TDD:** không — chỉ docs', '**Files:**', '- Modify: `docs/y.md`', '',
    ].join('\n');
    const TDD = 'tdd:\n  red: { command: "t", exit_code: 1, status: failed, summary: "đỏ" }\n  green: { command: "t", exit_code: 0, status: passed, summary: "xanh" }';
    const RULES = [
      ['status-valid', 'status: completed\nsummary: "x"', 'status: done\nsummary: "x"', {}],
      ['finding-location-evidence',
        'status: completed\nsummary: "x"\nfindings:\n  - { severity: minor, location: "a.mjs:1", evidence: "e" }',
        'status: completed\nsummary: "x"\nfindings:\n  - { severity: minor, location: "", evidence: "e" }', {}],
      ['completed-no-failed-validation',
        'status: completed\nsummary: "x"\nvalidation:\n  - { command: "t", exit_code: 0, status: passed }',
        'status: completed\nsummary: "x"\nvalidation:\n  - { command: "t", exit_code: 1, status: failed }', {}],
      ['changes-in-files',
        'status: completed\nsummary: "x"\nchanges: { modified: [core\\x.mjs, test/x.mjs] }\n' + TDD,
        'status: completed\nsummary: "x"\nchanges: { modified: [core/z.mjs] }\n' + TDD, { planText: PLAN, task: 1 }],
      ['tdd-required', `status: completed\nsummary: "x"\n${TDD}`, 'status: completed\nsummary: "x"', { tdd: true }],
      ['assumptions-key', 'status: completed\nsummary: "x"\nassumptions: []', 'status: completed\nsummary: "x"', { role: 'implementer' }],
      ['spec-verdict-findings', 'status: completed\nsummary: "x"\nspec_verdict: compliant\nfindings: []',
        'status: completed\nsummary: "x"\nspec_verdict: compliant', { role: 'task-review' }],
      ['assumption-review-count',
        'status: completed\nsummary: "x"\nspec_verdict: compliant\nfindings: []\nassumption_review:\n  - { assumption: a, verdict: holds, evidence: e }',
        'status: completed\nsummary: "x"\nspec_verdict: compliant\nfindings: []', { role: 'task-review', implementerAssumptions: 1 }],
      ['verdicts-count', 'status: completed\nsummary: "x"\nverdicts:\n  - { finding: f1, verdict: ADDRESSED, evidence: e }',
        'status: completed\nsummary: "x"\nverdicts: []', { role: 're-review', findings: 1 }],
      ['blocked-questions', 'status: blocked\nsummary: "x"\nquestions:\n  - "chọn A hay B? mặc định A"', 'status: blocked\nsummary: "x"\nquestions: []', {}],
      ['final-review-keys', 'status: completed\nsummary: "x"\nfindings: []\nruling_review: []',
        'status: completed\nsummary: "x"\nfindings: []', { role: 'final-review' }],
    ];
    for (const [rule, good, bad, opts] of RULES) {
      const g = check(good, opts);
      const b = check(bad, opts);
      ok(g.ok === true && !rules(g).includes(rule), `AC3.2: ${rule} — ca đạt (${JSON.stringify(g.violations)})`);
      ok(b.ok === false && rules(b).includes(rule), `AC3.2: ${rule} — ca vi phạm (${JSON.stringify(b.violations)})`);
    }
    ok(check('status: completed\nsummary: "x"').ok === true, 'AC3.2: --role worker chỉ có status + summary đạt');

    // AC1.2, AC1.3: implementer tối giản đạt; blocked không questions vi phạm
    ok(check('status: completed\nsummary: "x"\nassumptions: []', { role: 'implementer' }).ok === true,
      'AC1.2: implementer chỉ status, summary, assumptions: [] đạt');
    ok(rules(check('status: blocked\nsummary: "x"', { role: 'implementer' })).includes('blocked-questions'),
      'AC1.3: blocked không có questions → blocked-questions');

    // AC3.3: không có --plan --task → not_run, không tính là đạt luật
    const nr = check('status: completed\nsummary: "x"\nchanges: { added: [a.mjs] }');
    ok(nr.not_run.some((n) => n.rule === 'changes-in-files' && n.reason), 'AC3.3: thiếu --plan --task → not_run changes-in-files kèm lý do');

    // AC3.4: TDD suy từ plan
    ok(rules(check('status: completed\nsummary: "x"\nchanges: { modified: [core/x.mjs] }', { planText: PLAN, task: 1 })).includes('tdd-required'),
      'AC3.4: task BE không dòng TDD, report không tdd → tdd-required');
    ok(!rules(check('status: completed\nsummary: "x"\nchanges: { modified: [docs/y.md] }', { planText: PLAN, task: 2 })).includes('tdd-required'),
      'AC3.4: task **TDD:** không — <lý do> không đòi tdd');

    // AC3.5: block và flow cho cùng kết quả; khối trong ```yaml; giá trị có ": " và "# "
    const FLOW = 'status: completed\nsummary: "x"\nchanges: { added: [a.mjs], modified: [] }\nvalidation: [{ command: "t", exit_code: 1, status: failed }]\nfindings: [{ location: "", evidence: "e" }]';
    const BLOCK = 'status: completed\nsummary: "x"\nchanges:\n  added:\n    - a.mjs\n  modified: []\nvalidation:\n  - command: "t"\n    exit_code: 1\n    status: failed\nfindings:\n  - location: ""\n    evidence: "e"';
    const f = check(FLOW);
    const bl = check(BLOCK);
    ok(JSON.stringify(rules(f).sort()) === JSON.stringify(rules(bl).sort()) && rules(f).length === 2,
      `AC3.5: block và flow cùng kết quả (${rules(f)} | ${rules(bl)})`);
    const fenced = `Báo cáo:\n\n\`\`\`yaml\n${ar('status: completed\nsummary: "a: b # c"\nassumptions: []')}\`\`\`\n\nHết.`;
    ok(rc.checkAgentResult(rc.parseAgentResult(fenced), { role: 'implementer' }).ok === true,
      'AC3.5: khối trong ```yaml có văn bản trước/sau, summary chứa ": " và "# " đạt');
    for (const [name, text] of [['không có khối', 'status: completed\n'], ['khối hỏng', 'agent_result:\n  [không: phải: map\n']]) {
      const r = rc.checkAgentResult(rc.parseAgentResult(text), { role: 'worker' });
      ok(r.ok === false && r.violations.length === 1 && r.violations[0].rule === 'unparseable', `AC3.5: ${name} → chỉ một unparseable`);
    }

    // AC3.6 qua CLI: --implementer-report và --findings
    const impl3 = write('task-2-report.md', ar('status: completed\nsummary: "x"\nassumptions:\n  - { assumption: a, basis: b, if_wrong: c }\n  - { assumption: d, basis: e, if_wrong: f }\n  - { assumption: g, basis: h, if_wrong: i }'));
    const reviewN = (n) => write('task-2-review-1.md', ar(`status: completed\nsummary: "x"\nspec_verdict: compliant\nfindings: []\nassumption_review:\n${Array.from({ length: n }, (_, i) => `  - { assumption: a${i}, verdict: holds, evidence: e }`).join('\n')}`));
    ok(cli([reviewN(2), '--role', 'task-review', '--implementer-report', impl3]).json?.violations.some((v) => v.rule === 'assumption-review-count'),
      'AC3.6: task-review 2 mục assumption_review với 3 giả định → assumption-review-count');
    ok(cli([reviewN(3), '--role', 'task-review', '--implementer-report', impl3]).code === 0, 'AC3.6: đủ 3 mục → exit 0');
    const rr = (n) => write('task-2-review-2.md', ar(`status: completed\nsummary: "x"\nverdicts:\n${Array.from({ length: n }, (_, i) => `  - { finding: f${i}, verdict: ADDRESSED, evidence: e }`).join('\n')}`));
    ok(cli([rr(2), '--role', 're-review', '--findings', '3']).code === 1, 'AC3.6: re-review 2 verdicts với --findings 3 → exit 1');
    ok(cli([rr(3), '--role', 're-review', '--findings', '3']).code === 0, 'AC3.6: đủ 3 verdicts → exit 0');
    ok(cli([rr(3), '--role', 're-review', '--findings', '3', '--implementer-report', impl3]).json?.violations.some((v) => v.rule === 'assumption-review-count'),
      'AC3.6: re-review kèm --implementer-report áp assumption-review-count');

    // AC7.2: report dạng cũ (mẫu task-3-report.md của .aip/runs) đủ khoá → kiểm bình thường
    const legacy = write('task-3-report.md', [
      'agent_result:', '  status: completed', '  summary: walkSegments nối vào decide; PowerShell rơi về trackDirs cũ.',
      '  changes:', '    - test (commit 08e4a040, test đỏ): 99-path-permissions AC1.1', '    - code (commit 81984119): guard-bash.mjs walkSegments',
      '  validation:', '    - node test/validate.mjs --only path-permissions → exit 0, 762 pass',
      '  tdd:', '    red: node test/validate.mjs --only path-permissions → exit 1, 13 fail', '    green: hai lệnh trên exit 0',
      '  remaining_risks:', '    - Chưa đo chi phí lệnh nhiều $( ) (trần 200, sâu 3).',
      '  assumptions:', '    - { assumption: "Seg phụ dùng env hiện tại", basis: "D5", if_wrong: "bỏ base trong inner walk" }', '',
    ].join('\n'));
    const lg = cli([legacy, '--role', 'implementer', '--tdd']);
    ok(lg.code === 0, `AC7.2: report dạng cũ đủ khoá đạt (${JSON.stringify(lg.json)})`);
    // Dạng gặp trong report thật của .aip/runs (2026-11-11..19): không được coi là unparseable.
    const REAL = [
      ['block scalar |', 'status: completed\nsummary: "x"\ndoc_check: |\n  khẳng định -> nguồn -> kết quả\n  a -> b -> khớp'],
      ['khoá có giá trị kèm dòng thụt sâu hơn', 'status: completed\nsummary: "x"\ndoi_chieu: đối chiếu 35 khẳng định:\n  - chú thích PowerShell `#` bị bỏ\n  - out-null thêm ở Task 8'],
      ['flow có chữ theo sau', 'status: completed\nsummary: "x"\nremaining_risks: [] (fullEffective vẫn được import)'],
      ['mục list mở bằng [nhãn]', 'status: completed\nsummary: "x"\nremaining_risks:\n  - [Unverified] chưa đo trên Linux\n  - "[Inference] nhiễu tải"'],
    ];
    for (const [name, body] of REAL) ok(check(body).ok === true, `AC7.2: ${name} đạt`);
    ok(rules(check('status: completed\nsummary: "x"\nfindings: [{ location: "a:1", evidence: "e"')).includes('unparseable'),
      'AC3.5: flow hỏng ở khoá luật cần (findings) vẫn là unparseable');
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
