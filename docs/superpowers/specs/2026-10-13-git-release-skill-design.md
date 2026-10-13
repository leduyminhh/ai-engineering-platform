# Thiết kế: skill `core/git-release` (Gitflow release/hotfix) + gỡ `workflow-release`

- **Ngày:** 2026-10-13
- **Trạng thái:** chờ người dùng review
- **Phạm vi:** quy trình release/hotfix chuẩn. Business logic riêng của người dùng: chỉ có chỗ cắm
  (`release-policy.md` §4), diễn giải chi tiết thuộc spec sau.

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

- `core/git-workflow` chỉ có ~3 dòng cho Release/Hotfix (`SKILL.md` mục *Merge / Revert / Release / Hotfix*,
  `references/gitflow-checklist.md`): không có bước tính semver, tag, promotion qua staging, merge-back.
- `workflow-release` gộp quality gate, release notes, deploy checklist và tag theo thứ tự *deploy rồi mới tag*,
  không khớp Gitflow (tag khi merge vào production branch). Người dùng quyết định gỡ workflow này.

### 1.2 Mục tiêu

1. Skill mới `core/git-release` chạy release/hotfix theo Gitflow trên local, mọi `push` chờ xác nhận.
2. Gỡ `workflow-release`, chuyển gate riêng của nó về skill nhận lại, xoá 2 agent chỉ phục vụ nó.

### 1.3 Tiêu chí thành công

- `release start|finish`, `hotfix start|finish` chạy đúng luồng §3 trên repo có/không có integration branch,
  có/không có `staging`.
- `next-version.mjs` tính đúng version cả khi tag nằm trên merge commit của production branch (không phải tổ
  tiên của `develop`).
- Không còn tham chiếu sống tới `workflow-release`, `engineering-release-scribe`, `ops-release-engineer`
  ngoài tài liệu lịch sử.
- `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` xanh.

### 1.4 Ngoài phạm vi

- Sinh pipeline GitHub Actions (`.github/workflows/release.yml`).
- Pre-release tag (`-rc.N`).
- Diễn giải/thi hành business rules (§4 của policy chỉ được đọc và trình ở checkpoint).
- Merge mà không ra version (thuộc `git-workflow`).
- Sắp xếp lại các skill deploy (`ops-deploy-release`) ngoài việc nhận gate ở §6.2.

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Mô hình Gitflow; skill mới đặt ở `core/skills/git-release/` (phương án A) |
| D2 | Version tự tính từ Conventional Commits, người dùng xác nhận (có thể nhập số khác) |
| D3 | Chạy git trên local; mọi `push`, tạo GitHub Release, xoá branch đều ⏸ chờ xác nhận |
| D4 | Giữ 1 checkpoint duyệt diff trước mỗi commit do skill tạo (baseline `AGENTS.md`) |
| D5 | Phạm vi: release + hotfix; tách `start` / `finish` |
| D6 | Hotfix tách từ production branch tại tag gần nhất; merge-back vào `release/*` đang mở, không có thì vào integration branch, không có nữa thì bỏ qua |
| D7 | Branch theo vai trò (integration, promotion chain), không cố định tên; luôn ⏸ xác nhận ở `start` dù nguồn là tham số, policy hay dò tự động |
| D8 | Promotion chain: có `staging` thì vào `staging` trước, không thì vào thẳng production; nguồn merge ở mọi chặng là `release/*` (`hotfix/*`) |
| D9 | `-SNAPSHOT` / `.devN`: tự nhận biết theo version hiện tại |
| D10 | `--no-bump` / `version files: none`: vẫn tính version + tag, không sửa file version |
| D11 | 0.x + breaking → minor (đổi được qua policy) |
| D12 | GitHub Release: bước tuỳ chọn khi remote là GitHub và `gh auth status` OK |
| D13 | Gỡ `workflow-release`, chuyển gate (§6.2), xoá `engineering-release-scribe`, `ops-release-engineer` |
| D14 | Một spec, hai commit: (i) thêm `git-release`; (ii) gỡ `workflow-release` |

## 3. Luồng

### 3.1 Preflight chung (sai → dừng, báo thiếu gì)

- Worktree sạch; `git fetch origin`; các branch trong vai trò khớp `origin` (không lệch).
- `start`: chưa có `release/*` (với release) hoặc `hotfix/*` (với hotfix) đang mở.
- `finish`: có đúng một `release/*` (`hotfix/*`) đang mở.
- Tag semver lớn nhất toàn repo đúng `tag format`; repo chưa có tag → hỏi version khởi điểm.
- Baseline build/test (gate chuyển từ `workflow-release`): ở `release start`, yêu cầu người dùng chạy hoặc cho
  phép chạy lệnh build/test của project, ghi kết quả vào báo cáo; đỏ → dừng, đề xuất `workflow-bugfix`. Khuyến
  nghị chạy `engineering-quality-gate` trước `release start` (không bắt buộc, không gọi tự động).
- Ghi hash hiện tại của mọi branch vai trò để đề xuất hoàn tác.

### 3.2 Chọn branch (D7)

Thứ tự nguồn: tham số lệnh → `project-knowledge/release-policy.md` → dò trên `origin`
(integration: `develop`, `dev`, `development`; chain: `staging` nếu có, rồi `main`/`master`). Dò ra 0 hoặc ≥ 2
ứng viên cho một vai trò → hỏi.

Checkpoint ⏸ ở `release start` và `hotfix start` luôn hiện bảng: vai trò · giá trị · nguồn · tồn tại trên
`origin`. Giá trị không có trên `origin` bị đánh dấu ✗ và không xác nhận được trừ khi người dùng nói rõ đó là
branch chỉ có local. Giá trị khác policy → hỏi có cập nhật policy không. `finish` không hỏi lại; policy đổi so
với lúc `start` → cảnh báo và dừng.

### 3.3 `release start`

1. Preflight + chọn branch ⏸.
2. `next-version.mjs --base <integration|production>` → bảng commit theo nhóm + version đề xuất. Exit 2 → dừng,
   hỏi. ⏸ xác nhận version.
3. Tạo `release/X.Y.Z` từ integration branch (không có → từ production branch).
4. Bump file version (§5.2; bỏ khi D10). Có dev suffix → bỏ hậu tố. Cập nhật CHANGELOG (dùng
   `engineering-release-notes` nếu đã cài; không thì sinh mục tối thiểu theo nhóm commit).
5. ⏸ duyệt diff → commit `chore(release): vX.Y.Z` (theo `git-workflow` commit convention). Không có file nào đổi
   → không commit.
6. ⏸ `git push -u origin release/X.Y.Z`. Dừng: team test, fix lỗi bằng commit lên `release/*` qua `git-workflow`.

### 3.4 `release finish` (chạy lại nhiều lần, không lưu trạng thái)

Mỗi lần chạy xác định chặng kế tiếp bằng `git merge-base --is-ancestor`. Chặng trước chỉ coi là xong khi chứa
đúng HEAD hiện tại của `release/*`; có commit mới (fix, merge-back hotfix) → làm lại từ chặng đầu.

- Có commit mới từ sau commit release → cập nhật CHANGELOG, ⏸ diff, commit.
- **Chặng không phải cuối:** `merge --no-ff release/X.Y.Z` vào chặng → ⏸ push chặng + `release/*` → dừng để
  người dùng deploy/test.
- **Chặng cuối:** merge `--no-ff` vào production → `git tag -a vX.Y.Z` trên merge commit → merge-back
  `release/*` vào integration branch (nếu có) → dev suffix: thêm commit nâng integration lên phiên bản dev kế
  tiếp (⏸ diff) → ⏸ `git push --atomic origin <production> <integration> vX.Y.Z` → ⏸ GitHub Release (D12) →
  ⏸ xoá `release/*` local + origin → báo cáo.

### 3.5 Hotfix

- `hotfix start`: preflight + chọn branch ⏸ (base = production tại tag gần nhất, merge-back theo D6) →
  `next-version.mjs --hotfix` (luôn patch) ⏸ → tạo `hotfix/X.Y.Z` → dừng. Skill không viết code sửa lỗi; việc
  đó thuộc `git-workflow` / `workflow-bugfix` / `backend-fix` / `frontend-fix`.
- `hotfix finish`: như `release finish` (bump + CHANGELOG ⏸, đi qua promotion chain), merge-back theo D6,
  nhưng không thêm commit nâng dev suffix (integration giữ phiên bản dev của nó; conflict dòng version xử lý
  theo §3.6).
  Có thể bỏ chặng bằng tham số khi khẩn cấp; báo cáo ghi rõ chặng đã bỏ.

### 3.6 Conflict

- Dự đoán được: dòng version trong file version (đề xuất giữ version cao hơn) và phần đầu CHANGELOG (giữ cả
  hai mục, version cao hơn ở trên) → trình cách resolve ⏸.
- Mọi file khác → dừng, liệt kê file, không tự resolve, không `reset --hard`.

### 3.7 Hoàn tác

Chưa push: đề xuất lệnh xoá tag/đưa branch về hash đã ghi ở preflight, ⏸. Đã push: chỉ đề xuất `git revert`,
không động vào lịch sử remote.

## 4. Cấu trúc skill

```text
core/skills/git-release/
├── SKILL.md
├── references/
│   ├── release-flow.md        Gitflow, promotion chain, merge-back, hotfix chen ngang
│   ├── version-files.md       bảng dò Java / Python / Node, dev suffix, version từ git tag
│   ├── release-policy.md      mẫu policy (§7) + ý nghĩa khoá
│   ├── conflict-rules.md      §3.6
│   └── output-template-vi.md  mẫu báo cáo cuối
└── scripts/next-version.mjs
```

- Frontmatter: `name: git-release`, `order`, `title`, `runsIn`, `invoke`,
  `argument-hint: "[release|hotfix] [start|finish] [--no-bump]"` (quoted).
- Body có `## Quy trình …` và `## Ranh giới an toàn …`.
- Description (≤ 500 ký tự, trigger không trùng skill khác), bản dự kiến:
  > Chạy release/hotfix theo Gitflow: tính semver từ Conventional Commits, tạo release/hotfix branch, bump
  > version Java/Python/Node, merge qua staging → main, tag, merge-back; push chờ xác nhận. Dùng khi người dùng
  > muốn "release start", "release finish", "hotfix start", "tạo tag version", "merge release vào main". Không
  > dùng khi chỉ commit/merge không ra version → git-workflow; cần checklist deploy/rollback → ops-deploy-release.

### 4.1 Ranh giới an toàn

- Không: `push --force`, `reset --hard`, viết lại lịch sử, sửa/ghi đè tag đã có (tag tồn tại → dừng), commit
  trực tiếp lên branch trong promotion chain (chỉ merge), tự sửa code trên `release/*`/`hotfix/*`, đọc file
  secret (`.env`, keystore, file properties chứa secret) khi dò version.
- Luôn ⏸: chọn branch, version, diff mỗi commit, mọi `push`, GitHub Release, xoá branch, ghi/sửa
  `release-policy.md`, cách resolve conflict dự đoán được.

## 5. `next-version.mjs` và file version

### 5.1 Script

```text
node next-version.mjs --base <ref> [--hotfix] [--tag-prefix v] [--json]
```

- Hai lớp: hàm thuần `computeNext({ tags, commits, hotfix, tagPrefix, zeroMajorBreaking })` được export; CLI
  gọi `git`, chỉ import `node:*`, có guard `realpathSync` (mẫu `check-commit-message.mjs`).
- Tag gần nhất = tag semver lớn nhất toàn repo (`git tag --list --sort=-v:refname`), bỏ tag sai định dạng.
  Không dùng `git describe` (tag Gitflow nằm trên merge commit production, không phải tổ tiên của `develop`).
- Phạm vi: `<tag>..<base> --no-merges`.
- Bump: `!` hoặc footer `BREAKING CHANGE:` → major (0.x → minor theo D11) · `feat` → minor · `fix`/`perf` →
  patch · còn lại → none. `--hotfix` luôn patch, feat/breaking → `warnings`. Commit không theo Conventional
  Commits → nhóm `other` + `warnings`.
- Output `--json`: `{ current, next, nextDev, bump, tag, range, groups: { breaking, feat, fix, other }, warnings }`
  (`nextDev` = minor kế tiếp của `next`, dùng cho dev suffix).
- Exit: `0` có version mới · `2` bump none · `1` lỗi (không phải git repo, ref không tồn tại).

### 5.2 File version (hướng dẫn trong `references/version-files.md`)

Dò theo thứ tự: version lấy từ git tag trước (Java `jgitver`/`axion-release`/`gradle-git-versioning`; Python
`setuptools-scm`/`hatch-vcs`/`poetry-dynamic-versioning`) → không bump file.

| Stack | Nơi khai báo | Cách bump |
|---|---|---|
| Maven | `<project><version>` (không phải `<parent>`) | `mvn versions:set -DnewVersion=<v> -DgenerateBackupPoms=false` (multi-module: chạy ở pom gốc, `-DprocessAllModules` khi cần) |
| Maven CI-friendly | `<revision>` property | sửa `<revision>`, không chạy `versions:set` |
| Gradle | `gradle.properties` `version=` / `build.gradle(.kts)` | sửa đúng một nơi; cả hai có → hỏi |
| PEP 621 | `[project] version` | sửa dòng (hoặc `uv version <v>` sau khi kiểm `uv version --help`) |
| Poetry | `[tool.poetry] version` | `poetry version <v>` |
| Hatch | `[tool.hatch.version] path` | `hatch version <v>` |
| Dynamic → file | `__version__` trong file được trỏ tới | sửa file đó |
| Cũ | `setup.py` / `setup.cfg` | sửa dòng |
| Node | `package.json` | `npm version <v> --no-git-tag-version` |

- Version trong file ≠ `current` của script → cảnh báo, hỏi, không bump đè.
- Nhiều nơi khai báo lệch nhau / nhiều stack → hỏi; lựa chọn có thể ghi vào policy.
- Tool native không có → sửa trực tiếp file.

## 6. Tích hợp & gỡ `workflow-release`

### 6.1 Commit (i) — thêm `git-release`

| File | Thay đổi |
|---|---|
| `core/skills/git-release/**` | mới (§4, §5) |
| `core/skills/git-workflow/SKILL.md` | description: "Không dùng khi" thêm release/hotfix có version → `git-release`; mục Release/Hotfix rút còn 1 dòng trỏ sang |
| `core/skills/git-workflow/references/gitflow-checklist.md` | mục Release/Hotfix rút còn 1 dòng trỏ sang |
| `workflows/orchestrator/WORKFLOW.md` | bảng "Yêu cầu chạy trực tiếp bằng skill": dòng release/hotfix → `core/git-release` |
| `core/.manifest.json` | 1.4.3 → 1.5.0 |
| `CHANGELOG.md` | `[Unreleased]` / Added |
| test | §8 |

### 6.2 Commit (ii) — gỡ `workflow-release`

| Gate của `workflow-release` | Nơi nhận |
|---|---|
| Baseline build/test | preflight `release start` (§3.1) |
| Quality gate | khuyến nghị `engineering-quality-gate` trong preflight (§3.1) |
| Migration chờ chạy so với tag trước, thứ tự migration ↔ deploy | `ops-deploy-release` `references/release-checklist.md` mục 2 |
| Smoke e2e trước deploy (`workflows/release/references/smoke-e2e.md`) | `ops-deploy-release`: mục tuỳ chọn khi project có `e2e/`, chạy theo `frontend-e2e-testing`, chỉ local/test, không sửa test |
| Release notes | `git-release` §3.3 bước 4 |

| File | Thay đổi |
|---|---|
| `workflows/release/` | xoá |
| `plugins/engineering/agents/engineering-release-scribe.md`, `plugins/ops/agents/ops-release-engineer.md` | xoá |
| `workflows/orchestrator/WORKFLOW.md` | bỏ dòng registry + khỏi thứ tự ưu tiên; "release", "phát hành", "ra version" → `core/git-release`; "chuẩn bị deploy" → `ops-deploy-release` |
| `core/skills/git-workflow/SKILL.md`, `plugins/engineering/skills/engineering-release-notes/SKILL.md`, `plugins/ops/skills/ops-deploy-release/SKILL.md`, `workflows/security-review/WORKFLOW.md` | "→ workflow-release" đổi sang id thật (`git-release` / `ops-deploy-release`) |
| `test/fixtures/not-for-ids.json`, `test/fixtures/workflow-not-for-ids.json` | cập nhật theo description mới |
| `README.md`, `README_VI.md` | bỏ dòng WF11, nêu `git-release` |
| `CHANGELOG.md` | `[Unreleased]` / Removed + Changed |
| `cli/lib/install.mjs` | không đổi (`dropRetiredSkills` tự lọc id đã gỡ) |
| `docs/superpowers/**`, `.superpowers/**` | không đổi (tài liệu lịch sử) |

Version: `workflows` 2.0.1 → 3.0.0, `engineering` 1.6.1 → 2.0.0, `ops` 1.5.1 → 2.0.0 (gỡ workflow/agent là
breaking, theo tiền lệ 0614ed9); `core` giữ 1.5.0 nếu commit (i) đã bump, nếu commit (ii) đổi nội dung core
thì bump patch. Chạy `node cli/lib/versions.mjs --lock`.

## 7. Mẫu `release-policy.md`

Skill copy mẫu vào `project-knowledge/release-policy.md` của project đích khi người dùng đồng ý.

| Mục | Khoá (mặc định) |
|---|---|
| 1. Branch | `integration branch` (`auto`), `promotion chain` (`auto`), `release branch` (`release/{version}`), `hotfix branch` (`hotfix/{version}`), `xoá branch sau finish` (`ask`) |
| 2. Version | `tag format` (`v{version}`), `version files` (`auto` / `none` / danh sách), `dev suffix` (`auto`), `breaking khi 0.x` (`minor`) |
| 3. Phát hành | `changelog` (`CHANGELOG.md` / `none`), `github release` (`auto` / `no`) |
| 4. Business rules | bảng `ID · Thời điểm · Điều kiện · Hành động / Ràng buộc · Checkpoint · Nếu vi phạm`, để trống |

Giá trị trong policy vẫn qua checkpoint ở `start`. §4: skill chỉ đọc và trình quy tắc ở thời điểm tương ứng,
không tự thực thi.

## 8. Kiểm thử

File mới `test/content/16-git-release.pin.mjs`:

| # | Hành vi | Lớp |
|---|---|---|
| 1 | Bảng bump (breaking `!`/footer, feat, fix/perf, none, 0.x breaking) | 1 test tham số hoá, hàm thuần |
| 2 | `--hotfix`: luôn patch, feat/breaking → warnings | hàm thuần |
| 3 | Commit không theo convention → `other` + warning | hàm thuần |
| 4 | Chọn tag semver lớn nhất, bỏ tag sai định dạng | hàm thuần |
| 5 | Hồi quy Gitflow: tag trên merge commit production không phải tổ tiên `develop` → `current` và phạm vi đúng | CLI + repo git tạm (`mkdtemp`, dọn bằng `fs.rmSync`) |
| 6 | Exit `0` / `2` / `1` | CLI, cùng repo tạm |
| 7 | Chỉ import `node:*`, có guard realpath | đọc source |

- `test/install.test.mjs`: manifest cũ chứa `workflows/workflow-release` → `aip update` không lỗi, cảnh báo bỏ qua.
- 1 assert: `ops-deploy-release` checklist có mục migration ↔ deploy và smoke e2e (gate an toàn được chuyển).
- Xoá `test/content/10-release-smoke.pin.mjs` và các assert `workflow-release` trong
  `test/content/06-workflow-fixes.pin.mjs` (pin nội dung của workflow bị gỡ; gate smoke được assert ở trên).
- Không pin văn bản `SKILL.md`; cấu trúc do contract `40-conventions`, `80-frontmatter` kiểm.

Lệnh xác nhận: `npm run build` → `node cli/lib/versions.mjs --lock` → `npm test` → `npm run overlap` →
`claude plugin validate --strict` (nếu có `claude`).

## 9. Rủi ro & giả định

- [Giả định] Người dùng dùng Conventional Commits nhất quán; commit lệch chuẩn chỉ cảnh báo, có thể làm version
  đề xuất thấp hơn thực tế — người dùng sửa ở checkpoint version.
- [Unverified] Cú pháp `uv version <v>` khác nhau giữa các bản uv; skill kiểm `--help` trước khi dùng.
- Gỡ `workflow-release` bỏ việc điều phối quality gate → notes → deploy thành một pipeline; người dùng gọi từng
  skill. Đây là đánh đổi đã chấp nhận (D13).
- Repo không có quyền push tag (branch/tag protection) → push atomic thất bại toàn bộ; skill báo lỗi, không thử lại
  bằng force.
- Business rules ở policy §4 chưa có ngữ nghĩa thi hành; spec sau định nghĩa.
