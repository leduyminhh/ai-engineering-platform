# Brief: Cổng quét bảo mật go-live
- Ngày: 2026-11-19
- Trạng thái: approved

## Vấn đề và loại việc
Feature nội dung skill. Tổ chức của người dùng có checklist ATTT trước go-live: deploy release đúng digest lên SIT/UAT
có cấu hình tương đương production; quét bằng Gitleaks, BlackDuck, Coverity, SonarQube, ZAP, Trivy (container) và Nessus
(VM); pentest + retest do đơn vị ATTT làm; checklist ASVS Level 2 đã duyệt; kết quả cần đạt là source code và image có
0 secret, 0 Critical/High, 0 RCE, 0 KEV, pentest sửa 100% Critical/High/Medium. Đối chiếu với aip, cổng bảo mật hiện có
(`engineering-quality-gate`, `workflow-security-review`) chỉ phủ SonarQube, BlackDuck, `trivy fs` và review thủ công
theo OWASP/ASVS/CWE, cùng vòng sửa có test regression và re-scan.

Điểm đặc biệt: nhiều tool cần license hoặc server (Coverity, Nessus) hoặc chạm vào môi trường SIT/UAT (ZAP, kiểm digest),
nên agent phải phân biệt việc chạy tại chỗ với việc đọc report đã xuất, và không tự tác động môi trường.

## Vì sao bây giờ và thành công trông thế nào
Người dùng muốn dùng aip cho cổng ATTT go-live, và chọn làm phần quét bảo mật trước. Thành công là:
- Agent có hướng dẫn để chạy Gitleaks và Trivy quét container image tại chỗ, và đọc report Coverity, ZAP, Nessus, pentest
  đã xuất; mọi finding gộp chung danh sách hiện có (nguồn, severity, vị trí, OWASP/ASVS/CWE, secret đã mask).
- Report của `engineering-quality-gate` có mục "Ngưỡng go-live" báo đạt/không đạt từng chỉ tiêu (secret, Critical/High,
  RCE, KEV) kèm số đếm và nguồn; chỉ tiêu không đo được vì thiếu report thì ghi "chưa đo", không ghi đạt.
- `ops-deploy-release` có bước đối chiếu digest image đang chạy ở SIT/UAT với digest đã quét, chỉ đọc.
- Report pentest được nhập làm finding, đi qua vòng sửa có test regression và theo dõi retest tới khi Critical/High/Medium
  được sửa hết.
- ASVS L2 dùng checklist của tổ chức do người dùng cung cấp.

## Goal, non-goal, anti-goal
- Goal: reference mới trong `engineering-quality-gate` cho Gitleaks, Trivy image, Coverity (đọc report), ZAP (đọc
  report), Nessus (đọc report), report pentest (đọc + retest); cập nhật bản đồ tài liệu, triage và report-template.
- Goal: mục "Ngưỡng go-live" trong report: 0 secret, 0 Critical/High, 0 RCE, 0 KEV; chỉ báo đạt/không đạt. Người dùng
  chốt: chỉ loại khỏi số đếm finding đã validate là false positive (kèm lý do); finding được chấp nhận rủi ro hoặc
  suppress trong tool vẫn đếm, có nhãn riêng.
- Goal: bước kiểm digest trong `ops-deploy-release`. Người dùng chốt: SIT/UAT chạy Docker/compose trên VM, nên digest
  đang chạy đọc bằng `docker inspect` (hoặc `docker compose images`) trên máy SIT/UAT, so với digest của image đã quét.
- Goal: đọc report ở định dạng máy đọc (người dùng chốt): Coverity JSON, ZAP JSON/XML, Nessus `.nessus`/CSV; report
  pentest PDF/Word thì agent lập bảng finding để người dùng xác nhận trước khi sửa.
- Goal: dùng checklist ASVS L2 của tổ chức khi người dùng cung cấp đường dẫn.
- Non-goal: template hồ sơ go-live (hồ sơ Golive, biên bản ASVS, biên bản kiểm tra scan code, báo cáo pentest, nghiệm thu
  thiết kế, QC/PQA sign-off, quyết định Golive); để request sau.
- Non-goal: workflow go-live mới nối các bước; để request sau cùng với template hồ sơ.
- Non-goal: đổi luật chấp nhận rủi ro blocker của `workflow-security-review`; ngưỡng lần này không chặn.
- Non-goal: agent tự pentest; NOC/SOC 24/7; aip tự soạn danh sách yêu cầu ASVS L2.
- Anti-goal: in giá trị secret ra report, log hoặc output công cụ.
- Anti-goal: chạy ZAP active scan, quét Nessus, deploy hay lệnh ghi lên SIT/UAT khi chưa có người xác nhận.
- Anti-goal: làm hỏng luồng hiện có của `engineering-quality-gate` (Sonar, BlackDuck, `trivy fs`, review source-first)
  hoặc làm routing của skill này và skill khác tụt hạng.

## Hiện trạng và tham khảo đã thấy
- `plugins/engineering/skills/engineering-quality-gate/SKILL.md` (134 dòng): hai chiều tool gate + review source-first;
  hai chế độ chạy scanner CLI hoặc đọc report, không web API; references `sonarqube.md`, `blackduck.md` (Trivy thay thế
  cho SCA/filesystem), `security-rule-engine.md`, `security-review-areas.md`, `owasp-asvs-cwe-mapping.md` (24 dòng, không
  có cấp ASVS), `triage-and-fix.md`, `report-template.md`.
- `workflows/security-review/WORKFLOW.md`: Bước 3 quét secret và dependency; gate Bước 9 là 0 `blocker` hoặc blocker được
  người dùng chấp nhận rủi ro; Bước 7–9 test regression đỏ → sửa → re-scan.
- `plugins/ops/skills/ops-deploy-release/SKILL.md` (105 dòng): không tự chạy lệnh lên môi trường, chỉ đề xuất và chờ xác
  nhận; grep không thấy "digest".
- Grep `plugins/`, `workflows/`, `core/` không thấy Gitleaks, Coverity, ZAP, Nessus, pentest, KEV, golive.
- Tham khảo: ảnh checklist ATTT của tổ chức người dùng gửi trong phiên (không lưu trong repo).
- Chưa xem: nội dung chi tiết từng file references của quality-gate, `ops-deploy-release/references/`, eval hiện có của
  `engineering-quality-gate`, mức routing hiện tại của skill (`test/routing/rank1.lock.json`).
- Câu mở về tình huống thật (dự án, ai dùng, "SG0") chưa có câu trả lời.

## Hướng đã cân nhắc
- **A. Mở rộng skill có sẵn (người dùng chọn):** reference tool + ngưỡng trong `engineering-quality-gate`, kiểm digest
  trong `ops-deploy-release`. Ít file mới, mỗi phần nằm đúng capability; đổi lại skill quality-gate phình, description
  phải giữ ≤ 1024 ký tự.
- B. Workflow mới `workflow-golive-security` nối quét → digest → DAST/pentest/Nessus → ngưỡng → sửa/retest (loại lần
  này): đúng định nghĩa workflow nhiều capability nhưng nặng (graph, registry, orchestrator, eval) trong khi người dùng
  muốn có phần quét trước; hợp làm ở request sau cùng template hồ sơ go-live.
- C. Chỉ reference tool + ngưỡng, bỏ kiểm digest (loại): nhỏ nhất nhưng bỏ phần người dùng đã chọn.

## Quyết định của agent
- Gitleaks và Trivy image chạy tại chỗ (tool mã nguồn mở, chạy trên repo hoặc image local); Coverity, ZAP, Nessus đọc
  report đã xuất (cần license, server hoặc chạm môi trường). Người dùng xác nhận ở playback.
- Kiểm digest chỉ đọc; lệnh đọc cluster/registry vẫn theo ranh giới của `ops-deploy-release` (nêu lệnh, chờ xác nhận khi
  chạm môi trường). Người dùng xác nhận ở playback.
- Slug `golive-security-scan`; `phạm-vi: không-code` vì sản phẩm là nội dung skill (markdown), như các brief nội dung skill
  trước. Nếu design chọn thêm script đếm ngưỡng thì vẫn là script đi kèm skill như `engineering-codebase-onboarding`.
- Vòng sửa và retest pentest dùng lại Bước 7–9 của `workflow-security-review`; workflow chỉ thêm "report pentest" vào
  đầu vào tuỳ chọn và một dòng đối chiếu retest, không thêm bước mới.
- Pentest sửa 100% Critical/High/Medium là chỉ tiêu theo dõi ở vòng retest, không nằm trong bốn chỉ tiêu ngưỡng.
- Severity chuẩn hoá về một trục chung như `references/triage-and-fix.md` đang làm; finding trùng giữa các tool (cùng CVE
  hoặc cùng `file:line` + CWE) gộp một dòng, ghi đủ nguồn.
- "Không áp dụng" chỉ khi có bằng chứng bề mặt đó không tồn tại (vd repo không có Dockerfile/image); thiếu report là
  "chưa đo". Cả hai đều không tính là đạt.
- "0 secret": Gitleaks quét working tree và lịch sử git (`--redact`), Trivy `--scanners secret` cho image; report chỉ nêu
  tên luật + `file:line`/layer, không giá trị.
- KEV đối chiếu với file danh mục CISA KEV (JSON) do người dùng tải và đưa đường dẫn; không có file thì KEV "chưa đo".
  Danh sách CWE tính là RCE để design chốt.
- Checklist ASVS L2: người dùng đưa file; xlsx thì nhờ xuất sang csv hoặc md (repo zero-dep); không có file thì ASVS ghi
  "chưa đo", agent không tự soạn yêu cầu.
- Được sửa `description` của `engineering-quality-gate` và `ops-deploy-release` để thêm trigger, giữ ≤ 1024 ký tự và mục
  "Không dùng khi → id"; ngưỡng routing (`test/routing/rank1.lock.json`) phải giữ trong `npm test`.

## Phần đoán
- [giả định] Ngưỡng chỉ báo đạt/không đạt, không chặn hoàn thành, dựa trên câu trả lời "trước tiên triển khai việc quét
  security"; luật chặn thật và ngoại lệ có biên bản để request sau.
- [giả định] Tổ chức đã có file checklist ASVS L2 đã duyệt; định dạng file (xlsx, md, csv) chưa biết.
- [giả định] "RCE" đếm theo CWE (vd CWE-94, CWE-78, CWE-502) hoặc nhãn của tool; danh sách CWE cụ thể để design chốt.
- [giả định] Có thể cần một script zero-dep đếm ngưỡng từ report JSON/SARIF/XML; design quyết có hay không.
- [giả định] Digest đã quét lấy từ `RepoDigests` của image (Trivy hoặc `docker inspect` ở máy build); lệnh trên máy
  SIT/UAT do người dùng chạy hoặc agent chạy sau khi xác nhận.
- [giả định] Stack ứng dụng và CI chưa biết (câu mở chưa có trả lời); reference viết ví dụ trung tính về ngôn ngữ.

## Định tuyến
loại-việc: feature
phạm-vi: không-code
đầu-ra-mong-đợi: engineering-quality-gate có reference cho Gitleaks, Trivy image, Coverity, ZAP, Nessus, report pentest và mục ngưỡng go-live trong report; ops-deploy-release có bước kiểm digest Docker trên VM SIT/UAT; workflow-security-review nhận report pentest cho vòng retest
rủi-ro: in lộ secret khi chạy Gitleaks; agent chạy quét hoặc lệnh lên SIT/UAT khi chưa xác nhận; skill quality-gate phình làm routing tụt hạng; ngưỡng báo đạt khi thiếu report
ứng-viên-route: []
route-đã-duyệt: chưa-có-quy-trình
