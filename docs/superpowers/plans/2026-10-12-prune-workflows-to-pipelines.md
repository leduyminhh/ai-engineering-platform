# Rút bộ workflow về 5 pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giữ lại đúng 5 workflow là pipeline (`feature`, `bugfix`, `security-review`, `performance`, `release`) và giữ orchestrator. Gỡ 7 workflow chỉ xoay quanh một năng lực. Gate riêng của các workflow bị gỡ được chuyển vào skill nhận lại, để không mất hành vi. Orchestrator route việc một năng lực sang skill tương ứng.

**Architecture:** Làm theo 4 lượt, mỗi lượt có ID còn hợp lệ ở cuối lượt.
1. Sửa CLI để `aip update` chịu được skill đã ghi trong manifest nhưng không còn trong nguồn.
2. Đưa gate vào các skill của data/ops/engineering, rồi backend/frontend, đồng thời đổi mọi tuyến "→ workflow-X" sang ID còn tồn tại.
3. Xoá 7 thư mục workflow, gom phần api vào `workflow-feature`. Rút Registry của orchestrator về 5 dòng và mở rộng mục "Yêu cầu chạy trực tiếp bằng skill". Giữ nguyên code registry (`parseRegistry`, `registrySignals`).
4. Cập nhật tài liệu hiện hành; thêm ghi chú đầu file cho ADR, plan và spec cũ.

**Tech Stack:** Node.js 20+ ESM, không dependency; Markdown tiếng Việt; validator `test/validate.mjs`; `node test/install.test.mjs`.

**Spec:** Quyết định của người dùng trong phiên 2026-10-12 (không có file spec riêng): "Workflow là một pipeline xử lý công việc nào đó". Việc chỉ xoay quanh một năng lực là skill. Bảng quyết định nằm ở mục **Quyết định** bên dưới; plan này là nguồn duy nhất.

## Quyết định

| Workflow | Kết luận | Gate cần giữ → nơi nhận |
|---|---|---|
| `workflow-feature`, `workflow-bugfix`, `workflow-security-review`, `workflow-performance`, `workflow-release` | Giữ | — |
| `workflow-api` | Gộp vào `workflow-feature` | Kiểm drift contract↔code, kiểm authorization/input validation → `feature` Bước 6 |
| `workflow-db-change` | Gỡ | Bàn giao code/test/review → `data-db-migration` C5; kiểm SQL bù → `verify-cycle.md` |
| `workflow-incident` | Gỡ | Cập nhật stakeholder, xác minh phục hồi, thang severity → `ops-incident-troubleshooting` |
| `workflow-testing` | Gỡ | Phân loại failure (lỗi test / lỗi code → bugfix) → `backend-testing`, `frontend-testing` bước 4 |
| `workflow-code-review` | Gỡ | Chia vùng diff fullstack, nhóm CI/IaC/SQL → quality gate, validate finding → `*-code-review` |
| `workflow-refactor` | Gỡ | `*-migrate-architecture` đã có ADR + characterization test; chỉ đổi tuyến description |
| `workflow-docs` | Gỡ | Không có |
| `workflow-orchestrator` | Giữ (người dùng chốt 2026-10-12) | Registry còn 5 dòng, cột Nối tiếp đều `—`; mục "Yêu cầu chạy trực tiếp bằng skill" nhận tín hiệu của 7 workflow đã gỡ; tín hiệu sự cố production xét trước Registry |

## Global Constraints

- File nguồn UTF-8 **không BOM**, xuống dòng LF. Nội dung skill/workflow viết tiếng Việt có dấu.
- Description của skill: một câu hành động (≤ 200 ký tự), sau đó `Dùng khi người dùng muốn "…"` (3–5 trigger), sau đó `Không dùng khi <case> → <id>`. Tối đa 500 ký tự; `<id>` phải là skill/workflow/agent có thật; không lặp trigger nguyên văn của skill khác (`cli/lib/conventions.mjs`).
- Description của agent ≤ 260 ký tự và kết thúc bằng `Dùng khi …`.
- Khi đổi tuyến `→ id` của description, sửa snapshot `test/fixtures/not-for-ids.json` (skill) hoặc `test/fixtures/workflow-not-for-ids.json` (workflow) **trong cùng task**.
- Đổi nội dung được chiếu ra → nâng version trong `.manifest.json` của plugin sở hữu, chạy `npm run build`, rồi chạy `node cli/lib/versions.mjs --lock`. Mỗi plugin chỉ nâng **một lần trong cả plan**; mỗi plugin chỉ được sửa trong đúng một task.
- Mọi commit đi qua skill `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu, dùng `git commit -F`. **Không** thêm `Co-Authored-By`. Không push.
- Làm trên branch `refactor/prune-workflows` tạo từ `master`; không commit lên `master`.
- Không đụng `pack-guard.mjs`, `pack.config.json`, `package.json`.
- ADR, plan và spec cũ (`docs/decisions/`, `docs/superpowers/plans/`, `docs/superpowers/specs/`): chỉ **thêm ghi chú đầu file**, không sửa thân (người dùng chốt 2026-10-12, giữ làm hồ sơ lịch sử). Không sửa mục đã phát hành của `CHANGELOG.md` và `.superpowers/sdd/` (ghi chép làm việc, không phải plan).
- Windows: dọn thư mục tạm chứa junction bằng `fs.rmSync` của Node, không dùng `rm -rf` của Git Bash.

## Review Focus

1. Người dùng đã cài lẻ `--skill workflows/workflow-db-change` rồi chạy `aip update` → mong đợi: update không ném lỗi, bỏ skill đó kèm cảnh báo, cài lại phần còn lại (Task 1).
2. Thân skill/workflow còn nhắc ID đã gỡ (không phải description, nên convention không bắt được) → mong đợi: 0 tham chiếu trong `plugins/`, `core/`, `workflows/` (Task 4, guard trong `15-workflow-pruning.pin.mjs`).
3. Gate của workflow bị gỡ biến mất khi viết lại skill → mong đợi: mỗi gate trong bảng Quyết định còn chuỗi neo trong skill nhận (Task 2–3, pin `15-…`).
4. Claude plugin-mode giữ cache bản cũ vì version không đổi → mong đợi: `workflows` lên `2.0.0` và lock khớp (Task 4, `60-versions.contract`).
5. Yêu cầu "prod down, có stacktrace" khớp cả bugfix lẫn mục skill sự cố → mong đợi: orchestrator route sang `ops-incident-troubleshooting` vì tín hiệu sự cố xét trước Registry, đúng ưu tiên cũ của `workflow-incident` (Task 4, pin `15-…`).
6. `feature` nhận trigger `"thêm endpoint"` trùng trigger của skill khác hoặc vượt 500 ký tự → mong đợi: `40-conventions` và `50-workflows` xanh (Task 4).

---

### Task 1: `aip update`/`install` bỏ qua skill đã gỡ khỏi nguồn

**Files:**
- Modify: `cli/lib/install.mjs` (cạnh `catalogIds()` ~dòng 370; nhánh skills-mode trong `install()` ~dòng 754–756; vòng lặp của `update()` ~dòng 970)
- Test: `test/install.test.mjs` (khối mới ngay sau khối `// ── update: khối nhận skill MỚI; skill-lẻ KHÔNG kéo anh em; check trả skills ──`)

**Interfaces:**
- Produces: hàm nội bộ `dropRetiredSkills(skills: string[]): string[]`. Hàm trả các ID còn trong `skillCatalog()` và `console.warn` một dòng liệt kê ID bị bỏ. Hàm không export.

- [ ] **Step 1: Tạo branch**

```bash
git switch -c refactor/prune-workflows master
```

- [ ] **Step 2: Viết test hồi quy (đỏ)**

Chèn vào `test/install.test.mjs`, ngay sau khối update skill-lẻ (khối kết thúc bằng `process.env.AIE_INSTALL_ROOT = TMP;` sau assert `'update skill-lẻ: skill đã chọn vẫn còn (refresh)'`):

```js
// ── update: skill lẻ đã gỡ khỏi nguồn (vd workflow bị bỏ) không làm update ném lỗi ──
{
  const TMP_RT = mkTmp('cwf-upd-retired-');
  process.env.AIE_INSTALL_ROOT = TMP_RT;
  install({ providers: 'claude', skills: ['backend/backend-init'], scope: 'project' });
  const mf = path.join(TMP_RT, '.ai-engineering', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.installs.find((e) => e.provider === 'claude').skills.push('workflows/workflow-retired');
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  let threw = null;
  try { update({ scope: 'project', pull: false }); } catch (err) { threw = err; }
  ok(threw === null, `update: skill đã gỡ khỏi nguồn không làm update ném lỗi (${threw?.message})`);
  const after = JSON.parse(fs.readFileSync(mf, 'utf8')).installs.find((e) => e.provider === 'claude');
  ok(after && !after.skills.includes('workflows/workflow-retired'), 'update: manifest bỏ skill đã gỡ khỏi nguồn');
  ok(fs.existsSync(path.join(TMP_RT, '.claude/skills/backend-init/SKILL.md')), 'update: skill còn trong nguồn vẫn được cài lại');
  process.env.AIE_INSTALL_ROOT = TMP;
}
```

- [ ] **Step 3: Chạy, xác nhận đỏ**

Run: `node test/install.test.mjs`
Expected: FAIL, có dòng `update: skill đã gỡ khỏi nguồn không làm update ném lỗi (Skill không tồn tại: workflows/workflow-retired)`. Nếu báo thiếu `SKILL.md` thì chạy `npm run build` trước.

- [ ] **Step 4: Hiện thực**

Trong `cli/lib/install.mjs`, ngay dưới `function catalogIds() { … }`:

```js
/** Manifest có thể còn ghi skill mà nguồn đã gỡ (vd workflow bị bỏ); cài lại với ID đó sẽ ném lỗi nên bỏ qua kèm cảnh báo. */
function dropRetiredSkills(skills) {
  const ids = catalogIds();
  const gone = skills.filter((s) => !ids.has(s));
  if (gone.length) console.warn(`[aip] Bỏ skill không còn trong nguồn: ${gone.join(', ')}`);
  return skills.filter((s) => ids.has(s));
}
```

Trong `install()`, nhánh skills-mode, thay:

```js
    const effSkills = prev ? [...new Set([...(prev.skills || []), ...sel.skills])] : sel.skills;
```

bằng:

```js
    const effSkills = prev ? [...new Set([...dropRetiredSkills(prev.skills || []), ...sel.skills])] : sel.skills;
```

Trong `update()`, nhánh `else` (skills-mode), thay:

```js
      install({ providers: [e.provider], plugins: e.plugins || [], skills: e.skills || [], scope, mode: 'skills' });
```

bằng:

```js
      install({ providers: [e.provider], plugins: e.plugins || [], skills: dropRetiredSkills(e.skills || []), scope, mode: 'skills' });
```

- [ ] **Step 5: Chạy, xác nhận xanh**

Run: `node test/install.test.mjs`
Expected: PASS, không còn fail (một dòng cảnh báo `[aip] Bỏ skill không còn trong nguồn: workflows/workflow-retired` là bình thường).

- [ ] **Step 6: Commit qua `core:git-workflow`**

Header: `fix(cli): skip retired skills recorded in the install manifest`. Body tiếng Việt nêu: lỗi `Skill không tồn tại` khi update; cách lọc; test hồi quy. Không có thay đổi nội dung chiếu nên không nâng version.

---

### Task 2: Chuyển gate của db-change/incident vào skill data, ops, engineering

**Files:**
- Modify: `plugins/data/skills/data-db-migration/SKILL.md` (description; mục `#### C5. Bàn giao`)
- Modify: `plugins/data/skills/data-db-migration/references/change/verify-cycle.md` (cuối mục `## Flyway`)
- Modify: `plugins/data/skills/data-oltp-implement/SKILL.md` (description)
- Modify: `plugins/data/agents/data-migration-writer.md` (description)
- Modify: `plugins/ops/skills/ops-incident-troubleshooting/SKILL.md` (description; bước 0, 4, 5; mục Verification; Bản đồ tài liệu)
- Create: `plugins/ops/skills/ops-incident-troubleshooting/references/severity-scale.md`
- Modify: `plugins/ops/skills/ops-observability/SKILL.md` (description)
- Modify: `plugins/engineering/skills/engineering-task-breakdown/SKILL.md:31`, `…/references/breakdown-checklist.md:27`, `…/references/task-template-common.md:8,83`
- Modify: `test/fixtures/not-for-ids.json`
- Create: `test/content/15-workflow-pruning.pin.mjs`
- Modify: `plugins/data/.manifest.json` (1.5.2 → 1.6.0), `plugins/ops/.manifest.json` (1.4.1 → 1.5.0), `plugins/engineering/.manifest.json` (1.6.0 → 1.6.1), `plugins/_versions.lock.json` (sinh tự động)

**Interfaces:**
- Produces: file `test/content/15-workflow-pruning.pin.mjs` có mảng `ABSORBED` gồm các bộ `[relPathDướiPLUGINS_DIR, chuỗiNeo, thôngĐiệp]`. Task 3 thêm dòng vào mảng này; Task 4 thêm khối guard.

- [ ] **Step 1: Viết pin (đỏ)**

Tạo `test/content/15-workflow-pruning.pin.mjs`:

```js
// Pin nội dung: gate của workflow đã gỡ (plan 2026-10-12-prune-workflows-to-pipelines) phải còn ở skill nhận lại.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR } = ctx;
  const flat = (s) => s.replace(/\s+/g, ' ');
  const read = (rel) => { const p = path.join(PLUGINS_DIR, rel); return fs.existsSync(p) ? flat(fs.readFileSync(p, 'utf8')) : ''; };

  const ABSORBED = [
    ['data/skills/data-db-migration/SKILL.md', '`backend-code-review`', 'data-db-migration C5: review query/index chuyển sang backend-code-review'],
    ['data/skills/data-db-migration/references/change/verify-cycle.md', 'Kiểm SQL bù', 'verify-cycle: kiểm SQL bù trên DB test'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'Cập nhật stakeholder', 'ops-incident-troubleshooting: có bước cập nhật stakeholder'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'Xác minh phục hồi', 'ops-incident-troubleshooting: có bước xác minh phục hồi'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'references/severity-scale.md', 'ops-incident-troubleshooting: trỏ thang severity mặc định'],
  ];
  for (const [rel, needle, msg] of ABSORBED) ok(read(rel).includes(needle), msg);
}
```

Run: `node test/validate.mjs --only 15-workflow-pruning`
Expected: FAIL ở các assert chưa có neo (ít nhất 4 assert của verify-cycle và ops). Assert `backend-code-review` có thể xanh sẵn nếu thân skill đã nhắc tên đó; Step 2 vẫn phải thêm đoạn bàn giao.

- [ ] **Step 2: `data-db-migration`**

Description: thay đoạn `; cần quy trình đổi schema có review query và commit → workflow-db-change.` bằng `; làm cả tính năng dùng schema mới → workflow-feature.`

Mục `#### C5. Bàn giao`: thêm đoạn sau vào cuối mục, ngay trước `## Report trả về`:

```markdown
Phần còn lại của thay đổi đi qua skill chuyên trách, theo thứ tự: code dùng cột/bảng mới → `backend-implement`;
integration test cho repository/query bị đụng → `backend-testing`; review query mới và index (thiếu index, index thừa,
N+1) cùng SQL bù → `backend-code-review`; commit qua `core:git-workflow` sau khi người dùng duyệt diff.
```

- [ ] **Step 3: `verify-cycle.md`**

Thêm vào cuối mục `## Flyway`, ngay trước `## Liquibase`:

```markdown
**Kiểm SQL bù.** Kế hoạch C2 có migration bù cho thay đổi phá huỷ → sau (a)(b)(c), áp đúng nguyên văn SQL bù trong
runbook lên DB test đã xác nhận (không viết lại, không sửa tay), rồi kiểm schema/dữ liệu sau lượt áp. Chưa có SQL bù
cho thay đổi phá huỷ → quay lại C2 bổ sung kế hoạch, không tự viết SQL bù lúc verify.
```

- [ ] **Step 4: `data-oltp-implement` + agent `data-migration-writer`**

`data-oltp-implement` description: xoá đoạn `; cần quy trình đổi schema có review query và commit → workflow-db-change` (giữ dấu `.` kết câu).

`data-migration-writer` description: thay `Dùng khi workflow db-change cần giao file migration.` bằng `Dùng khi cần giao file migration theo kế hoạch C2.`

- [ ] **Step 5: `ops-incident-troubleshooting`**

1. Description: xoá đoạn `cần quy trình sự cố đầy đủ (mitigation, xác minh phục hồi, commit RCA) → workflow-incident; ` để còn `Không dùng khi lỗi tái hiện được ở local → workflow-bugfix.`
2. Tạo `references/severity-scale.md` (chép từ `workflows/incident/references/severity-scale.md` và sửa 2 dòng đầu; file gốc vẫn giữ tới Task 4):

```markdown
# Thang severity mặc định — ops-incident-troubleshooting

Chỉ dùng ở bước 0 khi project chưa có thang severity riêng; người dùng có thể đổi thang này.

- SEV1: mất dịch vụ chính hoặc mất dữ liệu, ảnh hưởng đa số người dùng.
- SEV2: suy giảm nghiêm trọng hoặc ảnh hưởng một phần người dùng.
- SEV3: ảnh hưởng nhỏ hoặc có cách lách.
- SEV4: chưa ảnh hưởng người dùng.
```

3. Bước 0: thêm câu cuối đoạn: `Project chưa có thang severity → dùng thang mặc định ở [references/severity-scale.md](references/severity-scale.md).`
4. Bước 4: thêm câu trước câu `**KHÔNG tự thực thi trên prod**`: `Kèm **cửa sổ theo dõi phục hồi** và **ngưỡng metric bình thường** (rút từ bước 0–2) để người dùng chốt cùng phương án.`
5. Đổi số bước `5. **RCA + hành động khắc phục.**` thành `7.`, rồi chèn trước nó:

```markdown
5. **Cập nhật stakeholder (chỉ SOẠN — người dùng tự gửi).**
   Soạn bản cập nhật: severity, blast radius, trạng thái (đang điều tra / đã có mitigation / đang theo dõi),
   mitigation đang áp, mốc cập nhật kế tiếp. Không đưa secret, dữ liệu cá nhân khách hàng hay suy đoán chưa có
   bằng chứng; không tự gửi tin nhắn/thông báo thay người dùng.

6. **Xác minh phục hồi.**
   Sau khi người dùng báo đã áp mitigation, đọc lại metric/health trong cửa sổ theo dõi đã chốt ở bước 4, so với
   ngưỡng bình thường trước sự cố. Mới cải thiện một phần, hoặc hết cửa sổ mà chưa ổn định → chưa kết luận phục
   hồi, quay lại bước 4.
```

6. Cuối nội dung bước 7 (RCA), thêm: `Ghi RCA vào \`docs/\` của project; commit qua \`core:git-workflow\` sau khi người dùng duyệt diff.`
7. `## Verification`: thêm bullet cuối: `- Kết luận phục hồi dựa trên metric/health trong cửa sổ đã chốt; bản cập nhật stakeholder chỉ soạn, người dùng tự gửi.`
8. `## Bản đồ tài liệu`: thêm bullet cuối:

```markdown
- [references/severity-scale.md](references/severity-scale.md): **thang SEV1–SEV4 mặc định** khi project chưa có
  thang riêng.
```

- [ ] **Step 6: `ops-observability`**

Description: xoá đoạn `; cần quy trình xử lý sự cố đầy đủ → workflow-incident` (giữ `.` kết câu).

- [ ] **Step 7: `engineering-task-breakdown`**

- `SKILL.md:31`: `gợi ý \`workflow-db-change\`` → `gợi ý skill \`data-db-migration\``.
- `references/breakdown-checklist.md:27`: `gợi ý \`workflow-db-change\`` → `gợi ý skill \`data-db-migration\``.
- `references/task-template-common.md:8`: `` `data-db-migration` (luồng `workflow-db-change`) `` → `` `data-db-migration` ``.
- `references/task-template-common.md:83`: thay cả dòng bằng `- **Luồng:** chạy skill \`data-db-migration\` (chế độ \`change\`) trước task BE/FE dùng schema mới.`

- [ ] **Step 8: Snapshot `not-for-ids.json`**

Đặt đúng các key sau (giữ nguyên các key khác):

```json
"data-oltp-implement": ["data-db-migration"],
"data-db-migration": ["data-oltp-implement", "workflow-feature"],
"ops-incident-troubleshooting": ["workflow-bugfix"],
"ops-observability": ["ops-incident-troubleshooting"],
```

- [ ] **Step 9: Nâng version, build, lock, kiểm**

Sửa `version`: data `1.6.0`, ops `1.5.0`, engineering `1.6.1`.

```bash
npm run build
```

```bash
node cli/lib/versions.mjs --lock
```

```bash
node test/validate.mjs --build
```

Expected: 0 fail; pin `15-workflow-pruning` xanh 5/5.

- [ ] **Step 10: Commit qua `core:git-workflow`**

Header: `refactor(data,ops,engineering): absorb db-change and incident workflow gates into skills`. Body tiếng Việt liệt kê gate đã chuyển và version mới.

---

### Task 3: Chuyển gate của testing/code-review/refactor/api vào skill backend, frontend

**Files:**
- Modify: `plugins/backend/skills/backend-testing/SKILL.md`, `plugins/frontend/skills/frontend-testing/SKILL.md` (description; mục `### 4. Chạy + đo độ phủ…`)
- Modify: `plugins/backend/skills/backend-code-review/SKILL.md`, `plugins/frontend/skills/frontend-code-review/SKILL.md` (description; mục `### 0.`; mục `### 2.`)
- Modify: description của `backend-refactor`, `backend-migrate-architecture`, `frontend-refactor`, `frontend-migrate-architecture`, `backend-api-contract`
- Modify: `plugins/frontend/skills/frontend-data-integration/SKILL.md:71,74`
- Modify: `test/fixtures/not-for-ids.json`, `test/content/15-workflow-pruning.pin.mjs`
- Modify: `plugins/backend/.manifest.json` (1.7.5 → 1.8.0), `plugins/frontend/.manifest.json` (1.9.3 → 1.10.0), `plugins/_versions.lock.json`

**Interfaces:**
- Consumes: mảng `ABSORBED` trong `test/content/15-workflow-pruning.pin.mjs` (Task 2).

- [ ] **Step 1: Thêm pin (đỏ)**

Thêm vào cuối mảng `ABSORBED`:

```js
    ['backend/skills/backend-testing/SKILL.md', 'Phân loại mọi failure', 'backend-testing: phân loại failure, lỗi code → workflow-bugfix'],
    ['frontend/skills/frontend-testing/SKILL.md', 'Phân loại mọi failure', 'frontend-testing: phân loại failure, lỗi code → workflow-bugfix'],
    ['backend/skills/backend-code-review/SKILL.md', 'PR fullstack', 'backend-code-review: chia vùng diff fullstack'],
    ['frontend/skills/frontend-code-review/SKILL.md', 'PR fullstack', 'frontend-code-review: chia vùng diff fullstack'],
    ['backend/skills/backend-code-review/SKILL.md', 'Validate trước khi báo', 'backend-code-review: validate finding trước khi báo'],
    ['frontend/skills/frontend-code-review/SKILL.md', 'Validate trước khi báo', 'frontend-code-review: validate finding trước khi báo'],
```

Run: `node test/validate.mjs --only 15-workflow-pruning`
Expected: FAIL 6 assert mới.

- [ ] **Step 2: Hai skill testing**

Description của cả hai: thay `; cần quy trình viết test có phân loại failure và commit → workflow-testing.` bằng `; failure là lỗi code cần sửa → workflow-bugfix.`

Trong `### 4. Chạy + đo độ phủ, đánh giá chất lượng test — CỔNG` của cả hai, thêm bullet cuối mục:

```markdown
- **Phân loại mọi failure:** lỗi test (test viết sai → sửa test) hay lỗi code (code có bug). Lỗi code → KHÔNG sửa
  code production để test qua; giữ test đỏ, báo lại và đề xuất `workflow-bugfix`.
```

- [ ] **Step 3: Hai skill code-review**

Description `backend-code-review`: thay `; review cả PR đa vai trò BE + FE → workflow-code-review.` bằng `; review phần frontend của PR → frontend-code-review.`
Description `frontend-code-review`: thay `; review cả PR đa vai trò BE + FE → workflow-code-review.` bằng `; review phần backend của PR → backend-code-review.`

Trong `### 0. Nạp context + chốt scope` của cả hai, thêm bullet cuối mục (skill frontend đổi "phần frontend → `frontend-code-review`" thành "phần backend → `backend-code-review`"):

```markdown
- **PR fullstack:** chia file của diff thành backend / frontend / khác. Phần frontend → `frontend-code-review`;
  file CI/IaC/SQL (pipeline CI, Dockerfile/IaC, migration SQL) → `engineering-quality-gate`; docs/config thuần ghi
  "không cần reviewer". Không bỏ sót file nào của diff.
```

Trong mục `### 2.` của cả hai (Phân loại severity + evidence), thêm bullet cuối mục:

```markdown
- **Validate trước khi báo:** đọc lại `file:line` của từng finding trong diff thật; loại finding không tái lập được
  hoặc sai vị trí, ghi số finding bị loại kèm lý do. Không hạ severity để giảm số `blocker`.
```

- [ ] **Step 4: Refactor + api-contract + data-integration**

- `backend-refactor`: xoá `; cần quy trình nhiều bước có commit theo lô → workflow-refactor`.
- `backend-migrate-architecture`: xoá `; cần quy trình có ADR, characterization test và commit theo lô → workflow-refactor`.
- `frontend-refactor`: xoá `; cần quy trình refactor nhiều bước có commit theo lô → workflow-refactor`.
- `frontend-migrate-architecture`: xoá `; cần quy trình có ADR và commit theo lô → workflow-refactor`.
- `backend-api-contract`: `→ workflow-api;` → `→ workflow-feature;`.
- `frontend-data-integration` dòng 71: `` (report của `backend-api-contract` hoặc `workflow-api`) `` → `` (report của `backend-api-contract` hoặc bước Review của `workflow-feature`) ``; dòng 74: `` đề xuất `workflow-api` / `backend-api-contract`. `` → `` đề xuất `backend-api-contract`. ``

Mỗi description vẫn kết thúc bằng dấu `.`.

- [ ] **Step 5: Snapshot `not-for-ids.json`**

```json
"backend-testing": ["frontend-e2e-testing", "workflow-bugfix"],
"backend-code-review": ["engineering-quality-gate", "frontend-code-review"],
"backend-refactor": ["backend-migrate-architecture"],
"backend-migrate-architecture": ["backend-refactor"],
"backend-api-contract": ["backend-implement", "workflow-feature"],
"frontend-testing": ["frontend-e2e-testing", "workflow-bugfix"],
"frontend-code-review": ["engineering-quality-gate", "backend-code-review"],
"frontend-refactor": ["frontend-migrate-architecture"],
"frontend-migrate-architecture": ["frontend-refactor"],
```

- [ ] **Step 6: Nâng version, build, lock, kiểm**

backend `1.8.0`, frontend `1.10.0`.

```bash
npm run build
```

```bash
node cli/lib/versions.mjs --lock
```

```bash
node test/validate.mjs --build
```

Expected: 0 fail; pin `15-workflow-pruning` xanh 11/11.

- [ ] **Step 7: Commit qua `core:git-workflow`**

Header: `refactor(backend,frontend): absorb testing and code-review workflow gates into skills`.

---

### Task 4: Gỡ 7 workflow, gộp api vào feature, rút Registry của orchestrator

**Files:**
- Delete: `workflows/{api,code-review,db-change,docs,incident,refactor,testing}/` (cả `references/`)
- Modify: `workflows/orchestrator/WORKFLOW.md` (mục `## Registry`, `**Thứ tự ưu tiên:**`, `## Yêu cầu chạy trực tiếp bằng skill`, Bước 1)
- Modify: `workflows/feature/WORKFLOW.md`, `workflows/feature/references/task-breakdown.md:17`
- Modify: `workflows/bugfix/WORKFLOW.md` (description), `workflows/release/WORKFLOW.md:130,142,181,182`
- Modify: `workflows/.manifest.json`
- Modify: `test/contract/50-workflows.contract.mjs`
- Modify: `test/content/02-p0-fixes.pin.mjs`, `06-workflow-fixes.pin.mjs`, `08-publish.pin.mjs`, `11-db-change.pin.mjs`, `15-workflow-pruning.pin.mjs`
- Modify: `test/fixtures/workflow-not-for-ids.json`, `test/install.test.mjs:169`
- Modify: `plugins/_versions.lock.json`

**Interfaces:**
- Consumes: mảng `ABSORBED` trong `15-workflow-pruning.pin.mjs` (Task 2–3).
- Không đổi code trong `cli/`: `parseRegistry`, `registrySignals`, `checkWorkflowBody(text, { kind })` giữ nguyên.

- [ ] **Step 1: Thêm pin guard + routing (đỏ)**

Trong `15-workflow-pruning.pin.mjs`, đổi dòng destructure thành `const { fs, path, PLUGINS_DIR, CORE_DIR, REPO_ROOT, listFilesRec, workflows } = ctx;`, rồi thêm vào cuối hàm:

```js
  const RETIRED = ['api', 'code-review', 'db-change', 'docs', 'incident', 'refactor', 'testing'].map((s) => `workflow-${s}`);
  const hits = [];
  for (const dir of [PLUGINS_DIR, CORE_DIR, workflows?.dir].filter(Boolean)) {
    for (const rel of listFilesRec(dir).filter((f) => /\.(md|json)$/.test(f))) {
      const text = fs.readFileSync(path.join(dir, rel), 'utf8');
      for (const id of RETIRED) if (text.includes(id)) hits.push(`${path.relative(REPO_ROOT, path.join(dir, rel))}: ${id}`);
    }
  }
  ok(hits.length === 0, `không còn tham chiếu workflow đã gỡ${hits.length ? ' — ' + hits.join('; ') : ''}`);

  // Orchestrator nhận tín hiệu của workflow đã gỡ và route sang skill; sự cố production giữ ưu tiên cao nhất cũ.
  const orch = flat(workflows?.stages.find((s) => s.kind === 'orchestrator')?.body ?? '');
  const direct = orch.split('## Yêu cầu chạy trực tiếp bằng skill')[1]?.split('## Các bước')[0] ?? '';
  for (const id of ['ops-incident-troubleshooting', 'backend-code-review', 'frontend-code-review', 'backend-refactor',
    'backend-testing', 'frontend-testing', 'data-db-migration', 'backend-api-contract']) {
    ok(direct.includes(`\`${id}\``), `orchestrator: mục skill trực tiếp route tới ${id}`);
  }
  ok(orch.includes('xét TRƯỚC Registry'), 'orchestrator Bước 1: tín hiệu sự cố production xét trước Registry');
```

Run: `node test/validate.mjs --only 15-workflow-pruning`
Expected: FAIL. Guard liệt kê `workflows/feature/WORKFLOW.md: workflow-db-change`, `workflows/release/WORKFLOW.md: workflow-incident`, `workflows/orchestrator/WORKFLOW.md: …` cùng 7 thư mục sắp xoá; 9 assert routing đỏ.

- [ ] **Step 2: Gộp api vào `workflow-feature`**

1. Description: thay `\"thêm tính năng\", ` bằng `\"thêm tính năng\", \"thêm endpoint\", ` (5 trigger; khoảng 390 ký tự).
2. Bước 2, Hành động: thay `dừng, đề xuất chạy \`workflow-db-change\` trước rồi quay lại feature (chuỗi \`db-change → feature\`)` bằng `dừng, đề xuất chạy skill \`data-db-migration\` (chế độ \`change\`, plugin \`data\`) trước rồi quay lại feature`. Gói lại dòng ≤ 115 ký tự.
3. Bước 2, Gate: `hoặc đã có xác nhận chạy \`workflow-db-change\` trước` → `hoặc migration đã viết và verify qua \`data-db-migration\``.
4. Bước 2, Khi fail: `đề xuất \`workflow-db-change\`` → `đề xuất skill \`data-db-migration\``.
5. Bảng lỗi: dòng `| Phạm vi có đổi schema DB (Bước 2) | … |` → `| Phạm vi có đổi schema DB (Bước 2) | Dừng, đề xuất chạy skill \`data-db-migration\` trước rồi quay lại feature |`.
6. Bước 6 — Review:
   - Hành động, nối thêm: `Phạm vi có API (Bước 3 có contract): \`backend-reviewer\` đối chiếu endpoint/DTO thực tế với contract (thiếu/thừa field, kiểu sai, endpoint lệch); \`engineering-quality-auditor\` kiểm authorization của endpoint mới/đổi (kiểm quyền theo vai trò/chủ sở hữu tài nguyên, không lộ dữ liệu người khác) và input validation (ràng buộc schema contract được thực thi ở server).`
   - Gate: `0 finding \`blocker\`;` → `0 finding \`blocker\`; có API thì 0 drift contract↔code;`
   - Khi fail, nối thêm: `; drift contract↔code → quay lại Bước 4 sửa code hoặc Bước 3 sửa contract.`
   - Evidence, nối thêm: `; có API: bảng đối chiếu contract↔code.`
7. Definition of Done: thêm sau dòng Bước 5: `- [ ] Có API: 0 drift contract↔code, 0 \`blocker\` về authorization/input validation — evidence: Bước 6`
8. `references/task-breakdown.md:17`: `` `DB` đã chạy qua `workflow-db-change` trước feature `` → `` `DB` đã chạy qua skill `data-db-migration` trước feature ``.

- [ ] **Step 3: bugfix + release**

- `workflows/bugfix/WORKFLOW.md` description: `→ workflow-incident.` → `→ ops-incident-troubleshooting.`
- `workflows/release/WORKFLOW.md`: thay cả 4 chỗ `` `workflow-incident` `` bằng `` skill `ops-incident-troubleshooting` `` (dòng 130, 142, 181, 182). Plugin `ops` đã có trong preamble của release.

- [ ] **Step 4: Orchestrator**

1. Thay toàn bộ bảng trong `## Registry` (giữ dòng tiêu đề bảng) bằng:

```markdown
| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |
|---|---|---|---|---|
| `workflow-feature` | "thêm tính năng", "thêm endpoint", "làm feature", "user story", acceptance criteria | medium | — | Chỉ sửa lỗi hành vi đã có → bugfix |
| `workflow-bugfix` | "lỗi", "bug", stacktrace, "không chạy", "sai kết quả" | medium | — | Hệ thống production đang sập → skill `ops-incident-troubleshooting` |
| `workflow-security-review` | "bảo mật", "OWASP", "CVE", "secret" | high | — | Chỉ cần quality gate trước release → release |
| `workflow-release` | "release", "phát hành", "chuẩn bị deploy", "ra version" | high | — | Chưa sẵn sàng phát hành, cần sửa lỗi/tính năng trước → feature/bugfix |
| `workflow-performance` | "chậm", "tối ưu hiệu năng", "performance", "latency" | medium | — | Chậm do lỗi logic rõ ràng, không phải hiệu năng → bugfix |
```

Trước khi thay, đối chiếu tín hiệu của dòng release và performance với file hiện tại; giữ nguyên văn tín hiệu đang có (contract 27 đòi mọi tín hiệu trong ngoặc kép có trong description của workflow).

2. Thay dòng `**Thứ tự ưu tiên:** …` bằng:

```markdown
**Thứ tự ưu tiên:** `workflow-security-review` > `workflow-bugfix` > `workflow-feature` > `workflow-performance` > `workflow-release`
```

3. Mục `## Yêu cầu chạy trực tiếp bằng skill`: đổi câu mở đầu thành `Các việc sau chỉ cần một năng lực nên là skill on-demand, không có workflow. Khi yêu cầu khớp, orchestrator không chọn workflow: chỉ nêu skill cần gọi và kết thúc (không phải lỗi). Kết thúc tại Bước 1, không cần \`orchestrator_result\`. Skill thuộc plugin chưa cài → in lệnh \`aip install --plugin <id>\`.` Giữ 3 dòng cũ (backend-init, frontend-init, vault-consul), rồi thêm vào **đầu** bảng:

```markdown
| "prod down", "sự cố", "alert", "incident" (xét TRƯỚC Registry) | `ops-incident-troubleshooting` (plugin `ops`) |
| "review", "PR#", "diff" | `backend-code-review` / `frontend-code-review` theo phía của diff; PR fullstack gọi cả hai |
| "refactor", "tái cấu trúc" | `backend-refactor` / `frontend-refactor`; "đổi kiến trúc" → `backend-migrate-architecture` / `frontend-migrate-architecture` |
| "viết test", "tăng coverage", "test strategy", "kiểm thử" | `backend-testing` / `frontend-testing`; luồng UI đầu-cuối → `frontend-e2e-testing` |
| "đổi schema", "migration", "thêm cột/bảng", "đổi index" | `data-db-migration` (plugin `data`) |
| "OpenAPI", "contract-first" (chỉ chốt contract, chưa code) | `backend-api-contract` |
| "cập nhật tài liệu", "sync docs", "viết runbook" | Session chính sửa trực tiếp; ghi quyết định kiến trúc → `engineering-adr` |
```

4. Bước 1, Hành động: thêm câu đầu `Tín hiệu sự cố production ở mục "Yêu cầu chạy trực tiếp bằng skill" được xét TRƯỚC Registry; khớp thì nêu skill và dừng.`
5. Vì cột Nối tiếp đều `—`, giữ nguyên luật chuỗi ở Bước 1/4 (cơ chế vẫn hợp lệ khi sau này thêm cặp nối tiếp).

- [ ] **Step 5: Xoá thư mục**

```bash
git rm -r workflows/api workflows/code-review workflows/db-change workflows/docs workflows/incident workflows/refactor workflows/testing
```

- [ ] **Step 6: `workflows/.manifest.json`**

`"version": "2.0.0"`. `description` thay bằng:

```
Bộ 5 workflow pipeline (feature, bugfix, security review, performance, release) + orchestrator chọn workflow hoặc chỉ đường tới skill theo yêu cầu. Mỗi workflow nối nhiều năng lực qua các bước có gate, evidence và checkpoint người duyệt; việc chỉ cần một năng lực gọi thẳng skill. Plugin bắt buộc: core, backend, frontend, engineering; release cần thêm ops (ghi ở preamble).
```

`hardDependencies` giữ nguyên.

- [ ] **Step 7: Contract**

`test/contract/50-workflows.contract.mjs`:
- mục 37: vòng `[['db-change', 'data'], ['incident', 'ops'], ['release', 'ops']]` → `[['release', 'ops']]`;
- `ok(hi.length === 4, \`4 workflow risk ≥ high …\`)` → `ok(hi.length === 2, \`2 workflow risk ≥ high (=${hi.map((s) => s.id).join(', ')})\`)`.

`10-source`, `00-unit`, `context.mjs` không đổi. Registry vẫn phải liệt kê đủ workflow; contract hiện có kiểm điều này.

- [ ] **Step 8: Pin + fixture + test CLI**

Xoá các assert có chủ thể là workflow đã gỡ. Đây là pin nội dung của artifact không còn tồn tại, nên không thuộc nhóm test được bảo vệ. Assert hồi quy có tên (WF1, WF2, WF10-chuỗi) đi theo workflow bị xoá.
- `02-p0-fixes.pin.mjs`: xoá 3 assert `P0 WF1: workflow-testing …` (2) và `P0 WF2: workflow-docs …` (1), cùng biến chỉ phục vụ chúng.
- `06-workflow-fixes.pin.mjs`:
  - xoá khối `const api = wfBody('workflow-api')` → hết assert `workflow-db-change Bước 7: DB tạm…`;
  - xoá khối `const cr = wf16('workflow-code-review')` + 3 assert;
  - trong khối WF10: xoá `nextOf` (nếu không còn dùng) và assert `workflow-orchestrator: Registry cho chuỗi db-change → api → feature…`; **giữ** các assert orchestrator còn lại (mục skill trực tiếp nêu backend-init/frontend-init/vault-consul, luật chuỗi ≤ 3, Bước 1 Đầu ra/Gate, Khi fail);
  - xoá assert `workflow-code-review Bước 3: Đầu vào và Evidence…`;
  - xoá khối `dbc17` (2 assert) và `inc17` (4 assert);
  - vòng `['workflow-feature', 'workflow-bugfix', 'workflow-testing']` → bỏ `'workflow-testing'`;
  - vòng `[['workflow-api', 8], ['workflow-security-review', 10]]` → `[['workflow-security-review', 10]]`;
  - xoá 2 assert cuối trỏ `references/forward-only.md` và `references/severity-scale.md`.
- `08-publish.pin.mjs`:
  - sanity `api5do19` → dùng `workflow-security-review` Bước 3 (`Thực hiện` có agent `engineering-quality-auditor`), đổi thông điệp tương ứng;
  - vòng `['workflow-api', 'workflow-feature', 'workflow-testing']` → `['workflow-feature']`;
  - xoá khối `api19`/`apiS6` (4 assert) và assert cuối `workflow-api Bước 6: chưa có màn hình…`;
  - assert feature Bước 2: `'\`workflow-db-change\`'` → `'\`data-db-migration\`'`, thông điệp `…đề xuất skill data-db-migration trước`;
  - **giữ** `orch19`/`featRow19` (feature vẫn không nối tiếp);
  - xoá mọi assert/biến `tst19`, `tS3`, `tS4`, `tS5`;
  - 2 vòng `[['workflow-feature Bước 5', fS5], ['workflow-testing Bước 4', tS4], ['workflow-testing Bước 5', tS5]]` → `[['workflow-feature Bước 5', fS5]]`;
  - vòng `[['workflow-feature', feat19], ['workflow-testing', tst19]]` → `[['workflow-feature', feat19]]`.
- `11-db-change.pin.mjs`: xoá khối `const dbc22 = wf22('workflow-db-change')` tới assert `offeredCatalog: vẫn offer workflows/workflow-db-change…` và 2 assert cuối trỏ `references/` của db-change; giữ assert về skill `data-db-migration` và agent `data-migration-writer`; comment dòng 1 và 6 bỏ `và workflow-db-change`.
- `test/fixtures/workflow-not-for-ids.json`: chỉ giữ 6 key:

```json
{
  "workflow-orchestrator": ["workflow-bugfix", "workflow-feature"],
  "workflow-feature": ["workflow-bugfix"],
  "workflow-bugfix": ["ops-incident-troubleshooting"],
  "workflow-security-review": ["engineering-quality-gate", "workflow-release"],
  "workflow-performance": ["workflow-bugfix"],
  "workflow-release": ["workflow-feature", "workflow-bugfix"]
}
```

- `test/install.test.mjs:169`: `=== 13, 'offeredCatalog: đủ 12 workflow + orchestrator'` → `=== 6, 'offeredCatalog: đủ 5 workflow + orchestrator'`.

- [ ] **Step 9: Kiểm trigger trùng**

```bash
grep -rn 'thêm endpoint' plugins core workflows
```

Expected: chỉ có 2 dòng: description của `workflows/feature/WORKFLOW.md` và Registry của orchestrator.

- [ ] **Step 10: Build, lock, toàn bộ test**

```bash
npm run build
```

```bash
node cli/lib/versions.mjs --lock
```

```bash
npm test
```

Expected: toàn bộ xanh. `15-workflow-pruning` có 21 assert (11 gate + 1 guard + 9 routing); `install.test` xanh.

```bash
npm run list
```

Expected: `workflows v2.0.0 — 6 workflow/orchestrator`.

- [ ] **Step 11: Commit qua `core:git-workflow`**

Header: `refactor(workflows)!: keep only pipeline workflows and route single-capability requests to skills`. Body tiếng Việt: định nghĩa workflow = pipeline; 7 thư mục đã gỡ; gate đã chuyển (tham chiếu commit Task 2–3); api gộp vào feature Bước 6; orchestrator giữ, Registry 5 dòng, mục skill trực tiếp mở rộng; nâng `2.0.0` vì gỡ skill; người dùng plugin-mode chạy `aip update`.

---

### Task 5: Tài liệu hiện hành + ghi chú cho tài liệu cũ

**Files:**
- Modify: `README.md`, `README_VI.md` (mục agent/workflow: bảng WF01–WF12, mục "Cách gọi", cột WF của bảng agent)
- Modify: `CLAUDE.md` (dự án)
- Modify: `CHANGELOG.md` (`## [Unreleased]`)
- Modify (chỉ thêm ghi chú đầu file): `docs/decisions/0001-database-capabilities-in-data-plugin.md`; 14 plan và 6 spec trong `docs/superpowers/` (danh sách sinh ở Step 4)

- [ ] **Step 1: README song ngữ**

Trong cả hai file:
- tiêu đề `### Workflow (12) + orchestrator` → `### Workflow (5) + orchestrator`;
- bảng chỉ giữ WF01 feature, WF02 bugfix, WF06 security-review, WF09 performance, WF11 release (giữ mã cũ để tham chiếu lịch sử không lệch) và dòng orchestrator;
- thêm ngay dưới bảng: `Việc chỉ cần một năng lực gọi thẳng skill (orchestrator cũng chỉ đường tới skill): review → \`backend-code-review\`/\`frontend-code-review\`; refactor → \`*-refactor\`/\`*-migrate-architecture\`; viết test → \`*-testing\`; đổi schema → \`data-db-migration\`; sự cố → \`ops-incident-troubleshooting\`.`;
- bảng agent: cột workflow của `data-migration-writer` → `skill data-db-migration`; của `ops-incident-investigator` → `skill ops-incident-troubleshooting`; bỏ WF03/04/05/07/08/10/12 khỏi các agent còn lại.

Bản tiếng Anh (`README.md`) sửa đúng các vị trí tương đương.

- [ ] **Step 2: `CLAUDE.md` (dự án)**

- Câu `Content spans … Cross-plugin **workflows + the orchestrator** live in the repo-level \`workflows/\`` → thêm sau đó: `(5 pipeline workflows; a capability-only task belongs in a skill, which the orchestrator routes to)`.
- `New workflow → copy … to \`workflows/<slug>/WORKFLOW.md\`, add a row to the registry in \`workflows/orchestrator/WORKFLOW.md\`.` → `New workflow → only for a pipeline that chains ≥ 2 different capabilities; copy … to \`workflows/<slug>/WORKFLOW.md\`, add a row to the registry in \`workflows/orchestrator/WORKFLOW.md\`. A single-capability request gets a row in the orchestrator's "Yêu cầu chạy trực tiếp bằng skill" table instead.`
- `\`workflows/.manifest.json\` \`hardDependencies\` … (e.g. \`data\`, \`ops\`) gets a "Plugin cần có" preamble line` → đổi ví dụ thành `(e.g. \`ops\`)`.

- [ ] **Step 3: `CHANGELOG.md`**

Dưới `## [Unreleased]`, thêm mục `### Removed` và `### Fixed` (hoặc nối vào mục đã có):

```markdown
### Removed

- Workflows `workflow-api`, `workflow-code-review`, `workflow-db-change`, `workflow-docs`, `workflow-incident`,
  `workflow-refactor` and `workflow-testing` (plugin `workflows` 2.0.0). A workflow is now only a pipeline across
  several capabilities; single-capability tasks call the skill directly, and `workflow-orchestrator` routes those
  requests to the skill. Their extra gates moved into `data-db-migration`, `ops-incident-troubleshooting`,
  `*-testing`, `*-code-review`, and the API drift/authorization checks into `workflow-feature` step 6.

### Fixed

- `aip update` / `aip install` skip (with a warning) skills recorded in the install manifest that no longer exist
  in the source, instead of failing with `Skill không tồn tại`.
```

- [ ] **Step 4: Ghi chú đầu file cho ADR, plan, spec cũ**

Tạo script tạm trong scratchpad (không commit), ví dụ `<scratchpad>/banner.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
const RETIRED = /workflow-(api|code-review|db-change|docs|incident|refactor|testing)\b/;
const MARK = '> **Cập nhật 2026-10-12:**';
const NOTE = `${MARK} các workflow \`workflow-api\`, \`workflow-code-review\`, \`workflow-db-change\`, \`workflow-docs\`,
> \`workflow-incident\`, \`workflow-refactor\`, \`workflow-testing\` đã gỡ — workflow giờ chỉ là pipeline nối nhiều năng
> lực. Gate của chúng chuyển sang skill (\`data-db-migration\`, \`ops-incident-troubleshooting\`, \`*-testing\`,
> \`*-code-review\`) và Bước 6 của \`workflow-feature\`; \`workflow-orchestrator\` chỉ đường tới skill. Nội dung bên dưới
> giữ nguyên làm hồ sơ lịch sử — xem \`docs/superpowers/plans/2026-10-12-prune-workflows-to-pipelines.md\`.
`;
const SELF = '2026-10-12-prune-workflows-to-pipelines.md';
const dirs = ['docs/decisions', 'docs/superpowers/plans', 'docs/superpowers/specs'];
const changed = [];
for (const d of dirs) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md') && x !== SELF)) {
  const p = path.join(d, f);
  const t = fs.readFileSync(p, 'utf8');
  if (!RETIRED.test(t) || t.includes(MARK)) continue;
  const lines = t.split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  lines.splice(h1 + 1, 0, '', NOTE.trimEnd());
  fs.writeFileSync(p, lines.join('\n'));
  changed.push(p);
}
console.log(changed.length, changed.join('\n'));
```

Run (từ gốc repo): `node <scratchpad>/banner.mjs`
Expected: `21` file (1 ADR + 14 plan + 6 spec). Chạy lại lần 2 → `0` (idempotent).

Kiểm thân file không đổi ngoài ghi chú:

```bash
git diff --stat docs/decisions docs/superpowers
```

Expected: mỗi file chỉ `+6` dòng, không có dòng `-`.

- [ ] **Step 5: Kiểm**

```bash
grep -rnE "workflow-(api|code-review|db-change|docs|incident|refactor|testing)" README.md README_VI.md CLAUDE.md
```

Expected: 0 dòng.

```bash
npm test
```

Expected: xanh (tài liệu không chiếu ra nên lock không đổi).

- [ ] **Step 6: Commit qua `core:git-workflow`**

Header: `docs: document the five pipeline workflows and annotate superseded docs`. Dừng ở đây, **không push**. Báo người dùng: branch `refactor/prune-workflows` gồm 5 commit, chờ duyệt để merge/push.
