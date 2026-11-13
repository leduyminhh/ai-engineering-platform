// Pin: docs/requests/2026-11-13-frontend-ui-verify — workflow-feature có lượt kiểm giao diện thật, frontend-manual-check kiểm trạng thái/focus/mockup.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR } = ctx;
  const read = (...p) => {
    const f = path.join(...p);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '';
  };
  const flat = (s) => s.replace(/\s+/g, ' ');
  const field = (sec, name) => flat((sec.split(`- **${name}:**`)[1] || '').split(/\n- \*\*/)[0]);

  const wf = read(REPO_ROOT, 'workflows', 'feature', 'WORKFLOW.md');
  const secs = wf.split(/^### Bước /m).slice(1);
  const s5 = secs[4] || '';
  const s6 = secs[5] || '';
  const s5f = flat(s5);
  const s6f = flat(s6);

  // AC1.1: lượt chạy một lần sau mọi task, trước Bước 6, kèm điều kiện áp dụng.
  ok(s5f.includes('Kiểm giao diện thật') && /sau khi mọi task `complete`/.test(s5f) && /trước Bước 6/.test(s5f),
    'AC1.1: Bước 5 có lượt "Kiểm giao diện thật" chạy sau khi mọi task complete, trước Bước 6');
  // Phần từ tên lượt trở đi: tránh khớp nhầm chữ `not_run`, `bỏ qua` đã có sẵn ở e2e và task review.
  const ui = s5f.includes('Kiểm giao diện thật') ? s5f.slice(s5f.indexOf('Kiểm giao diện thật')) : '';
  ok(/`frontend`[^.]*`fullstack`[^.]*AC[^.]*màn hình/.test(ui) && /bỏ qua[^.]*lý do|lý do[^.]*bỏ qua/.test(ui),
    'AC1.1: lượt kiểm áp cho phạm vi frontend/fullstack có AC kiểm được trên màn hình, còn lại ghi bỏ qua kèm lý do');
  ok(field(s5, 'Thực hiện').includes('skill `frontend-manual-check`'),
    'AC1.1: trường Thực hiện của Bước 5 nêu skill `frontend-manual-check`');

  // AC1.2: đầu ra, ảnh ngoài git, not_run không chặn.
  ok(s5f.includes('docs/requests/<ngày>-<slug>/ui-check.md') && s5f.includes('.aip/runs/<request>/<part>/ui-check/'),
    'AC1.2: Bước 5 ghi ui-check.md vào thư mục request và ảnh vào .aip/runs/<request>/<part>/ui-check/');
  ok(/tổng PASS\/FAIL\/SKIP/.test(field(s5, 'Evidence')),
    'AC1.2: Evidence của Bước 5 có tổng PASS/FAIL/SKIP');
  ok(/trình duyệt[\s\S]{0,200}`not_run`[\s\S]{0,200}remaining_risks/.test(ui),
    'AC1.2: không có công cụ trình duyệt hoặc không dựng được môi trường thì `not_run` vào remaining_risks');

  // AC1.3: Bước 6 nhận ui-check.md, reviewer xếp severity, chạy lại bước FAIL một lần.
  ok(field(s6, 'Đầu vào').includes('ui-check.md') && /FAIL[^.]*severity|severity[^.]*FAIL/.test(s6f),
    'AC1.3: Bước 6 nhận ui-check.md và reviewer xếp severity cho FAIL');
  ok(/chạy lại[^.]*FAIL[^.]*một lần|một lần[^.]*chạy lại[^.]*FAIL/.test(s6f),
    'AC1.3: Bước 6 chạy lại bước FAIL đúng một lần sau lượt sửa');

  // AC1.4 (phần đọc file): graph giữ 7 bước và task-loop có skill kèm when.
  const graph = JSON.parse(read(REPO_ROOT, 'workflows', 'feature', 'graph.json') || '{"steps":[]}');
  const loop = graph.steps.find((s) => s.id === 'task-loop');
  const skillEntry = ((loop && loop.run && loop.run.skills) || []).find((x) => x && x.id === 'frontend-manual-check');
  ok(graph.steps.length === 7 && !!skillEntry && typeof skillEntry.when === 'string' && skillEntry.when.length > 0,
    'AC1.4: graph.json giữ 7 bước, bước task-loop có skill frontend-manual-check kèm when');

  // AC1.5: requires, bảng Xử lý lỗi, Definition of Done.
  const requires = (wf.match(/^requires: "([^"]*)"/m) || [, ''])[1];
  ok(requires.split(',').includes('frontend/frontend-manual-check'), 'AC1.5: frontmatter requires có frontend/frontend-manual-check');
  const errTable = (wf.split('## Xử lý lỗi & rollback')[1] || '').split('\n## ')[0];
  ok(/^\|[^|\n]*kiểm giao diện[^|\n]*\|/im.test(errTable), 'AC1.5: bảng Xử lý lỗi có hàng cho lượt kiểm giao diện');
  const dod = (wf.split('## Definition of Done')[1] || '').split('\n## ')[0];
  ok(dod.split(/\n(?=- \[ \])/).some((item) => /^- \[ \]/.test(item) && flat(item).includes('kiểm giao diện')),
    'AC1.5: Definition of Done có mục kiểm giao diện');
  const prereq = (wf.split('## Điều kiện tiên quyết')[1] || '').split('\n## ')[0];
  ok(prereq.includes('frontend-manual-check'), 'AC1.5: Điều kiện tiên quyết nêu skill frontend-manual-check');

  const mc = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-manual-check');
  const wt = read(mc, 'references', 'walkthrough.md');
  const wtf = flat(wt);

  // AC2.1: ảnh chụp bốn trạng thái, lưu ngoài git, trạng thái không dựng được → SKIP-PRECOND.
  const stateSec = flat((wt.split('## Trạng thái và ảnh chụp')[1] || '').split('\n## ')[0]);
  ok(['loading', 'rỗng', 'lỗi', 'thành công'].every((k) => stateSec.includes(k)) && stateSec.includes('.aip/runs/<request>/<part>/ui-check/') && /SKIP-PRECOND/.test(stateSec),
    'AC2.1: walkthrough có mục "Trạng thái và ảnh chụp" nêu bốn trạng thái, thư mục ảnh ngoài git, SKIP-PRECOND');
  // AC2.2: cách gây trạng thái không sửa code.
  ok(stateSec.includes('seed') && stateSec.includes('chặn hoặc giả request') && /không sửa mã nguồn/.test(stateSec),
    'AC2.2: gây trạng thái bằng seed hoặc chặn hoặc giả request, không sửa mã nguồn');
  // AC2.3: focus sau thao tác đổi nội dung tại chỗ.
  const focusSec = flat((wt.split('## Focus và thông báo')[1] || '').split('\n## ')[0]);
  ok(focusSec.includes('document.activeElement') && /\bTab\b/.test(focusSec) && /`body`/.test(focusSec) && /FAIL/.test(focusSec),
    'AC2.3: walkthrough có mục "Focus và thông báo": ghi document.activeElement, nhấn Tab, FAIL khi focus ở body');
  // AC2.4: thông báo trong DOM sau đủ chuỗi sự kiện.
  ok(focusSec.includes('role="alert"') && /tải lại/.test(focusSec) && /cùng danh sách[^.]*FAIL|FAIL[^.]*cùng danh sách/.test(focusSec),
    'AC2.4: kiểm thông báo (chữ hoặc role="alert") sau tải lại; vùng bị gỡ cùng danh sách là FAIL');
  ok(wtf.includes('| L6 |') && wtf.includes('| PASS |'), 'AC2.2: walkthrough giữ luật L6 và bảng kết quả');

  // AC2.5: mẫu runbook.
  const tpl = read(mc, 'references', 'runbook.template.md');
  ok(tpl.includes('## Đối chiếu mockup') && tpl.includes('| # | Thao tác | Kết quả mong đợi | AC |'),
    'AC2.5: runbook.template.md có ## Đối chiếu mockup và giữ bảng bước bốn cột');

  // AC2.6: chế độ nhúng và chế độ độc lập.
  const skill = read(mc, 'SKILL.md');
  const embed = flat((skill.split('## Chế độ nhúng')[1] || '').split('\n## ')[0]);
  ok(/workflow-feature/.test(embed) && /không chờ duyệt/.test(embed) && /`not_run`/.test(embed) && /không commit/.test(embed),
    'AC2.6: SKILL.md có "Chế độ nhúng": không chờ duyệt thêm, `not_run` khi thiếu điều kiện, không commit');
  ok(/độc lập/.test(embed) && /duyệt runbook/.test(embed) && /hỏi trước khi cài/.test(embed),
    'AC2.6: chế độ độc lập giữ luật duyệt runbook và hỏi trước khi cài');

  // AC3.1: fidelity-checklist.
  const fid = read(PLUGINS_DIR, 'frontend', 'skills', 'frontend-implement', 'references', 'fidelity-checklist.md').toLowerCase();
  ok(fid.includes('đã chạy thật và đối chiếu mockup') && fid.includes('dẫn chứng') && /chưa kiểm/.test(fid),
    'AC3.1: fidelity-checklist có mục "đã chạy thật và đối chiếu mockup" đòi dẫn chứng, chưa chạy thì ghi chưa kiểm');
  ok(/focus[^\n]*tại chỗ/.test(fid), 'AC3.1: dòng a11y về focus nêu trường hợp nội dung đổi tại chỗ');

  // AC4.1: review-dimensions.
  const rev = read(PLUGINS_DIR, 'frontend', 'skills', 'frontend-code-review', 'references', 'review-dimensions.md');
  ok(rev.includes('thay nội dung tại chỗ') && rev.includes('role="alert"'),
    'AC4.1: review-dimensions nêu thay nội dung tại chỗ và vùng role="alert" bị gỡ cùng danh sách');
  const focusBullet = flat(((rev.split('- **Quản lý focus:**')[1]) || '').split('\n- **')[0]);
  ok(focusBullet.includes('thay nội dung tại chỗ') && /major/.test(focusBullet),
    'AC4.1: bullet "Quản lý focus" nêu thay nội dung tại chỗ và severity gợi ý major cho luồng chính');
}
