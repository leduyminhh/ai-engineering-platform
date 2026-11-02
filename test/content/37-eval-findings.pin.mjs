// Pin: phát hiện từ lượt chạy eval + E2E 2026-11-02 — neo các quy tắc chỉ nằm trong tài liệu; đổi chữ mà giữ nghĩa thì sửa regex, đừng xoá dòng.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const PE = 'core/skills/plan-execution';
  const ANCHORS = [
    ['F1', 'workflows/feature/WORKFLOW.md', /không có công cụ chạy lệnh[^\n]*`reason: no_shell`[\s\S]*làm tiếp Bước 2–4[\s\S]*trước Bước 5[\s\S]*`blocked`/, 'baseline không có shell → not_run, làm rõ tiếp, đo trước Bước 5'],
    ['F4', `${PE}/references/prompts/task-review.md`, /Vi phạm AC, tiêu chí thành công hoặc ràng buộc đã duyệt[^\n]*\n?[^\n]*major trở lên, không bao giờ minor/, 'task-review: vi phạm AC/tiêu chí đã duyệt không phải minor'],
    ['F4', `${PE}/references/task-loop.md`, /vi phạm AC hay tiêu chí đã duyệt cũng là `major` trở lên/, 'task-loop bước 8: nâng minor vi phạm AC lên major trước khi hoãn'],
    ['F5', `${PE}/references/prompts/final-review.md`, /một dispatch, `model: sonnet`/, 'lần sửa sau review cuối dùng sonnet'],
    ['F5', `${PE}/SKILL.md`, /reviewer của review cuối toàn nhánh dùng `opus`; lần sửa sau review cuối dùng `sonnet`/, 'SKILL.md: opus cho reviewer, sonnet cho lần sửa'],
    ['F6', 'core/skills/brainstorming/SKILL.md', /^- \*\*Đi xem\.\*\*[^\n]*\n?[^\n]*code nhỏ trong repo[\s\S]*?không hỏi người dùng/m, 'brainstorming tự đọc code nhỏ trong repo, không hỏi điều code trả lời được'],
    ['F8', `${PE}/references/task-loop.md`, /không prefix `cd … &&`/, 'task-loop: gọi script không prefix cd'],
    ['F8', 'README.md', /Bash\(node \*scripts\/\*\.mjs \*\)[\s\S]*no `cd … &&` prefix/, 'README: mẫu allowedTools cho script skill'],
    ['F8', 'README_VI.md', /Bash\(node \*scripts\/\*\.mjs \*\)[\s\S]*không prefix `cd … &&`/, 'README_VI: mẫu allowedTools cho script skill'],
    ['F9', 'README.md', /outside both the session cwd and the git root/, 'README: gate-stop bỏ qua file ngoài cwd và gốc git'],
  ];
  for (const [id, file, re, msg] of ANCHORS) ok(re.test(read(file)), `${id}: ${msg}`);

  // F2: grader finding-label nhận nhãn tiếng Anh lẫn tiếng Việt (skill review xuất nhãn theo quy tắc ngôn ngữ).
  const label = (side, ext) => {
    const m = read(`evals/${side}/code-review-readonly/graders/finding-label.md`).match(/pattern: '(.*)'/);
    return m ? new RegExp(m[1]) : null;
  };
  for (const [side, file] of [['frontend', 'a.tsx'], ['backend', 'A.java']]) {
    const re = label(side);
    ok(!!re && ['proven', 'Suspected', 'đã chứng minh', 'Nghi ngờ'].every((l) => re.test(`| 1 | major | src/${file}:12 | x | ${l} | r | f |`)) && !re.test(`| 1 | major | src/${file}:12 | x | khác | r | f |`),
      `F2: ${side} finding-label nhận Proven/Suspected và đã chứng minh/nghi ngờ`);
  }

  // F3: grader clarify-or-propose theo thiết kế gom câu hỏi (không đòi đúng một câu).
  const g = read('evals/workflows/clarify-proposals/graders/clarify-or-propose.md');
  ok(/một tin nhắn hoặc thẻ gom tối đa 4 câu/.test(g) && !/hỏi đúng MỘT câu/.test(g), 'F3: clarify-or-propose chấp nhận thẻ gom tối đa 4 câu, không đòi đúng một câu');
}
