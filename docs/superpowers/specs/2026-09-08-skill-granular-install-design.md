# Thiết kế: Cài đặt theo mức SKILL (chọn cha → load toàn bộ con) cho CLI + wizard

- Ngày: 2026-09-08
- Trạng thái: **Đã thực thi** trên `master` (2026-09-08 → 2026-09-09, `e105866` … `27721b4`).
- Phạm vi: Nâng cấp `cli/` (index + wizard + prompt + install) để chọn/cài/gỡ/update ở **mức skill**,
  với lựa chọn phân cấp plugin→skill. KHÔNG đổi adapter/build/parity, KHÔNG đổi nội dung plugins/.
- Người duyệt: chủ dự án (đã chốt 4 quyết định ở §2.3 + ngữ nghĩa update ở §5).

---

## 1. Mục tiêu & tiêu chí thành công

Hôm nay đơn vị cài là **plugin**: `installOne()` link/copy TOÀN BỘ skill của mỗi plugin; manifest chỉ
track `plugins:[ids]`. Người dùng không thể cài lẻ một vài skill.

Mục tiêu: cho phép **chọn skill lẻ** để `install | update | remove`, với UI/CLI phân cấp — **chọn lớp
cha (plugin) = chọn toàn bộ skill con**, đồng thời vẫn chọn được từng skill.

Thành công khi:

1. Wizard có bước chọn phân cấp (header plugin + skill con thụt vào; toggle cha cascade xuống con).
2. CLI có cờ `--skill a,b,...` (mức skill) song song `--plugin` (mức khối); cả hai hợp nhất được.
3. Cài/gỡ/update chính xác ở mức skill; manifest track đủ để gỡ lẻ và update đúng.
4. `core/principles` luôn được cài (ép bật); `core/git-workflow` chọn lẻ được.
5. Claude `--as-plugin` (plugin-mode) bỏ qua chọn lẻ, cài nguyên plugin + cảnh báo.
6. Tương thích ngược: manifest cũ (chỉ `plugins`) chạy y hệt, không cần migrate.
7. `npm test` xanh; `npm run validate` không đổi (build/parity không bị động tới).

---

## 2. Phạm vi

### 2.1 Trong phạm vi
- `cli/index.mjs` — parse `--skill`, route, help, ví dụ.
- `cli/lib/prompt.mjs` — primitive mới `selectTree` (multi-select phân cấp cha-con).
- `cli/lib/wizard.mjs` — bước chọn skill cho install; chọn skill đã cài cho uninstall.
- `cli/lib/install.mjs` — `installOne` lọc theo tập skill; manifest schema (`skills`); cộng dồn union;
  gỡ lẻ; `effective()`; update theo `effective()`.
- Test: `test/install.test.mjs`, `test/wizard.test.mjs`, thêm test cho `selectTree`, parse, resolve,
  backward-compat.

### 2.2 Ngoài phạm vi
- KHÔNG đổi `adapters/*`, `cli/build.mjs`, `test/validate.mjs` (build vẫn build tất cả; parity giữ nguyên).
- KHÔNG đổi nội dung `plugins/`, `core/`.
- KHÔNG tách skill trong claude plugin-mode (giới hạn `claude` CLI — xem §6).
- KHÔNG đổi cơ chế managed block, cowork pack, git-workflow.

### 2.3 Bốn quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | CLI lộ chọn-skill ở đâu | **Thêm cờ `--skill a,b,...`** (đa giá trị). `--plugin` giữ nghĩa "cả plugin". |
| Q2 | core khi mở chọn skill | **core cho chọn lẻ nhưng `principles` ÉP BẬT** (khoá). `git-workflow` chọn lẻ được. |
| Q3 | Claude `--as-plugin` + chọn lẻ | **Bỏ qua chọn lẻ, cài nguyên plugin của skill được chọn + cảnh báo.** |
| Q4 | UX wizard | **Một danh sách gộp**: header plugin + skill con thụt vào; toggle cha cascade con. |

---

## 3. Kiến trúc đích

Nguyên tắc: **build vẫn build tất cả; chọn-lọc chỉ xảy ra ở lớp ĐẶT FILE (install).**

- Loại phương án "build ra từng-skill-riêng": phá layout provider + parity `references/`, đắt, không cần.
- Định danh skill dùng id ghép **`plugin/skill`** (vd `backend/backend-init`, `core/git-workflow`) —
  bất chấp trùng tên, khớp đúng nhánh build (`build/<provider>/<...>/<plugin>/.../<skill>`).

```
cli/
├── index.mjs            # + parse --skill; truyền skills xuống install/uninstall/update; help
├── lib/
│   ├── prompt.mjs       # + selectTree(title, groups, opts) — multi-select phân cấp
│   ├── wizard.mjs       # install: bước chọn skill (gộp); uninstall: chọn skill đã cài
│   └── install.mjs      # + skillFilter trong installOne; schema skills; effective(); union; gỡ lẻ
```

---

## 4. Mô hình lựa chọn & manifest (bản chốt)

Entry manifest lưu **hai trường tách bạch**:

- `plugins: [ids]` — plugin chọn **nguyên khối** (toggle header cha, hoặc chọn đủ **mọi** con). Nghĩa:
  "mọi skill của plugin này, cả hiện tại lẫn tương lai".
- `skills: [plugin/skill]` — skill chọn **lẻ** khi cha KHÔNG được lấy nguyên khối.

**Quy tắc quy về khối (xác định):** từ tập chọn `S` (các `plugin/skill`), với mỗi plugin `p` có tập con
`C_p`:
- nếu `C_p ⊆ S` → thêm `p` vào `plugins` (nguyên khối);
- ngược lại → thêm `S ∩ C_p` vào `skills`.
- Chuẩn hoá dedup: `skills := skills \ ⋃ allSkillsOf(plugins)` (bỏ skill đã nằm trong khối).

**Tập skill hiệu lực** (dùng để lọc đặt file):
```
effective(entry) = {core/principles}                        // ép bật (Q2)
                 ∪ ⋃ allSkillsOf(p)  ∀ p ∈ entry.plugins    // khối → mở rộng theo kit HIỆN TẠI
                 ∪ entry.skills                              // lẻ → cố định
```

**Skill principles (generated, KHÔNG à-la-carte):** `core/principles` và `<plugin>-principles`
(sinh từ `plugins/<id>/shared/principles.md`) **KHÔNG** là skill nguồn của `loadSkills` (không có
`skills/<id>/SKILL.md`). Vì thế:
- `skillCatalog()` **prepend** `core/principles` vào nhóm core (khoá bật) — không lấy từ `loadSkills`.
- `effectiveSkills(entry)` **tự thêm** `<plugin>/<plugin>-principles` cho **mọi** plugin đang active
  (khối hoặc suy từ skill lẻ), cạnh `core/principles` ép bật.
- Cả hai loại principles **ship tự động** cùng bất kỳ plugin nào đang active; chúng **không** chọn-lẻ
  được và không nằm trong tập à-la-carte của `--skill`.

**Mặc định core nguyên khối (selectable-off nhưng default-on):** `resolveSelection` coi core là **WHOLE**
trừ khi selection **nhắc tường minh** một skill `core/*` (không có `core` trong `--plugin`, không `core/*`
trong `--skill`). Nhờ vậy `--plugin backend` và wizard-với-git-workflow-được-tick vẫn ship `core/git-workflow`
(default-on, backward-compat); còn `--skill core/principles` thu hẹp core còn đúng principles (narrow git-workflow
ra). Đây là cơ chế biến `core/git-workflow` thành **chọn-lẻ-tắt-được** trong khi vẫn **mặc-định-bật**.

**Cộng dồn (install thêm):** `plugins := prev.plugins ∪ new.plugins`; `skills := prev.skills ∪ new.skills`;
rồi chuẩn hoá dedup như trên.

**Tương thích ngược:** entry cũ chỉ có `plugins`, thiếu `skills` → coi `skills = []`. `effective()` mở rộng
`plugins` như "nguyên khối" = đúng hành vi hôm nay. Không cần migrate manifest.

Ví dụ entry (skills-mode):
```json
{
  "provider": "claude",
  "plugins": ["backend"],
  "skills": ["frontend/frontend-init", "core/git-workflow"],
  "scope": "project",
  "files": [], "links": ["..."], "managed": ["CLAUDE.md"],
  "installedAt": "2026-09-08T..."
}
```

---

## 5. Luồng update (ngữ nghĩa đã chốt)

`aip update` giữ trình tự: **git pull → build lại → cài lại từng entry**, nhưng "cài lại" tính theo
`effective(entry)`:

| Loại đã cài | Update làm gì |
|---|---|
| Plugin nguyên khối (∈ `plugins`) | Mở rộng LẠI theo kit mới → **tự nhận skill MỚI** của plugin + refresh nội dung skill cũ. |
| Skill lẻ (∈ `skills`) | **Chỉ refresh nội dung** đúng các skill đó → KHÔNG tự kéo thêm skill anh em mới. |
| `core/principles` | Luôn refresh (ép bật). |

Cơ chế refresh:
- **symlink** (mặc định): link trỏ `build/` → rebuild là tươi; skill MỚI (của plugin khối) cần link mới →
  reinstall tạo; skill bị xoá upstream → teardown-trước-cài-lại (`uninstallEntries` gỡ nguyên entry rồi
  cài lại `effective`) dọn link cũ.
- **copy** (chạy từ node_modules): reinstall re-copy toàn bộ `effective`.
- **claude `--as-plugin`**: refresh nguyên plugin qua `claude` CLI như hiện tại; plugin-mode chỉ có `plugins`.

Hệ quả cho người dùng: **muốn nhận skill mới nhất của một plugin → cài plugin nguyên khối; muốn khoá đúng
vài skill → chọn lẻ.**

---

## 6. Claude `--as-plugin` (plugin-mode)

`claude` CLI chỉ cài **nguyên plugin** (`claude plugin install <id>@<mkt>`), không tách skill được. Khi
người dùng đưa chọn-lẻ ở plugin-mode:

- Suy tập plugin từ tập skill/plugin đã chọn (mọi `plugin/skill` → lấy `plugin`), cài **nguyên các plugin đó**.
- In cảnh báo: "plugin-mode cài cả plugin, không tách skill — dùng mode skills nếu muốn chọn lẻ".
- Entry plugin-mode chỉ ghi `plugins` (không `skills`). Không đổi `claudePluginCommands`/refresh.

---

## 7. Thay đổi theo thành phần

### 7.1 `cli/lib/prompt.mjs` — `selectTree`

Primitive mới, tái dùng khung raw-mode/redraw của `runSelect`:

- Chữ ký: `selectTree(title, groups, { preselected, lockedValues } = {})`, `groups = [{ plugin, label,
  skills: [{ value:'plugin/skill', label, hint, locked? }] }]`. Trả về danh sách `plugin/skill` đã chọn.
- Dòng render: **header plugin** (không thụt) + **skill con** (thụt 2 space). Header hiện trạng thái:
  `[x]` (đủ con) / `[~]` (một phần) / `[ ]` (rỗng). Con: `[x]/[ ]`; con `locked` (principles) vẽ `[x]` mờ,
  bỏ qua toggle.
- Điều hướng: `↑/↓` chạy qua **mọi dòng** (header + skill). `Space` trên header = bật/tắt toàn bộ con của
  nhóm (bỏ qua con locked — luôn giữ bật); `Space` trên skill = toggle skill đó. `a` = tất cả. `Enter` xác
  nhận (min ≥ 1 skill hiệu lực; principles luôn tính). `b`/`q` như cũ.
- Tách phần thuần để test: hàm `cascadeToggle(state, groupIndex)`, `headerState(group, selected)` — không I/O.

`selectOne`/`selectMany` giữ nguyên. `keyToAction` giữ nguyên (đủ dùng).

### 7.2 `cli/lib/wizard.mjs`

- **install**: thay bước "Chọn plugin" (3/5) bằng "Chọn skill (gộp theo plugin)". Dựng `groups` từ
  `loadPlugins()` + `loadCore()` (core đứng đầu, `principles` `locked:true`). Preselect từ trạng thái đã
  cài (đọc manifest mức skill — xem 7.4 `check`). Trả `selection` (danh sách `plugin/skill`).
- **uninstall**: thay "chọn provider" bằng chọn skill ĐÃ CÀI (gộp provider→plugin→skill) để gỡ lẻ. Nếu
  rỗng → CANCEL như hiện tại.
- **update**: giữ "cập nhật tất cả đã cài" (không cần chọn skill).
- `deps` thêm `loadPlugins`/`loadCore` (hoặc một helper `skillCatalog()`) để test inject được.

### 7.3 `cli/index.mjs`

- `parse()`: thêm `--skill <csv>` và `--skill=<csv>` → `a.skill` (mảng, split `,`, trim). Đặt `a.explicit`.
- Route `install`/`uninstall`/`update` truyền `skills: a.skill` (khi có).
- `--help`: thêm `--skill`, mô tả "chọn skill lẻ dạng plugin/skill hoặc tên skill; --plugin = cả plugin",
  thêm ví dụ.

### 7.4 `cli/lib/install.mjs`

- **`resolveSelection({ plugins, skills })` (PURE, export)**: chuẩn hoá đầu vào (cờ `--plugin`/`--skill`
  hoặc mảng từ wizard) → `{ plugins:[ids], skills:[plugin/skill] }` đã validate + dedup + quy-về-khối.
  Skill trần (không có `/`) → suy plugin nếu duy nhất, else fail-loud liệt kê ứng viên.
- **`allSkillsOf(pluginId)`**: từ `loadPlugins()`/`loadCore()`.
- **`effectiveSkills(entry)` (PURE, export)**: theo công thức §4 (ép `core/principles`).
- **`installOne(provider, effSkillSet, scope)`**: mỗi nhánh provider (claude/codex/cursor/agents) chỉ
  `placeEntry` skill-dir khi `effSkillSet.has(`${pluginId}/${skillName}`)`. core: `core/principles` luôn
  qua. `agents` (antigravity) ship nguyên cây plugin theo skill? → antigravity build theo `docs/workflow/
  <skill>/`; lọc theo skill tương tự (chi tiết: đặt từng thư mục skill đã chọn, giữ file plugin-level).
- **`install(...)`**: dùng `resolveSelection` → tính `effective` cho lần cài này → union với entry cũ →
  ghi `plugins`+`skills` vào entry. plugin-mode: suy plugin, cài nguyên plugin, cảnh báo (Q3).
- **`uninstall({ providers, plugins, skills, scope })`**: filter entry theo provider + (plugin|skill).
  Gỡ lẻ: gỡ nguyên entry khớp rồi cài lại phần `effective` CÒN GIỮ (tái dùng `reinstall` pattern hiện có,
  nhưng theo skill: `remainingSkills = effective(e) \ toRemove`).
- **`update({ scope })`**: mỗi entry cài lại theo `effective(entry)` (đã bao gồm mở-rộng-khối). Không đổi
  nhánh plugin-mode refresh.
- **`check({ scope })`**: trả thêm `skills` (từ `effective(entry)`) để wizard preselect và hiển thị.

Skill-dir name là DUY NHẤT toàn cục theo quy ước (domain-prefixed) và build đặt chúng phẳng
(`.claude/skills/<skill>`, `.codex/skills/<skill>`, `.cursor/skills/<skill>`), nên khoá theo `plugin/skill`
là đủ và không đụng nhau.

---

## 8. Kiểm thử & verification

Unit thuần (không TTY, không FS thật khi có thể):

1. `selectTree`: `cascadeToggle` (cha bật→mọi con bật, giữ locked), `headerState` (đủ/một-phần/rỗng),
   preselect, min ≥ 1.
2. `parse('--skill a,b')` → `a.skill = ['a','b']`, `explicit=true`.
3. `resolveSelection`: quy-về-khối (đủ con → `plugins`), skill lẻ → `skills`, skill trần suy plugin,
   skill/plugin không tồn tại → ném liệt kê.
4. `effectiveSkills`: ép `core/principles`; mở rộng khối; hợp lẻ; backward-compat (entry thiếu `skills`).
5. `installOne` skill filter: chỉ skill được chọn xuất hiện dưới scope root (dùng `$AIE_INSTALL_ROOT`).
6. Cộng dồn union + dedup; gỡ lẻ skill (giữ phần còn lại); update mở-rộng-khối nhận skill mới (giả lập
   thêm skill vào kit tạm).
7. plugin-mode: chọn lẻ → argv `claude plugin install` theo NGUYÊN plugin + cảnh báo (dùng argv thuần
   `claudePluginCommands`).

Chạy: `npm test` (gồm install + wizard + validate --build + managed-block + pack-guard) phải xanh.
`npm run validate` không đổi kết quả (build/parity không bị động).

Không có trong đợt này: đổi số bước wizard cứng (chuỗi bước có thể đổi nhãn "Bước x/y").

---

## 9. Sự kiện đã kiểm chứng (2026-09-08, đọc trực tiếp source)

| Sự kiện | Nguồn |
|---|---|
| Đơn vị cài hiện tại = plugin; `installOne` link/copy mọi skill-dir của plugin | `cli/lib/install.mjs:332-401` |
| Manifest entry: `{provider, plugins, scope, files, links, managed, installedAt}` (+ mode/marketplace/cliScope cho plugin-mode) | `install.mjs:433-451` |
| Cộng dồn hiện tại theo union `plugins`; gỡ lẻ plugin = gỡ entry rồi cài lại phần giữ | `install.mjs:443-451, 489-513` |
| Fail-loud khi id lạ nay ở `resolveSelection` (private `resolvePlugins` đã gỡ khi thực thi) | `install.mjs` (`resolveSelection`) |
| `loadSkills` auto-discover `skills/<id>/SKILL.md`; skill-dir name = tên thư mục | `cli/lib/plugins.mjs:89-144` |
| `selectMany`/`runSelect` raw-mode, `keyToAction` thuần, redraw đếm dòng visual | `cli/lib/prompt.mjs:74-127` |
| Wizard install bước 3/5 chọn plugin (selectMany); uninstall chọn provider | `cli/lib/wizard.mjs:71-113` |
| `--as-plugin` cài nguyên plugin qua `claude` CLI (namespaced, whole-plugin) | `install.mjs:238-255, 426-440` |
| Build layout: claude `plugins/<id>/skills/<skill>`, codex/cursor `<id>/skills|.cursor/skills/<skill>` | `install.mjs:340-390` |
| `$AIE_INSTALL_ROOT` override scope root (test cô lập) | CLAUDE.md + `paths.mjs` (scopeRoot) |

## 9.1 Chưa kiểm chứng — session thực thi tự xác nhận

| Điều cần xác nhận | Cách |
|---|---|
| [Unverified] Antigravity (`kind: 'agents'`) lọc theo skill có cần đặt lại file plugin-level không | đọc `adapters/antigravity` + build output, thử cài 1 skill |
| [VERIFIED] Skill-dir name duy nhất toàn cục giữa mọi plugin (backend-init, principles, `<id>-principles`) → cài nhiều plugin không đụng đích phẳng | comment `adapters/codex/adapter.mjs:11-12` |
| [Inference] Giữ nguyên số nhãn "Bước x/y" khi thêm/bớt bước wizard | rà lại chuỗi `runSteps` sau khi sửa |

---

## 10. Ranh giới / an toàn

- Không đụng adapter/build/parity/validate. Nếu buộc phải đụng → dừng, báo, nâng phạm vi.
- Không đổi nội dung plugins/core.
- Giữ zero-dependency, pure ESM, không thêm bước build.
- Dừng cho người duyệt diff trước khi commit (1 task = 1 commit); commit qua `core:git-workflow`.

---

## 11. Các pha thực thi

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| P1 | `install.mjs`: `resolveSelection`, `allSkillsOf`, `effectiveSkills` (PURE, export) + schema `skills` + backward-compat | Unit §8 mục 3–4 xanh |
| P2 | `install.mjs`: `installOne` skill filter (4 nhánh provider) + `install` ghi `plugins`+`skills` + union/dedup | Unit §8 mục 5–6 xanh; cài lẻ 1 skill chỉ ra 1 skill |
| P3 | `uninstall` gỡ lẻ skill + `update` theo `effective` + `check` trả `skills` | Gỡ lẻ giữ phần còn lại; update khối nhận skill mới |
| P4 | plugin-mode: suy plugin + cảnh báo (Q3) | argv nguyên-plugin + cảnh báo |
| P5 | `prompt.mjs`: `selectTree` + phần thuần `cascadeToggle`/`headerState` | Unit §8 mục 1 xanh |
| P6 | `wizard.mjs`: install (chọn skill gộp), uninstall (chọn skill đã cài) | Wizard test xanh |
| P7 | `index.mjs`: parse `--skill` + route + help + ví dụ | Unit §8 mục 2 xanh; `aip --help` đúng |
| P8 | `npm test` toàn bộ; dừng duyệt diff → commit qua git-workflow | `npm test` xanh; người dùng duyệt |

Thứ tự P1→P3 tuần tự (đụng install core). P4 sau P2. P5 độc lập (làm song song P1–P4). P6 sau P5. P7 sau P1.
