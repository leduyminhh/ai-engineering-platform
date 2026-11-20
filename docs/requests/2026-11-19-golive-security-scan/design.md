# Thiết kế: cổng quét bảo mật go-live (mở rộng `engineering-quality-gate`, `ops-deploy-release`, `workflow-security-review`)
- Ngày: 2026-11-19
- Trạng thái: merged e3151217; brief đã duyệt ở `brief.md` cùng thư mục
- Requirement: không có (AC nằm trong file này, như `docs/requests/2026-11-13-codebase-onboarding-skill/design.md`)

## Vấn đề và lý do
Checklist ATTT trước go-live của tổ chức cần đọc kết quả từ Gitleaks, BlackDuck, Coverity, SonarQube, ZAP, Trivy (image)
và Nessus (VM); đối chiếu digest image đang chạy trên SIT/UAT với image đã quét; nhập report pentest; đối chiếu ASVS
Level 2. aip hiện có SonarQube, Black Duck, `trivy fs` và review source-first trong `engineering-quality-gate`; chưa có cách
đếm ngưỡng go-live từ các report, chưa có Gitleaks, Coverity, ZAP, Nessus, pentest, KEV, ASVS L2, và `ops-deploy-release`
chưa có bước digest (grep `plugins/` không thấy "digest").

Thiếu hai thứ: (1) cách đếm bốn chỉ tiêu ngưỡng theo cùng một quy tắc, tất định, kiểm được bằng test; (2) cách đọc
report đã xuất mà không chạm môi trường. Nếu đếm tay trong report, kết quả khó tái lập và dễ ghi "đạt" khi thiếu
report, đúng lỗi mà brief cấm.

## Quyết định đã chốt (người dùng)
Nguồn: `brief.md` (trạng thái approved, 2026-11-19) và ba chốt bổ sung sau builder check.
- Hướng A: mở rộng skill có sẵn, không workflow mới. Hướng B (`workflow-golive-security`) để request sau cùng template
  hồ sơ go-live. Hướng C (chỉ tool + ngưỡng, bỏ digest) bị loại.
- Gitleaks và Trivy (image) chạy tại chỗ. Coverity, ZAP, Nessus chỉ đọc report đã xuất. Định dạng máy đọc: Coverity
  JSON, ZAP JSON/XML, Nessus `.nessus`/CSV.
- Pentest: đơn vị ATTT làm. aip đọc report (PDF/Word), agent lập bảng finding để người dùng xác nhận trước khi sửa, vòng
  sửa có test regression (dùng lại Bước 7–9 của `workflow-security-review`), theo dõi retest tới 100% Critical/High/Medium
  (chỉ tiêu theo dõi, không thuộc bốn chỉ tiêu ngưỡng).
- Bốn chỉ tiêu ngưỡng go-live: 0 secret, 0 Critical/High, 0 RCE, 0 KEV. Lần này chỉ báo đạt/không đạt, không chặn, không
  đổi luật chấp nhận rủi ro của `workflow-security-review`.
- Chỉ loại khỏi số đếm finding đã validate là false positive, kèm lý do. Finding được chấp nhận rủi ro hoặc suppress trong
  tool vẫn đếm, có nhãn riêng.
- Thiếu report → "chưa đo". "Không áp dụng" chỉ khi có bằng chứng bề mặt không tồn tại. Cả hai đều không tính là đạt.
- Đếm ngưỡng bằng một script Node zero-dep đi kèm `engineering-quality-gate`, in số đếm tất định; có test.
- Kiểm digest trong `ops-deploy-release` chỉ đọc: SIT/UAT chạy Docker/compose trên VM; digest đang chạy đọc bằng
  `docker inspect` (hoặc `docker compose images`) trên máy SIT/UAT, so với digest của image đã quét. Agent chạy lệnh đọc
  chỉ sau khi người dùng xác nhận, hoặc người dùng dán output.
- ASVS L2 dùng checklist của tổ chức (csv hoặc md; xlsx thì người dùng xuất). Agent điền trạng thái từng mục (đạt / không
  đạt / chưa kiểm) kèm evidence `file:line` thành một mục trong report. Không sinh biên bản. Không có file → ASVS "chưa
  đo". Agent không tự soạn yêu cầu ASVS.
- Non-goal: template hồ sơ go-live (hồ sơ Golive, biên bản ASVS, biên bản kiểm tra scan code, báo cáo pentest, nghiệm thu
  thiết kế, QC/PQA sign-off, quyết định Golive), workflow go-live, agent tự pentest, NOC/SOC 24/7, luật ngưỡng chặn thật.
- (Mới) BlackDuck và SonarQube là nguồn BẮT BUỘC của ngưỡng. Script đọc BlackDuck JSON report → Critical/High, KEV (và RCE
  khi có CWE); Sonar issues JSON, chỉ issue loại vulnerability → Critical/High, RCE. Luồng quality gate Sonar và triage
  BlackDuck hiện có không đổi; chỉ thêm việc đếm.
- (Mới) CVE được đếm theo tài sản: khoá finding = CVE + tài sản (image digest/tên image, host, component@version). Gộp
  trùng giữa tool chỉ khi cùng tài sản. Trivy image và Nessus host là hai tài sản khác nhau, không gộp.
- (Mới) Report mẫu: làm theo tài liệu tool trước. Có một AC nghiệm thu cuối trước merge (AC6.1): người dùng đưa report
  thật đã che của từng tool; script exit 0 và số đếm khớp đối chiếu tay; lệch thì sửa parser và fixture. Nếu người dùng
  chưa đưa được trước khi kết thúc nhánh thì ghi residual risk, không chặn.

## Quyết định của agent
Mỗi dòng là quyết định của agent, kèm lý do. Người duyệt có thể đổi từng dòng.

1. Script đếm nằm trong `scripts/` của skill `engineering-quality-gate`, không cài tool, không mở kết nối mạng. Lý do:
   brief ghi phạm vi không-code, nhưng đếm bằng tay không tất định và không test được; mô hình này khớp
   `engineering-codebase-onboarding`.
2. Gitleaks quét working tree và lịch sử git với `--redact`. Script không đọc các trường chứa giá trị (`Secret`, `Match`
   của Gitleaks; `Match` của Trivy secret). Report chỉ nêu tên luật, `file:line` hoặc layer. Lý do: anti-goal in secret.
3. Secret trong lịch sử git vẫn đếm dù đã xoá khỏi code. Lý do: nhất quán với Bước 6 của `workflow-security-review` (coi
   secret đã lộ cho tới khi rotate). [giả định]
4. Finding secret (Gitleaks, Trivy secret) chỉ đếm vào chỉ tiêu secret, không đếm vào Critical/High. Lý do: tránh đếm đôi
   một lỗi làm hai chỉ tiêu cùng đỏ. [giả định] Người duyệt có thể đổi.
5. RCE = finding có CWE thuộc {77, 78, 94, 95, 502, 917, 1336} hoặc nhãn tool chứa "remote code execution" (không phân biệt
   hoa thường). Đếm bất kể severity. Danh sách là hằng trong script. Lý do: CWE bám `owasp-asvs-cwe-mapping.md` (77/78/94/95
   là injection thực thi lệnh hoặc mã; 502 deserialize; 917 expression language; 1336 template injection). RCE là mức ảnh
   hưởng, không phụ thuộc severity.
6. KEV khớp CVE của finding với `vulnerabilities[].cveID` trong file người dùng tải. Script không gọi mạng. Nếu file KEV có
   `dateReleased` cũ hơn 7 ngày so với ngày chạy, hoặc không có ngày, script ghi `warnings`; trạng thái KEV không đổi.
   Lý do: anti-goal chạm ra ngoài và giữ kết quả tất định.
7. Mỗi chỉ tiêu có tập nguồn bắt buộc (bảng dưới). Quy tắc trạng thái theo thứ tự: (a) có finding đếm được → `không đạt`,
   kể cả khi thiếu nguồn, vì một finding đã đủ kết luận; (b) không finding và còn nguồn bắt buộc thiếu, chưa có `--na` →
   `chưa đo`; (c) mọi nguồn bắt buộc đều `--na` → `không áp dụng`; (d) còn lại → `đạt`.
8. Trạng thái tổng thể (overall) tính theo bốn chỉ tiêu: có chỉ tiêu `không đạt` → `không đạt`; cả bốn đều `đạt` → `đạt`;
   còn lại (có `chưa đo` hoặc `không áp dụng`, không có `không đạt`) → `chưa đo`. Lý do: `không áp dụng` không được tính
   là đạt, nên tổng thể không được là `đạt`; nhưng một finding đã đủ kết luận `không đạt`. AC1.15 kiểm bảng này.
9. Khoá gộp, mỗi dòng giữ đủ nguồn. Gộp chỉ khi cùng tài sản:
   - CVE: khoá = CVE + tài sản. Tài sản là image (digest, hoặc tên image khi không có digest) cho Trivy; host cho Nessus;
     `component@version` cho BlackDuck. Cùng CVE khác tài sản thì không gộp, mỗi tài sản một finding.
   - Mã nguồn (Coverity, SARIF, Sonar): cùng `file:line` và cùng CWE; nếu không có CWE thì chỉ cần cùng `file:line`.
   - Secret: cùng luật và cùng `file:line` (hoặc layer với Trivy).
   - ZAP: vị trí là URL, chỉ gộp với ZAP khác cùng alert và cùng URL; không gộp với nguồn có `file:line`.
   - Hệ quả (người dùng chốt ở checkpoint design 2026-11-19): cùng một CVE trong image Trivy và trong `component@version`
     của BlackDuck được đếm hai lần, vì là hai tài sản (image và mã nguồn).
10. Severity chuẩn hoá về Critical / High / Medium / Low / Info (bảng dưới). Giá trị lạ không có trong bảng → exit 2,
    không đoán. Lý do: fail-loud.
11. Exit 0 khi đọc được input, kể cả khi có Critical. Exit 2 khi thiếu đối số, file không đọc được, JSON hỏng, thiếu trường
    bắt buộc, giá trị lạ, FP hoặc accepted thiếu `reason`. Lý do: brief chỉ báo đạt/không đạt, không chặn. Rủi ro đi kèm
    được ghi ở phần Rủi ro.
12. Khi JSON hỏng, script không in message gốc của `JSON.parse` mà in thông báo tự viết kèm tên file. Lý do: [Inference]
    message gốc của Node có thể chứa đoạn input, và input có thể chứa secret. AC1.12 kiểm điều này.
13. Nessus `.nessus` XML và ZAP XML: agent đọc theo reference, script không parse XML. Lý do: zero-dep và repo không có
    parser XML. Đánh đổi: report XML lớn tốn token và dễ sai sót khi đọc tay (xem Rủi ro).
14. Nessus CSV: ô `CVE` có nhiều CVE thì tách, mỗi CVE một finding khoá `CVE@host`. Dòng không có CVE là finding khoá
    `plugin@host` (không vào KEV, vẫn vào Critical/High theo `Risk`). Lý do: khớp khoá theo tài sản ở quyết định 9.
15. BlackDuck: script nhận định dạng CycloneDX JSON (`vulnerabilities[]` với `id`, `ratings[].severity`, `affects[].ref`).
    Định dạng JSON gốc của Black Duck [Unverified] chưa kiểm; nếu không khớp cấu trúc đã định nghĩa thì exit 2. Lý do:
    CycloneDX là định dạng chuẩn `blackduck.md` đã nêu; tránh đoán tên trường của tool.
16. Sonar issues JSON: chỉ issue có `type` = `VULNERABILITY` vào Critical/High và RCE. `BUG`, `CODE_SMELL` không vào chỉ tiêu.
    Mức độ lấy theo `severity` và, nếu có, `impacts[]` với `softwareQuality` = `SECURITY`; lấy mức cao hơn của hai. Lý do:
    user chốt; tên trường [Unverified]. Security hotspot không nằm trong issues JSON, không đếm, ghi vào Rủi ro.
17. Nhãn `suppress` chỉ lấy từ dữ liệu có trong chính report: SARIF `suppressions[]`, trạng thái triage/dismiss của
    Coverity, `resolution` của Sonar (tên trường [Unverified]). Resolution "false positive" của tool vẫn chỉ là nhãn
    `suppress`; chỉ `--fp` có `reason` mới loại khỏi số đếm.
18. Finding bị file ignore ẩn khỏi report (`.trivyignore`, `.gitleaksignore`, VEX, cấu hình ignore của Sonar/Coverity/ZAP
    context) thì script không thấy. Reference bắt agent liệt kê các file ignore có trong repo và số mục của chúng vào
    report, dòng "suppress ngoài report", kèm residual risk. Lý do: không thể đếm thứ không có trong report.
19. Khoá `--fp` và `--accepted`: JSON mảng `{ "source", "key", "reason" }`. `key` đúng khoá finding script in ra ở mỗi
    finding: secret `rule@file:line`; mã nguồn `file:line` (kèm `+CWE` nếu có); CVE `CVE@tài sản`; ZAP `alert@URL`; Nessus
    không CVE `plugin@host`. `source` là tên nguồn trong `sources` của finding. Khoá không khớp → `warnings`, số đếm không
    đổi. `--accepted` cũng bắt buộc `reason` (fail-loud); finding chấp nhận rủi ro vẫn đếm có nhãn `chấp nhận rủi ro`.
20. Digest đã quét lấy từ `Metadata.RepoDigests` trong output Trivy, hoặc `docker image inspect` trên máy build. So digest
    manifest hai phía. Image không có RepoDigest (build local chưa push) thì so image ID và ghi rõ "so theo image ID".
21. Digest lệch → mục digest `không đạt` và đề xuất NO-GO. Không lấy được digest → mục `chưa đo`, coi là chưa đạt, đề
    xuất NO-GO theo quy tắc sẵn có của bước 1 `ops-deploy-release` (mục chặn chưa đạt → NO-GO). Lý do: nhất quán.
22. Không cài tool vào project. Tool thiếu → nêu rõ (fail-loud), đề nghị người dùng cài hoặc đưa report có sẵn.
23. `workflow-security-review` chỉ thêm report pentest/Coverity/ZAP/Nessus vào đầu vào tuỳ chọn và một dòng đối chiếu
    retest pentest ở Bước 9. Không thêm bước, `graph.json` không đổi. Lý do: brief yêu cầu dùng lại Bước 7–9.
24. Không tạo ADR. Lý do: mở rộng nội dung skill và script đi kèm, không phải quyết định kiến trúc; hướng A đã do người
    dùng chọn và được ghi ở mục Quyết định đã chốt.
25. Không thêm eval chạy model thật. Không sửa `test/routing/rank1.lock.json` để hạ ngưỡng; chỉ thêm câu vào corpus routing.
26. Trần description: 500 ký tự theo repo (không còn là câu hỏi mở; brief ghi 1024 nhưng trần thực thi của repo là 500).
27. `skill-quality` không khai trong `## Ảnh hưởng spec`. Lý do: `skill-quality/R1` không đổi, chỉ thêm câu dữ liệu routing.
28. Version: `engineering` 2.16.2 → 2.17.0, `ops` 2.1.1 → 2.2.0, `workflows` 3.17.4 → 3.17.5 (không thêm skill mới nên
    `description` của manifest `engineering` vẫn liệt kê 15 skill).
29. Năng lực mới `security-gate` được khai ở `## Ảnh hưởng spec`, `spec.md` tạo ở bước gộp. Lý do: quy tắc khai năng lực
    chưa có spec.
30. Giả định "đủ nguồn bắt buộc cho mọi đợt": cơ sở là ảnh checklist ATTT liệt kê Gitleaks, BlackDuck, Coverity, SonarQube,
    ZAP, Trivy (container), Nessus (VM). [giả định] Việc mọi đợt đều bắt buộc đủ năm nguồn chưa được xác nhận.

Nguồn bắt buộc theo chỉ tiêu (trừ khi có `--na`):

| Chỉ tiêu | Nguồn bắt buộc | Nguồn cộng thêm nếu có |
|---|---|---|
| secret | Gitleaks working tree, Gitleaks lịch sử git, Trivy image | — |
| Critical/High | Coverity, Trivy image, ZAP, Nessus, BlackDuck, Sonar | SARIF |
| RCE | Coverity, Trivy image, ZAP, Nessus, BlackDuck, Sonar | SARIF |
| KEV | file KEV, Trivy image, Nessus, BlackDuck | Coverity, ZAP, Sonar, SARIF (khi có CVE) |

Chuẩn hoá severity:

| Nguồn | Trường đọc | Ánh xạ |
|---|---|---|
| Trivy JSON | `Severity` | CRITICAL → Critical, HIGH → High, MEDIUM → Medium, LOW → Low, UNKNOWN → Info |
| Nessus CSV | `Risk` | Critical, High, Medium, Low, None → Info |
| ZAP JSON | `riskcode` | 3 → High, 2 → Medium, 1 → Low, 0 → Info |
| BlackDuck (CycloneDX) | `ratings[].severity` | [Unverified] critical → Critical, high → High, medium → Medium, low → Low, none/unknown → Info |
| Sonar issues JSON | `severity`, và `impacts[]` có `softwareQuality` = `SECURITY` | [Unverified] `severity`: BLOCKER → Critical, CRITICAL → High, MAJOR → Medium, MINOR → Low, INFO → Info; `impacts[].severity`: HIGH → High, MEDIUM → Medium, LOW → Low; lấy mức cao hơn |
| SARIF | `properties.security-severity` (số) | ≥ 9 Critical, ≥ 7 High, ≥ 4 Medium, > 0 Low; thiếu thì `level`: error → High, warning → Medium, note → Low, none → Info |
| Coverity JSON | trường mức độ [Unverified] | ánh xạ theo reference; không xác định được → exit 2 |
| Gitleaks JSON | không có mức độ | mọi finding là secret, không vào Critical/High |

## Tiêu chí chấp nhận
Nhóm theo: (1) script đếm ngưỡng; (2) nội dung skill `engineering-quality-gate`; (3) kiểm digest `ops-deploy-release`;
(4) `workflow-security-review`; (5) routing, description, build; (6) nghiệm thu với report thật.

- [ ] **AC1.1** — Given fixture Gitleaks working tree có 2 finding, Gitleaks lịch sử git có 1 finding và Trivy image có 1 finding secret, When chạy script Then chỉ tiêu secret `count` = 4 và `status` = `không đạt`, `calc: 2 + 1 + 1 = 4`.
- [ ] **AC1.2** — Given Trivy image có 1 vuln Critical, 1 vuln High, 2 vuln Medium và 1 vuln Low, When chạy script Then chỉ tiêu Critical/High `count` = 2 và Medium, Low không vào chỉ tiêu, `calc: 1 + 1 = 2`.
- [ ] **AC1.3** — Given bảng fixture (ZAP `riskcode` 3/2/1/0, Nessus `Risk` Critical/High/Medium/Low/None, Trivy `Severity` UNKNOWN, SARIF `security-severity` 9.0/7.0/4.0/0.1 không có `level`) When chạy script Then mỗi dòng được chuẩn hoá đúng về Critical/High/Medium/Low/Info theo bảng ở Thiết kế.
- [ ] **AC1.4** — Given không có cờ `--coverity` và các nguồn khác đọc được không có finding Critical/High When chạy script Then Critical/High và RCE `status` = `chưa đo` (không `đạt`) và exit 0.
- [ ] **AC1.5** — Given đủ mọi nguồn bắt buộc của một chỉ tiêu và không finding nào đếm được When chạy script Then chỉ tiêu `status` = `đạt`; Given cùng dữ liệu nhưng thêm một finding Critical và thiếu Coverity When chạy Then `status` = `không đạt` (kết luận không cần đủ nguồn).
- [ ] **AC1.6** — Given `--na nessus=<bằng chứng>` và mọi nguồn bắt buộc khác của KEV đã cung cấp When chạy script Then KEV không đếm Nessus và `status` theo các nguồn còn lại; Given `--na` không kèm bằng chứng When chạy Then exit 2; Given mọi nguồn bắt buộc của một chỉ tiêu (ví dụ Critical/High: Coverity, Trivy, ZAP, Nessus, BlackDuck, Sonar) đều `--na` When chạy Then `status` là `không áp dụng` (không `đạt`); Given `--na kev=<bằng chứng>` When chạy Then exit 2 (file KEV là danh mục để so, không phải một bề mặt hệ thống nên không thể không áp dụng); Given mỗi `--na` hợp lệ When chạy Then `warnings` có đúng một dòng 'N/A tự khai, cần người xác nhận' cho nguồn đó. [Đổi theo quyết định người dùng ở bước duyệt cuối nhánh, 2026-11-19.]
- [ ] **AC1.7** — Given fixture có 2 finding Critical (`A` và `B`) và file FP có một mục `{source, key, reason}` khớp `A` theo khoá code `file:line` When chạy script Then `A` không vào Critical/High, output liệt kê 1 FP đã loại kèm `reason`, `calc: 2 - 1 = 1`; Given cùng FP nhưng thiếu `reason` When chạy Then exit 2; Given FP có `key` không khớp finding nào When chạy Then `warnings` có một dòng và số đếm không đổi.
- [ ] **AC1.8** — Given fixture có 2 finding High (`C` và `D`), file accepted khớp `C` có `reason`, và `D` có resolution suppress trong Sonar issues JSON When chạy script Then cả `C` và `D` vẫn trong Critical/High với nhãn `chấp nhận rủi ro` (C) và `suppress` (D), `calc: 1 + 1 = 2`, `status` không `đạt`; Given file accepted thiếu `reason` When chạy Then exit 2.
- [ ] **AC1.9** — Given file KEV có `CVE-A`, Trivy image có finding `CVE-A` và `CVE-B` When chạy script Then KEV `count` = 1, `calc: 1 = 1`; Given không có file KEV When chạy Then KEV `status` = `chưa đo`; source của script không import mô-đun mạng (`node:http`, `node:https`, `node:net`, `node:dns`, `fetch`).
- [ ] **AC1.10** — Given finding CWE-78, CWE-502, CWE-79, và một finding CWE-200 có nhãn "Remote Code Execution" When chạy script Then RCE `count` = 3, `calc: 1 + 1 + 1 = 3`, và finding CWE-79 không vào RCE (kể cả khi severity Critical).
- [ ] **AC1.11** — Given Trivy có `CVE-X` trên image `I`, Nessus có `CVE-X` trên host `H`, Coverity và SARIF cùng `file:line` và cùng CWE-89, ZAP có một alert không có `file:line` When chạy script Then Trivy và Nessus là hai finding riêng (khác tài sản), Coverity và SARIF gộp thành một, ZAP không gộp với Coverity/SARIF, và tổng là 4 finding, `calc: 5 - 1 = 4`.
- [ ] **AC1.12** — Given fixture Gitleaks có trường `Secret` và Trivy có trường `Match` chứa chuỗi giả lập ghép từ nhiều mảnh (sentinel), và một file JSON hỏng có chứa sentinel When chạy script Then stdout và stderr không chứa sentinel; output chỉ có tên luật, `file:line`, layer.
- [ ] **AC1.13** — Given thiếu đối số, đường dẫn không tồn tại, JSON hỏng, trường bắt buộc thiếu, hoặc giá trị severity lạ When chạy script Then exit khác 0 (2), stdout không có `đạt` hay `không đạt`; Given mọi file đọc được và có Critical When chạy Then exit 0.
- [ ] **AC1.14** — Given Nessus có `CVE-Y` (Critical) trên ba host `H1`, `H2`, `H3` và Trivy có `CVE-Y` (Critical) trên image `I` When chạy script Then Critical/High `count` = 4 (mỗi tài sản một finding), `calc: 3 + 1 = 4`.
- [ ] **AC1.15** — Given bảng tham số hoá bốn trạng thái của chỉ tiêu (ví dụ: `[không đạt, đạt, đạt, đạt]` → `không đạt`; `[đạt, đạt, đạt, đạt]` → `đạt`; `[đạt, đạt, đạt, không áp dụng]` → `chưa đo`; `[đạt, chưa đo, đạt, đạt]` → `chưa đo`) When tính overall Then kết quả đúng từng dòng bảng.
- [ ] **AC1.16** — Given BlackDuck CycloneDX có một vuln `ratings` critical trên `component@version` `P@1.0` và một vuln low trên `Q@2.0` When chạy script Then BlackDuck đóng góp đúng một finding Critical/High, khoá CVE theo `CVE@P@1.0`, `calc: 1 + 0 = 1`; JSON không khớp cấu trúc CycloneDX (thiếu `vulnerabilities`) → exit 2.
- [ ] **AC1.17** — Given Sonar issues JSON có một issue `VULNERABILITY` `BLOCKER`, một `BUG` `CRITICAL` và một `CODE_SMELL` `MAJOR` When chạy script Then Critical/High đếm đúng một issue (`calc: 1 + 0 + 0 = 1`), và `RCE` chỉ đếm issue vulnerability có CWE trong danh sách.
- [ ] **AC1.18** — Given file KEV có `dateReleased` cũ hơn 7 ngày so với ngày chạy When chạy script Then `warnings` có một dòng về tuổi file KEV và KEV `status` = `chưa đo` khi không có finding KEV đếm được; Given file KEV không có ngày When chạy Then `warnings` có một dòng báo thiếu ngày và KEV `status` = `chưa đo`; Given file KEV có `vulnerabilities` rỗng When chạy Then `warnings` có một dòng và KEV `status` = `chưa đo`; Given file KEV cũ nhưng có finding khớp When chạy Then KEV vẫn `không đạt` (một finding đã đủ kết luận). [Đổi theo quyết định người dùng ở bước duyệt cuối nhánh, 2026-11-19: trước đây status không đổi.]
- [ ] **AC1.19** — Given Nessus có một dòng `CVE` = `CVE-A, CVE-B` trên host `H` When chạy script Then sinh hai finding khoá `CVE-A@H` và `CVE-B@H`, `calc: 2 = 2`; Given dòng không có CVE When chạy Then finding khoá `plugin@H`.

- [ ] **AC1.20** — Given Sonar issues JSON có `type` = `vulnerability` (chữ thường) hoặc `softwareQuality` = `security` When chạy script Then được chuẩn hoá như chữ hoa và issue vào chỉ tiêu; Given `type` ngoài {BUG, CODE_SMELL, VULNERABILITY, SECURITY_HOTSPOT} When chạy Then exit 2; Given `paging.total` (hoặc `total`) lớn hơn số phần tử `issues` When chạy Then exit 2 (report chưa đủ trang), `calc: 5 - 2 = 3` issue chưa có trong report.
- [ ] **AC1.21** — Given `--trivy` When chạy script Then `warnings` luôn có một dòng nói không xác minh được `--scanners secret` của report.

- [ ] **AC2.1** — Given `SKILL.md` của `engineering-quality-gate` When kiểm cấu trúc Then mọi file trong `references/` được liên kết trong mục "Bản đồ tài liệu" và mọi liên kết tương đối trong `SKILL.md` và `references/` trỏ tới file có thật.
- [ ] **AC2.2** — Given `references/` mới và hai reference hiện có `sonarqube.md`, `blackduck.md` When đọc Then có tài liệu cho Gitleaks, Trivy image, Coverity, ZAP, Nessus, report pentest và ASVS L2 (tên file theo Để builder quyết); `sonarqube.md` và `blackduck.md` có mục đọc JSON cho việc đếm ngưỡng; mỗi tài liệu nêu cách chạy hoặc cách đọc report, định dạng đọc được, và đánh dấu `[Unverified]` cho tên trường chưa kiểm chứng.
- [ ] **AC2.3** — Given `report-template.md` When kiểm cấu trúc Then có mục "Ngưỡng go-live" với đúng bốn chỉ tiêu (secret, Critical/High, RCE, KEV), bốn trạng thái (`đạt`, `không đạt`, `chưa đo`, `không áp dụng`), trạng thái tổng thể, cột nguồn và số đếm; có mục ASVS L2, mục pentest/retest và dòng "suppress ngoài report".
- [ ] **AC2.4** — Given `triage-and-fix.md` When đọc diff Then có quy tắc: FP chỉ loại khi có lý do; chấp nhận rủi ro và suppress vẫn đếm có nhãn; finding pentest đi qua người xác nhận trước khi sửa. (Kiểm ở review diff.)
- [ ] **AC2.5** — Given `SKILL.md` và `references/` When đọc Ranh giới an toàn Then ghi rõ: không chạy ZAP active scan, không quét Nessus, không lệnh ghi lên SIT/UAT, không cài tool vào project, không đọc giá trị secret; thiếu checklist ASVS → ASVS `chưa đo`, agent không soạn yêu cầu. (Kiểm ở review diff.)
- [ ] **AC2.7** — Given `SKILL.md`, `trivy-image.md` và `digest-check.md` When đọc diff Then nêu đợt có nhiều image: chạy script cho từng image, trạng thái chung lấy mức xấu nhất, image thiếu report là `chưa đo`; `report-template.md` có quy tắc lập report cho đợt nhiều image. (Kiểm ở review diff.)
- [ ] **AC2.6** — Given repo có file ignore (`.trivyignore`, `.gitleaksignore` hoặc tương đương) When agent lập report Then report liệt kê từng file ignore có trong repo kèm số mục, dòng "suppress ngoài report" và residual risk. (Kiểm ở review diff.)

- [ ] **AC3.1** — Given `ops-deploy-release/SKILL.md` và `references/` When kiểm cấu trúc Then có bước đối chiếu digest với lệnh đọc `docker inspect` và `docker image inspect`, và ghi rõ đây là lệnh chỉ đọc chạy sau khi người dùng xác nhận hoặc khi người dùng dán output.
- [ ] **AC3.2** — Given digest image đang chạy khớp digest đã quét với mọi image của service When đối chiếu Then mục digest `đạt`; Given ít nhất một image lệch When đối chiếu Then mục `không đạt` và checklist đề xuất NO-GO; Given không lấy được digest When đối chiếu Then mục `chưa đo`, coi là chưa đạt, đề xuất NO-GO.
- [ ] **AC3.3** — Given report Trivy không có RepoDigest (thiếu hoặc rỗng) When đối chiếu Then định danh đã quét lấy từ chính report (`Metadata.ImageID` [Unverified]) và so theo image ID với image ID của container đang chạy, report ghi rõ "so theo image ID"; Given report không có định danh nào dùng được When đối chiếu Then mục digest `chưa đo` và đề xuất NO-GO, không lấy image ID từ máy build thay cho report. (Kiểm ở review diff.) [Đổi theo quyết định người dùng ở bước duyệt cuối nhánh, 2026-11-19: trước đây cho lấy image ID từ máy build.]

- [ ] **AC4.1** — Given `workflows/security-review/WORKFLOW.md` When kiểm nội dung Then mục "Đầu vào tuỳ chọn" nêu report pentest, Coverity, ZAP, Nessus; Bước 9 có đúng một dòng đối chiếu retest pentest (Critical/High/Medium) và không đổi gate của Bước 9.
- [ ] **AC4.2** — Given `workflows/security-review/graph.json` When so với `master` Then không có thay đổi (`git diff master -- workflows/security-review/graph.json` rỗng), số bước `calc: 10 = 10`.
- [ ] **AC4.3** — Given `WORKFLOW.md` sau thay đổi When chạy `node test/validate.mjs --only workflows` Then exit 0 (đối chiếu graph với body hai chiều), và số mục `### Bước` vẫn là 10 (Bước 1–10, Bước 10 là Commit), `calc: 10 = 10`.

- [ ] **AC5.1** — Given `description` của `engineering-quality-gate` và `ops-deploy-release` When chạy `npm test` Then cả hai ≤ 500 ký tự, có "Không dùng khi" trỏ tới id tồn tại (`checkDescription` không báo lỗi).
- [ ] **AC5.2** — Given `test/routing/engineering-quality-gate.json` và `ops-deploy-release.json` When đếm positive Then mỗi file hiện có 4 positive và sau thay đổi có ≥ 6 positive, `calc: 4 + 2 = 6` cho từng file; các mục go-live mới nằm trong positive.
- [ ] **AC5.3** — Given corpus routing đã cập nhật When chạy `node scripts/routing-score.mjs` Then exit 0 và, với `test/routing/rank1.lock.json` là ngưỡng theo PHẦN TRĂM, tỉ lệ positive ≥ 70% và negative ≥ 94%; cách tính minh hoạ: Given 10 prompt positive, 7 đúng hạng 1 When tính Then tỉ lệ = `calc: 7 / 10 * 100 = 70`, đạt ngưỡng 70%. `rank1.lock.json` không bị sửa để hạ ngưỡng.
- [ ] **AC5.4** — Given manifest sau bump When đọc Then `plugins/engineering/.manifest.json` = 2.17.0, `plugins/ops/.manifest.json` = 2.2.0, `workflows/.manifest.json` = 3.17.5; sau `npm run build` và `node cli/lib/versions.mjs --lock` thì `plugins/_versions.lock.json` khớp (exit 0).
- [ ] **AC5.5** — Given toàn bộ thay đổi sau vòng sửa cuối When chạy `npm test` và `npm run validate` Then cả hai exit 0.
- [ ] **AC5.6** — Given thư mục `docs/requests/2026-11-19-golive-security-scan/` When chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-19-golive-security-scan/` Then không có WARN thuộc W10–W14 và W22; mọi WARN còn lại được nêu trong báo cáo.

- [ ] **AC6.1** — Given người dùng đưa report thật đã che của từng tool (Gitleaks, Trivy, Coverity, ZAP, Nessus, BlackDuck, Sonar, và file KEV) When chạy script trên các report đó Then exit 0 và số đếm từng chỉ tiêu khớp đối chiếu tay do người duyệt làm; nếu lệch thì sửa parser và thêm fixture từ report đã che, rồi chạy lại. Nếu chưa có report trước khi kết thúc nhánh thì ghi residual risk, không chặn merge. (Nghiệm thu thật, không phải gate tự động.)

## Thiết kế

### Hướng đã cân nhắc
- **A (chọn):** mở rộng `engineering-quality-gate` (reference cho từng nguồn, mục "Ngưỡng go-live", script đếm), thêm bước digest vào `ops-deploy-release`, thêm đầu vào và một dòng retest vào `workflow-security-review`. Đánh đổi: skill `engineering-quality-gate` phình; description có trần 500 ký tự nên phải rút chữ cũ (xem Rủi ro).
- **B (loại lần này):** workflow mới `workflow-golive-security` nối quét → digest → DAST/pentest/Nessus → ngưỡng → sửa/retest. Đánh đổi: đúng mô hình nhiều capability, nhưng kéo theo `graph.json`, registry, orchestrator, eval; người dùng muốn có phần quét trước. Để request sau cùng template hồ sơ go-live.
- **C (loại):** chỉ reference và ngưỡng, bỏ kiểm digest. Đánh đổi: ít việc nhất, nhưng bỏ phần người dùng đã chọn.
- **A' (loại):** đếm ngưỡng bằng agent đọc tay, không script. Đánh đổi: không cần code, nhưng số đếm không tất định, không test được "chưa đo" và "không tính đạt". Loại.
- **Khuyến nghị:** A kèm script đếm.

### Thay đổi file
| Đường dẫn | Loại | Nội dung |
|---|---|---|
| `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs` | mới | Script đếm ngưỡng (tên đề xuất, xem Để builder quyết) |
| `plugins/engineering/skills/engineering-quality-gate/references/` | mới | Gitleaks, Trivy image, Coverity, ZAP, Nessus, pentest, ASVS L2 (có thể gộp ZAP + Nessus) |
| `plugins/engineering/skills/engineering-quality-gate/references/sonarqube.md`, `blackduck.md` | sửa | thêm mục đọc JSON cho việc đếm ngưỡng; luồng cũ giữ nguyên |
| `plugins/engineering/skills/engineering-quality-gate/SKILL.md` | sửa | description; bước 2 thêm nguồn mới; ranh giới an toàn; "Bản đồ tài liệu" |
| `.../references/report-template.md` | sửa | mục "Ngưỡng go-live", ASVS L2, pentest và retest, dòng "suppress ngoài report" |
| `.../references/triage-and-fix.md` | sửa | finding pentest; quy tắc FP; nhãn chấp nhận rủi ro và suppress |
| `plugins/ops/skills/ops-deploy-release/SKILL.md` | sửa | description; bước kiểm digest; ranh giới đọc SIT/UAT |
| `.../references/release-checklist.md` | sửa | mục digest trong checklist tiền deploy |
| `.../references/digest-check.md` | mới | lệnh đọc digest, quy tắc so khớp, các trường hợp đặc biệt |
| `workflows/security-review/WORKFLOW.md` | sửa | đầu vào tuỳ chọn; một dòng retest ở Bước 9 |
| `test/routing/engineering-quality-gate.json`, `test/routing/ops-deploy-release.json` | sửa | thêm 2 positive mỗi file |
| `test/content/55-golive-security-gate.pin.mjs` | mới | pin cho script, cấu trúc tài liệu, digest, workflow |
| `plugins/engineering/.manifest.json`, `plugins/ops/.manifest.json`, `workflows/.manifest.json` | sửa | bump version |
| `plugins/_versions.lock.json` | sửa | refresh bằng `node cli/lib/versions.mjs --lock` |

Không đổi: `workflows/security-review/graph.json`, `test/routing/rank1.lock.json`, `plugins/_cowork.json`,
`plugins/_published.json`, `docs/specs/` (spec được cập nhật ở bước gộp). Luồng quality gate Sonar và triage BlackDuck
hiện có không đổi; chỉ thêm việc đếm từ report.

### Script đếm: hợp đồng đề xuất
- Chỉ dùng module built-in của Node (`node:fs`, `node:path`, `node:url`); không dependency; không parser XML.
- Cờ đề xuất, mỗi nguồn một lần trừ khi ghi khác: `--gitleaks-tree <file>`, `--gitleaks-history <file>`, `--trivy <file>`,
  `--coverity <file>`, `--zap <file>`, `--nessus <file.csv>`, `--blackduck <file.json>`, `--sonar <file.json>`,
  `--sarif <file>` (lặp được), `--kev <file>`, `--fp <file.json>`, `--accepted <file.json>`, `--na <nguồn>=<bằng chứng>`
  (lặp được).
- Stdout: JSON có khoá cố định. Hình dạng (không có giá trị thật):

```json
{
  "thresholds": {
    "secret":   { "status": "không đạt", "count": 2, "missing": [], "labels": { "chấp nhận rủi ro": 0, "suppress": 0, "FP đã loại": 0 } },
    "critHigh": { "status": "chưa đo",   "count": 0, "missing": ["coverity"], "labels": { "chấp nhận rủi ro": 0, "suppress": 0, "FP đã loại": 0 } },
    "rce":      { "status": "chưa đo",   "count": 0, "missing": ["coverity"], "labels": {} },
    "kev":      { "status": "chưa đo",   "count": 0, "missing": ["kev"], "labels": {} }
  },
  "overall": "không đạt",
  "findings": [
    { "id": "F001", "sources": ["trivy", "nessus"], "severity": "High", "key": "CVE-XXXX-NNNN@image:sha256:...",
      "location": "layer 3 / component@version", "cve": ["CVE-XXXX-NNNN"], "cwe": [], "scope": "image", "labels": [] }
  ],
  "warnings": []
}
```

- `overall` theo quyết định 8: secret `không đạt` ⇒ `không đạt`.
- Exit 0 khi đọc được input; exit 2 khi lỗi đầu vào hoặc đối số. Thông báo lỗi chỉ nêu tên cờ, tên file, tên trường.
- Ngoài `--na`, mọi "không áp dụng" phải có bằng chứng; bằng chứng do người dùng hoặc agent viết, script chỉ chép lại.

### Nội dung reference (định hướng)
Mỗi reference có: cách chạy tại chỗ (chỉ Gitleaks và Trivy) hoặc cách đọc report đã xuất (các nguồn còn lại), định dạng,
trường cần đọc, cách ánh xạ severity, lưu ý mask, và danh sách file ignore cần liệt kê. Các lệnh dưới đây là định hướng,
cần kiểm trên phiên bản tool của tổ chức:

- Gitleaks [Unverified] cú pháp theo phiên bản: quét working tree `gitleaks dir --redact --report-format json --report-path <file> <đường dẫn>`; lịch sử git `gitleaks git --redact --report-format json --report-path <file> <repo>`. Phiên bản cũ dùng `gitleaks detect` thay cho hai lệnh này. File ignore: `.gitleaksignore`.
- Trivy image [Unverified]: `trivy image --scanners vuln,secret --format json --output <file> <image>`. Đọc `Results[].Vulnerabilities[]`, `Results[].Secrets[]`, `Metadata.RepoDigests`. File ignore: `.trivyignore`, VEX.
- BlackDuck: đọc CycloneDX JSON đã xuất (`vulnerabilities[]`, `ratings[].severity`, `affects[].ref`) [Unverified] với định dạng JSON gốc của Black Duck. Agent không gọi server Black Duck.
- Sonar: đọc issues JSON đã xuất (`issues[].type`, `severity`, `impacts[]`, `resolution`, `component`, `line`) [Unverified]. Agent không gọi server Sonar. Luồng quality gate hiện có không đổi.
- Coverity [Unverified]: report JSON xuất bằng `cov-format-errors --json-output-v7`; người dùng chạy trên máy có license, agent chỉ đọc file.
- ZAP [Unverified]: người dùng xuất report JSON (hoặc XML để đọc tay) sau khi chạy trên SIT/UAT. Đọc `site[].alerts[]` với `riskcode`, `cweid`, `url`. Agent không chạy active scan.
- Nessus [Unverified]: người dùng xuất CSV (script đọc cột `Risk`, `CVE`, `Plugin ID`, `Host`, `Port`, `Name`) hoặc `.nessus` (agent đọc tay theo reference).
- Pentest: PDF/md/Word do đơn vị ATTT cung cấp. Agent lập bảng finding (ID, mức độ chuẩn hoá, mô tả, vị trí, đề xuất) để người dùng xác nhận; sau đó vòng sửa dùng Bước 7–9 của `workflow-security-review`; theo dõi retest tới 100% Critical/High/Medium.
- ASVS L2: checklist của tổ chức (csv hoặc md). Mục checklist ghi đạt / không đạt / chưa kiểm kèm `file:line`; không có file → `chưa đo`.

### Kiểm digest trong `ops-deploy-release`
1. Digest đã quét: lấy từ `Metadata.RepoDigests` của Trivy JSON, hoặc `docker image inspect --format '{{json .RepoDigests}}' <image>` trên máy build.
2. Digest đang chạy trên SIT/UAT, chỉ đọc [Unverified]: `docker inspect --format '{{.Image}}' <container>` lấy image ID; `docker image inspect --format '{{json .RepoDigests}}' <image-id>` lấy digest; `docker compose images` liệt kê service và image. Agent chạy các lệnh này chỉ khi người dùng xác nhận máy và phạm vi, hoặc người dùng dán output.
3. So khớp theo quy tắc trong AC3.2 và quyết định 20–21. Kết quả vào mục digest của checklist tiền deploy, mục này là mục chặn.
4. Không chạy lệnh nào ghi lên SIT/UAT; không đọc giá trị biến môi trường chứa secret (chỉ nêu tên biến).

## Ảnh hưởng spec
- workflows: thêm R29
- security-gate: thêm R1, thêm R2, thêm R3

Ghi chú: `workflows/R29` là `workflow-security-review` nhận report pentest/Coverity/ZAP/Nessus làm đầu vào tuỳ chọn và có dòng đối chiếu retest ở Bước 9; `graph.json` không đổi. Năng lực `security-gate` (mới) gồm R1 (script đếm ngưỡng go-live và quy tắc "chưa đo"/"không áp dụng"), R2 (đọc report các nguồn, pentest và ASVS L2), R3 (đối chiếu digest image đang chạy SIT/UAT với image đã quét). `spec.md` của `security-gate` tạo ở bước gộp. `skill-quality` không khai (quyết định 27).

## Ngoài phạm vi và anti-goal
- Ngoài phạm vi: template hồ sơ go-live; workflow `workflow-golive-security`; agent tự pentest; NOC/SOC 24/7; luật ngưỡng chặn thật và ngoại lệ có biên bản; aip tự soạn yêu cầu ASVS L2; đổi luật chấp nhận rủi ro của `workflow-security-review`; thay đổi luồng quality gate Sonar và triage BlackDuck hiện có (không đổi; chỉ thêm việc đếm ngưỡng từ report); eval chạy model thật; ADR mới; skill mới; đưa skill vào `_cowork.json`.
- Anti-goal: in giá trị secret ra report, log, output công cụ hay stderr; chạy ZAP active scan, quét Nessus, deploy hay lệnh ghi lên SIT/UAT khi chưa có xác nhận; gọi server SonarQube hay Black Duck; làm hỏng luồng hiện có của `engineering-quality-gate` (Sonar, BlackDuck, `trivy fs`, review source-first); làm routing của skill khác tụt hạng.

## Ràng buộc
- Script zero-dep, Node 20+; UTF-8 không BOM; LF.
- Test không chứa chuỗi giống secret thật trong file repo: sentinel được ghép từ nhiều mảnh lúc chạy, như mẫu `test/content/54-codebase-onboarding.pin.mjs`. Lý do: tránh chính các scanner của repo báo nhầm.
- Hàm đếm thuần được export để kiểm như unit; CLI (exit code, stdout, stderr) kiểm qua `spawnSync`, theo AGENTS.md "tầng thấp nhất".
- `description` ≤ 500 ký tự (ràng buộc trong `test/contract/10-source.contract.mjs` và `checkDescription`); giữ mục "Không dùng khi → id". Brief ghi giới hạn 1024 ký tự; theo repo, trần thực thi là 500.
- Mọi bước chạy ở session chính; không tạo file agent mới.
- Không thêm `Co-authored-by` vào commit; không commit khi chưa được duyệt.

## Kiểm thử
- AC1.1–AC1.19: `test/content/55-golive-security-gate.pin.mjs`. AC1.2–AC1.11, AC1.14–AC1.19 kiểm hàm đếm đã export (unit). AC1.1, AC1.12, AC1.13 kiểm CLI qua `spawnSync` vì đó là hành vi vận hành (exit code, không lộ secret). Fixture dựng lúc chạy trong thư mục tạm.
- AC2.1, AC2.2, AC2.3: pin cấu trúc trong cùng file. AC2.4, AC2.5, AC2.6: review diff.
- AC3.1, AC3.2: pin cho tên lệnh và tên trạng thái; AC3.2 quy tắc đối chiếu và AC3.3 đọc ở review diff.
- AC4.1: pin nội dung WORKFLOW.md. AC4.2, AC4.3: `git diff master -- workflows/security-review/graph.json` và `node test/validate.mjs --only workflows`.
- AC5.1, AC5.5: `npm test`. AC5.2: pin đếm positive trong corpus. AC5.3: `node scripts/routing-score.mjs`. AC5.4: `npm run build` rồi `node cli/lib/versions.mjs --lock`. AC5.6: `check-request.mjs`.
- AC6.1: nghiệm thu thủ công với report thật đã che, do người dùng cung cấp; không chạy trong `npm test`.
- Chạy full suite một lần sau vòng sửa cuối (AGENTS.md, Testing).
- Không chạy eval thật (tốn tiền model).

## Để builder quyết
- Tên script (đề xuất `go-live-gate.mjs`) và tên các cờ CLI; nếu đổi thì cập nhật Thiết kế và AC tương ứng.
- Tên file trong `references/`; có gộp ZAP và Nessus không.
- Chữ cụ thể của SKILL.md, reference, report-template; thứ tự mục; cách trình bày bảng.
- Trường JSON phụ (ngoài các trường đã nêu) và cấu trúc `labels` trong output.
- Định dạng chuỗi của khoá gộp, miễn đúng quyết định 9 và khoá FP/accepted ở quyết định 19.
- Nội dung description mới, miễn ≤ 500 ký tự và giữ "Không dùng khi → id".
- Có tách `digest-check.md` hay gộp vào `release-checklist.md`.
- Số positive thêm cụ thể, miễn ≥ 2 mỗi file.

## Rủi ro và câu hỏi mở
- [Unverified] Tên trường JSON và cấu trúc của từng tool (Gitleaks `RuleID`/`File`/`StartLine`/`Fingerprint`; Trivy `Results[].Vulnerabilities[]`, `Results[].Secrets[]`, `Metadata.RepoDigests`; ZAP `site[].alerts[]` với `riskcode`/`cweid`; Coverity `--json-output-v7`; Nessus CSV `Risk`/`CVE`; BlackDuck JSON gốc; Sonar `issues[]` với `type`, `severity`, `impacts[]`, `resolution`; CISA KEV `vulnerabilities[].cveID`) chưa kiểm với report thật. Tool không có trong repo nên chưa spike được. Fixture test viết theo tài liệu tool, rủi ro lệch với phiên bản của tổ chức. Biện pháp: AC6.1, khi người dùng đưa report đã che.
- [Unverified] Cú pháp lệnh Gitleaks (`gitleaks dir`/`gitleaks git` so với `gitleaks detect`) phụ thuộc phiên bản.
- [Unverified] Claude Code đọc được PDF; Word (docx) có thể không đọc được. Câu hỏi mở: đơn vị ATTT có xuất report pentest sang PDF hoặc md không?
- [Unverified] Trường mức độ và CWE của Coverity JSON; script exit 2 nếu không đọc được, để tránh đếm thiếu âm thầm.
- [Inference] Message lỗi gốc của `JSON.parse` có thể chứa đoạn input; design chọn không in message gốc (quyết định 12). Kiểm bằng AC1.12.
- [Inference] Docker: `RepoDigests` của image và image ID của container là hai loại định danh khác nhau; so sánh chéo chỉ hợp lệ khi cùng loại. Quyết định 20 xử lý, cần kiểm trên máy SIT/UAT thật.
- [giả định] Bộ nguồn bắt buộc theo chỉ tiêu khớp checklist của tổ chức; cơ sở là ảnh checklist (quyết định 30). Câu hỏi mở: mọi đợt có bắt buộc đủ sáu scanner không?
- [giả định] Finding secret không đếm vào Critical/High (quyết định 4). Câu hỏi mở: có đổi không?
- [giả định] Secret trong lịch sử git vẫn đếm (quyết định 3).
- Cùng CVE ở Trivy image và BlackDuck `component@version` được đếm hai lần (quyết định 9, người dùng chốt), vì hai tài sản khác nhau. Điều này có thể làm `không đạt` ở chỉ tiêu Critical/High nhiều hơn số lỗ hổng thực tế; đây là hướng an toàn đã chọn.
- Suppress ngoài report: finding bị file ignore ẩn không được đếm, script không thấy (quyết định 18). Residual risk, agent liệt kê file ignore vào report nhưng không đếm được số mục bị ẩn ngoài số dòng trong file.
- Sonar security hotspot không nằm trong issues JSON, không đếm (quyết định 16). Residual risk.
- Exit 0 khi có Critical (quyết định 11). Rủi ro: CI hoặc người dùng đọc exit 0 là "đạt". Giảm rủi ro bằng cách stdout luôn có trường `overall` và `status`; không đổi thành exit khác 0 vì brief yêu cầu không chặn.
- Ngân sách description: `engineering-quality-gate` hiện 460 ký tự, còn khoảng 40 ký tự cho trigger mới. Phải rút chữ cũ; nếu không đủ thì bỏ bớt trigger, không nới trần.
- Routing sát ngưỡng. Đo hiện tại (2026-11-19): positive 155/219 (70,8%) so với khoá 70%; negative 155/164 (94,5%) so với khoá 94%. Thêm trigger vào `engineering-quality-gate` có thể kéo prompt của `workflow-security-review` (rank-1 hiện là `engineering-quality-gate` với prompt "go-live") và ngược lại. Chạy `node scripts/routing-score.mjs` sau mỗi lần sửa description; nếu tụt dưới khoá thì rút trigger, không hạ khoá.
- Năng lực `security-gate` chưa có `spec.md`. Khi merge, session chính tạo `docs/specs/security-gate/spec.md` và thêm dòng vào `docs/specs/README.md`. Check-request báo W11 ở giai đoạn này; cần ghi vào báo cáo.
- Không kiểm được trên project thật: không có report, không có môi trường SIT/UAT, không có checklist ASVS. AC6.1 là nghiệm thu thật.
- Nessus `.nessus` XML và ZAP XML đọc tay tốn token và dễ sai sót với report lớn (quyết định 13).
- Pentest: retest 100% Critical/High/Medium là chỉ tiêu theo dõi, không có cổng tự động. Đây là chủ đích theo brief.
- Trivy `UNKNOWN` ánh xạ sang Info (quyết định 10): đây là lựa chọn của agent, không do tool quy định.
- Câu hỏi mở còn lại: định dạng thật của checklist ASVS L2 (csv, md hay xlsx); report pentest PDF hay Word.

## Thứ tự thực thi gợi ý
1. Viết test fixture trước (red) cho script: AC1.1–AC1.19; sau đó viết script (green). Thứ tự đề xuất: bảng chuẩn hoá và đếm (AC1.1–AC1.5), gộp theo tài sản (AC1.11, AC1.14, AC1.19), FP/accepted/suppress (AC1.7–AC1.8), KEV và RCE (AC1.9–AC1.10, AC1.18), BlackDuck và Sonar (AC1.16–AC1.17), overall (AC1.15), lỗi và bảo mật (AC1.12–AC1.13).
2. Thêm mục đọc JSON vào `sonarqube.md`, `blackduck.md`; viết reference mới; sửa `report-template.md`, `triage-and-fix.md`, `SKILL.md` của quality-gate; pin AC2.1–AC2.3; review AC2.4–AC2.6.
3. Sửa description `engineering-quality-gate` và thêm positive; chạy `node scripts/routing-score.mjs`; AC5.1–AC5.3.
4. Thêm bước digest vào `ops-deploy-release` và `digest-check.md`; pin AC3.1–AC3.2; review AC3.3.
5. Sửa `workflows/security-review/WORKFLOW.md`; AC4.1–AC4.3.
6. Bump version, `npm run build`, `node cli/lib/versions.mjs --lock`; full suite một lần (AC5.4–AC5.5).
7. Chạy `check-request.mjs`; ghi WARN vào báo cáo (AC5.6).
8. Nghiệm thu AC6.1 khi người dùng đưa report thật đã che. Nếu chưa có trước khi kết thúc nhánh, ghi residual risk và không chặn.
9. Ở bước gộp spec (không thuộc request này): tạo `security-gate/spec.md`, thêm `workflows/R29` vào `docs/specs/workflows/spec.md`.
