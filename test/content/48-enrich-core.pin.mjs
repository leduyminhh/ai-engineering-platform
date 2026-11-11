// Pin: part 01-core của request 2026-11-11-skill-enrichment-from-usage (cỡ task, vai phiên, luật git).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => {
    try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
  };
  const section = (txt, heading) => {
    const lines = txt.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start < 0) return null;
    let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    if (end < 0) end = lines.length;
    return lines.slice(start, end);
  };
  const PE = 'core/skills/plan-execution';
  const taskLoop = read(`${PE}/references/task-loop.md`);
  const taskSize = read(`${PE}/references/task-size.md`);
  const skillMd = read(`${PE}/SKILL.md`);

  // AC2.1
  const H_SIZE = '## Cỡ task và review từng task';
  const sec = section(taskLoop, H_SIZE);
  ok(sec !== null, 'AC2.1: task-loop.md có mục "Cỡ task và review từng task"');
  if (sec) {
    const lines = sec.length;
    const body = sec.join('\n');
    const linksDetail = /task-size\.md/.test(body);
    ok(lines <= 25 || linksDetail, `AC2.1: mục ≤ 25 dòng hoặc chuyển chi tiết sang task-size.md (có ${lines})`);
    const full = lines <= 25 ? body : `${body}\n${taskSize}`;
    ok(/FE-UI/.test(full) && /TOOLING/.test(full), 'AC2.1: nêu Kind cỡ Nhỏ FE-UI và TOOLING');
    ok(/\*\*TDD:\*\* không/.test(full) && /5 file/.test(full), 'AC2.1: nêu điều kiện TDD không và ≤ 5 file production');
    ok(/migration/.test(full) && /(auth|phân quyền)/.test(full) && /(secret|credential)/.test(full) && /(CI|hook)/.test(full) && /(contract API|schema)/.test(full),
      'AC2.1: nêu đường dẫn nhạy cảm và đổi contract/schema');
    ok(['BE', 'DB', 'CT', 'FE-INT', 'E2E', 'DOCS'].every((k) => full.includes(`\`${k}\``)) && /\*\*TDD:\*\* có/.test(full),
      'AC2.1: cỡ Lớn gồm BE, DB, CT, FE-INT, E2E, DOCS và TDD có luôn review');
    ok(/Gom task nhỏ/.test(full), 'AC2.1: trỏ mục "Gom task nhỏ" cho cỡ Vừa');
  }
  const iSize = taskLoop.indexOf(H_SIZE);
  const iGom = taskLoop.indexOf('## Gom task nhỏ');
  ok(iSize >= 0 && iGom > iSize, 'AC2.1: mục cỡ task đặt trước "Gom task nhỏ"');
  ok(/task-loop\.md[^\n]*Cỡ task|Cỡ task và review từng task/.test(skillMd), 'AC2.1: SKILL.md trỏ mục cỡ task');
  ok(skillMd.split('\n').length <= 300, 'AC2.1: plan-execution SKILL.md ≤ 300 dòng');

  // AC2.2
  const sizeAll = `${(section(taskLoop, H_SIZE) || []).join('\n')}\n${taskSize}`;
  ok(/git diff --name-only <BASE>\.\.HEAD/.test(sizeAll) && /\*\*Files:\*\*/.test(sizeAll), 'AC2.2: có bước đối chiếu git diff --name-only <BASE>..HEAD với **Files:**');
  ok(/nâng lên (cỡ )?Lớn/.test(sizeAll) && /đường dẫn nhạy cảm/.test(sizeAll), 'AC2.2: nhánh lệch hoặc nhạy cảm nâng lên cỡ Lớn');
  ok(/cỡ nhỏ/.test(sizeAll) && /partRunner: session/.test(sizeAll) && /subagent/.test(sizeAll) && /inline/.test(sizeAll), 'AC2.2: nêu phạm vi chế độ (session, không đổi ở inline và subagent)');
  const d9 = taskLoop.split('\n').find((l) => /^Task <n>: complete \(commits <a>\.\.<b>, review cuối — cỡ nhỏ\)$/.test(l));
  ok(!!d9, 'AC2.2: bảng Ledger có dòng D9 "review cuối — cỡ nhỏ"');
  if (d9) {
    const { spawnSync } = await import('node:child_process');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac2-2-'));
    try {
      const plan = path.join(tmp, 'plan.md');
      fs.writeFileSync(plan, '# Plan\n');
      const line = d9.replace('<n>', '1').replace('<a>', 'abc1234').replace('<b>', 'def5678');
      const r = spawnSync(process.execPath, [path.join(REPO_ROOT, PE, 'scripts/ledger.mjs'), plan, line], { encoding: 'utf8' });
      ok(r.status === 0, `AC2.2: ledger.mjs chấp nhận dòng D9 (exit ${r.status}) ${(r.stderr || '').trim()}`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }

  // AC2.3
  const rationale = (section(skillMd, '## Dấu hiệu đang tự biện minh') || []);
  const rowNho = rationale.find((l) => l.startsWith('| "Task nhỏ'));
  ok(!!rowNho && /Cỡ task và review từng task/.test(rowNho) && !/Mỗi task có review/.test(rowNho),
    'AC2.3: hàng "Task nhỏ, bỏ review cho nhanh" trỏ mục cỡ task, không còn phủ định chung');
  const nRows = rationale.filter((l) => l.startsWith('| "')).length;
  ok(nRows >= 4 && nRows <= 7, `AC2.3: bảng tự biện minh không tăng so với 7 dòng hiện có (có ${nRows})`);
  const finalReview = read(`${PE}/references/prompts/final-review.md`);
  ok(/đọc kỹ[^\n]*cỡ nhỏ/i.test(finalReview), 'AC2.3: final-review.md bảo reviewer đọc kỹ diff task ghi "cỡ nhỏ"');
  const wf = read('workflows/feature/WORKFLOW.md');
  const wfStep5 = (wf.split(/^### Bước /m).find((s) => s.startsWith('5 — ')) || '').replace(/\s+/g, ' ');
  ok(/Cỡ task và review từng task/.test(wfStep5) && /cỡ Nhỏ.{0,400}bỏ task review/.test(wfStep5),
    'AC2.3: Bước 5 workflow-feature trỏ mục cỡ task và cho task cỡ Nhỏ bỏ review từng task');

  // AC2.4
  const routing = read(`${PE}/references/model-routing.md`);
  const sessionRoles = read(`${PE}/references/session-roles.md`);
  const secRoles = section(routing, '## Vai phiên gốc và phiên con');
  ok(secRoles !== null, 'AC2.4: model-routing.md có mục "Vai phiên gốc và phiên con"');
  if (secRoles) {
    const bodyR = secRoles.join('\n');
    ok(secRoles.length <= 20 || /session-roles\.md/.test(bodyR), `AC2.4: mục ≤ 20 dòng hoặc chuyển chi tiết sang session-roles.md (có ${secRoles.length})`);
    const fullR = secRoles.length <= 20 ? bodyR : `${bodyR}\n${sessionRoles}`;
    ok(/không chồng file/.test(fullR) && /rảnh/.test(fullR), 'AC2.4: giao việc kế không chồng file cho phiên con vừa xong hoặc rảnh');
    const lo = fullR.toLowerCase();
    ok(/xoay mềm/.test(lo) && /xoay cứng|cứng/.test(lo) && /phiên mới trước/.test(lo) && /không dừng phiên con giữa plan/.test(lo),
      'AC2.4: xoay mềm ở ranh giới task, cứng ngay, mở phiên mới trước rồi dừng phiên cũ, không dừng giữa plan vì hạn mức');
    ok(/Remote Control/.test(fullR) && /cross-session/.test(fullR) && /chạy tiếp/.test(fullR), 'AC2.4: không mở được phiên (Remote Control, tin cross-session) thì để phiên cũ chạy tiếp');
    ok(/merge/.test(fullR) && /đóng/.test(fullR) && /không xoay/.test(fullR), 'AC2.4: phiên con xong và merge thì đóng, không xoay');
    ok(/~40%/.test(fullR) && /~60%/.test(fullR) && /\[Inference\]/.test(fullR), 'AC2.4: ngưỡng ~40%/~60% kèm [Inference]');
  }
  const rules = routing.split('\n').filter((l) => /^\d+\. /.test(l));
  ok(rules.length === 18, `AC2.4: 18 quy tắc đánh số của model-routing.md không đổi (có ${rules.length})`);

  // AC2.5
  const gw = read('core/skills/git-workflow/SKILL.md');
  ok(/xoá file đã tracked/.test(gw) && /một commit chỉ gồm các file bị xoá/.test(gw), 'AC2.5: git-workflow có luật xoá file đã tracked → commit chỉ-xoá');
  ok(/liệt kê/.test(gw) && /lý do/.test(gw) && /commit riêng sau/.test(gw), 'AC2.5: body liệt kê file và lý do; sửa tham chiếu là commit riêng sau đó');
  ok(/build có thể đỏ giữa hai commit/.test(gw) && /không gộp/.test(gw) && /không viết lại lịch sử/.test(gw), 'AC2.5: build đỏ giữa hai commit chấp nhận được, không gộp, không viết lại lịch sử');
  ok(gw.split('\n').length <= 300, 'AC2.5: git-workflow SKILL.md ≤ 300 dòng');

  // AC2.6
  const gt = read('core/skills/git-worktree/SKILL.md');
  ok(/isolation: worktree/.test(gt) && /origin\/<nhánh gốc>/.test(gt), 'AC2.6: git-worktree có đoạn worktree isolation: worktree dựng từ origin/<nhánh gốc>');
  ok(/git merge-base --is-ancestor <hash đỉnh feature> HEAD/.test(gt) && /blocked/.test(gt), 'AC2.6: kiểm merge-base --is-ancestor, không đạt trả blocked');
  ok(/cherry-pick/.test(gt) && /worktree-agent-\*/.test(gt) && /feature\/<slug>/.test(gt) && /reset --hard/.test(gt), 'AC2.6: session chính cherry-pick nhánh worktree-agent-* về feature/<slug>, không reset --hard');
}
