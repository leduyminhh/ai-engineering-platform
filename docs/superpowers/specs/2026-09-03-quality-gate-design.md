# Thiết kế: Skill `quality-gate` — quét SonarQube + Black Duck, triage, fix, report

- Ngày: 2026-09-03
- Trạng thái: **Đã thực thi** — skill core `quality-gate` (`36ec75d`), merge vào `master` qua PR #23 (`d08de01`, 2026-09-04); sau đó chuyển sang plugin `engineering` thành `engineering-quality-gate` (`7fda25c`).
- Phạm vi: Nội dung — thêm skill dùng chung (core) `quality-gate` dưới `core/skills/`. Không đổi
  engine/adapter/CLI.

## 1. Mục tiêu & tiêu chí thành công

Việc lặp lại "quét chất lượng + bảo mật phụ thuộc rồi sửa" hiện chưa có skill hỗ trợ. Mục tiêu: một
recipe **cross-cutting** chạy hai công cụ — **SonarQube** (bug / vulnerability / code smell / security
hotspot / quality gate) và **Black Duck** (lỗ hổng CVE + license của dependency) — gộp findings, **triage**,
**áp fix cho lỗi rõ ràng** theo code-convention (con người **duyệt diff** trước khi commit), rồi **xuất
report** có residual risk. Skill nằm ở `core/` nên ship kèm mọi provider giống `git-workflow`.

Thành công khi:

1. Có `core/skills/quality-gate/SKILL.md` (recipe mỏng) + `references/` (dày) theo cách khung vận hành.
2. Skill là recipe **on-demand** (`pipeline: false`, `next: null`, `order` sau `git-workflow`), auto-discover
   từ `core/skills/`, project ra **cả 4 provider** (claude, cursor, codex, antigravity), parity `references/`.
3. Frontmatter hợp lệ với validator core: `runsIn: execute`, `invoke: per-request`, có `stageNumber`.
4. `npm test` xanh; `npm run build` ship skill + references ra 4 provider.
5. **Docs-only** — skill là *hướng dẫn agent chạy/đọc công cụ và hành động*, KHÔNG phải scanner/CI code;
   không tự viết runtime của khung.
6. **REALITY FILTER:** report dùng ngôn ngữ **đo được**, luôn nêu **residual risk**; không tuyên bố
   "chặn/đảm bảo/loại bỏ/sửa triệt để" lỗ hổng.

## 2. Phạm vi

- **Trong phạm vi:** hai công cụ SonarQube + Black Duck; **hai chế độ truy cập** (KHÔNG dùng web API):
  (a) **chạy scanner tại chỗ qua CLI** (`sonar-scanner`, Black Duck `detect`) khi có cấu hình + token qua
  biến môi trường; (b) **đọc report/BOM đã xuất** (issues JSON, SARIF, quality-gate status, SPDX/CycloneDX).
  Triage theo severity; **áp fix cho lỗi rõ ràng**; vuln phụ thuộc có bản vá → **bump version** + kiểm
  build/test; xuất report chuẩn.
- **Ngoài phạm vi:** gọi web API của SonarQube/Black Duck; tự cấu hình server/CI pipeline; auto-fix
  **security hotspot** nhạy cảm hay **thay đổi hành vi thiếu test** (đánh dấu để người quyết); tự commit
  (con người duyệt diff trước); bump **major** rủi ro khi thiếu test.

## 3. Kiến trúc đích

```
core/skills/quality-gate/
├── SKILL.md                     # recipe mỏng: nạp context -> thu thập -> triage -> fix -> verify+report
└── references/
    ├── sonarqube.md             # thu thập Sonar (chạy scanner / đọc report) + phân loại + map file:line
    ├── blackduck.md             # thu thập Black Duck (detect / đọc BOM) + triage vuln + bump version
    ├── triage-and-fix.md        # vòng dùng chung: gộp -> phân loại -> quyết fix/propose/defer -> verify
    └── report-template.md       # mẫu report: status + bảng findings + Đã sửa/Hoãn + residual risk
```

Frontmatter: `name: quality-gate`, `pipeline: false`, `next: null`, `order: 3`, `stageNumber: "03"`,
`runsIn: execute`, `invoke: per-request`. `order` đặt SAU `git-workflow` (order 2) để sắp sau khi liệt kê.
Skill sống ở `core/skills/` nên adapter tự chèn pointer `core:principles` và ship kèm core ở mọi provider —
không cần sửa adapter.

## 4. Luồng skill (5 bước)

0. **Nạp context + dò cấu hình (bắt buộc):** đọc CLAUDE.md / project-knowledge (ranh giới an toàn,
   `code-convention.md`); dò `sonar-project.properties`, cấu hình Black Duck, file report có sẵn, và **tên
   biến môi trường** chứa token → chọn chế độ (chạy scanner vs đọc report) theo cái đang có.
1. **Thu thập findings:** chạy `sonar-scanner` và Black Duck `detect` nếu có cấu hình + token; hoặc đọc
   report đã xuất. Gộp findings từ cả hai công cụ. (references/sonarqube.md + references/blackduck.md.)
2. **Triage:** phân loại severity, gom theo file/component, ưu tiên blocker/critical + vulnerability có bản
   vá. (references/triage-and-fix.md.)
3. **Fix (người duyệt diff):** áp fix cho lỗi rõ ràng theo `code-convention.md`; vuln phụ thuộc → bump
   version + kiểm build/test; **KHÔNG** auto-fix breaking-change thiếu test hay security-hotspot nhạy cảm
   (đánh dấu để người quyết).
4. **Verify + report:** chạy lại build/test/lint (rescan nếu nhanh) xác nhận không vỡ; xuất report theo
   references/report-template.md (Đã sửa / Hoãn + lý do / Residual risk). Con người **duyệt diff** trước commit.

## 5. Kiểm thử & verification

- `npm test`: frontmatter contract cho core skill (pipeline=false, next=null, runsIn/invoke hợp lệ, có
  stageNumber), parity `references/` qua 4 adapter, strip workflow-metadata ở output. Phải xanh.
- `npm run build`: `quality-gate/` + `references/` xuất hiện trong output core của **cả 4 provider**
  (claude: `plugins/core/skills/`; codex: `core/skills/`; cursor: `core/.cursor/skills/`; antigravity:
  gộp vào bundle từng plugin `docs/workflow/`).

## 6. Ranh giới / ngoài phạm vi

- **KHÔNG** nhập/log token — token qua biến môi trường, skill chỉ nêu **tên biến** (vd `SONAR_TOKEN`,
  `BLACKDUCK_API_TOKEN`); không chạy lệnh phá huỷ.
- Report dùng ngôn ngữ **đo được**, luôn nêu **residual risk**; không tuyên bố tuyệt đối.
- Breaking-change thiếu test = **không** auto-fix; security-hotspot nhạy cảm = flag cho người; con người
  **duyệt diff** trước khi commit.
- Chỉ thêm nội dung `core`; **không** đụng CLI/adapter/engine.

## 7. Các pha thực thi

1. Viết `SKILL.md`.
2. Viết 4 file `references/`.
3. `npm test` + `npm run build`; xác nhận ship qua 4 provider (find + đếm references mỗi provider).
