---
name: engineering-quality-gate
description: "Chạy quality gate (SonarQube, Black Duck) và security review source-first theo OWASP/ASVS/CWE; đếm ngưỡng go-live từ report Gitleaks, Trivy, Coverity, ZAP, Nessus. Dùng khi người dùng muốn \"quét sonar\", \"kiểm tra lỗ hổng dependency\", \"security review\", \"ngưỡng go-live\", \"quét Gitleaks\". Không dùng khi cần quy trình bảo mật đầy đủ → workflow-security-review; review correctness/thiết kế → backend-code-review; review frontend → frontend-code-review."
order: 1
title: "Quality Gate — SonarQube + Black Duck + review bảo mật source-first, triage, fix, report"
runsIn: execute
invoke: per-request
---

# Quality Gate (capability engineering)

Điều phối một vòng **quality + security gate** trên mã nguồn qua **hai chiều bổ trợ nhau**:

1. **Tool gate** — thu thập findings **chất lượng** (SonarQube) và **lỗ hổng phụ thuộc** (Black Duck SCA
   mặc định; **Trivy** là lựa chọn thay thế cho SCA/filesystem scan).
2. **Security review source-first** — **review thủ công là chính**, đi theo **vùng rủi ro** (auth/session,
   input-validation/injection, crypto/secrets, dependency/supply-chain, logging), **ánh xạ mỗi finding về
   OWASP Top 10 / ASVS / CWE**. Scanner (Sonar/Black Duck/Trivy) chỉ **enrichment** — im lặng của scanner
   KHÔNG phải bằng chứng an toàn.

Sau đó **gộp** findings hai chiều, **triage** theo severity + exploitability, **áp fix cho lỗi rõ ràng** theo
`code-convention` của project, rồi **xuất report** có evidence + residual risk. Skill này là **hướng dẫn cách
agent chạy/đọc công cụ và review source** (docs-only recipe), KHÔNG phải scanner/CI code, cũng KHÔNG phải
công cụ codegen.

Có **hai chế độ truy cập, KHÔNG dùng web API**: (a) **chạy scanner tại chỗ qua CLI** khi project có cấu hình
+ token qua biến môi trường; (b) **đọc report/BOM/SARIF đã xuất sẵn**. Chọn theo cái đang có. Ngoài ra hỗ trợ
**fix-từ-report**: đọc một report bảo mật/chất lượng cũ rồi **áp fix an toàn trong đúng scope** của report.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở bất kỳ giai đoạn nào cần kiểm
chất lượng/bảo mật. Con người giữ chốt: **duyệt diff trước merge/push** (protected branch: mỗi commit).
Kiểm quy ước đặt tên và cấu trúc thư mục/file (không phải chất lượng hay bảo mật) → `engineering-convention-enforce`.

## Ranh giới an toàn

- **KHÔNG** nhập, in, hay log token/secret. Token đi qua **biến môi trường**; skill chỉ nêu **tên biến**
  (vd `SONAR_TOKEN`, `SONAR_HOST_URL`, `BLACKDUCK_URL`, `BLACKDUCK_API_TOKEN`) — không đọc giá trị ra output.
  **Mask** mọi giá trị secret trong report/log (vd `sk_live_****1234`): chỉ nêu tên khoá + file:line.
- **Scope-bound.** Chỉ review/sửa trong **đúng phạm vi người dùng nêu** (diff / module / thư mục `--scope` /
  scope của report). KHÔNG lan sang module anh em, thư mục cha, hay cả repo; dependency ngoài scope → cảnh
  báo, không phân tích.
- Không chạy lệnh phá huỷ; không đổi cấu hình server, quality gate profile, rule pack, hay CI pipeline.
- **Go-live:** không chạy ZAP active scan, không quét Nessus, không gọi server SonarQube hay Black Duck (chỉ đọc file
  đã xuất). Không chạy lệnh ghi lên SIT/UAT. Không cài tool vào project: tool thiếu thì nguồn đó `chưa đo`, đề nghị
  người dùng cài hoặc đưa report đã xuất.
- **Không đọc và không in giá trị secret.** Gitleaks chạy với `--redact`; script không đọc `Secret`, `Match`, `Code`.
  Báo cáo chỉ nêu tên luật, `file:line` hoặc layer.
- **Thiếu report của nguồn bắt buộc → `chưa đo`, không ghi `đạt`** (đã có finding thì `không đạt`); xem `statusOf` trong
  `scripts/go-live-gate.mjs`. `không áp dụng` chỉ khi mọi nguồn bắt buộc của chỉ tiêu có `--na` kèm bằng chứng.
- **ASVS L2:** thiếu checklist thì ASVS `chưa đo`. Agent không soạn yêu cầu ASVS và không suy ra yêu cầu từ tên mục.
- **Pentest:** agent không tự pentest và không gửi payload; chỉ đọc report đã có.
- **Áp fix** chỉ cho lỗi/vuln **rõ ràng** theo `code-convention`; giữ nguyên hành vi nghiệp vụ. Breaking-change
  thiếu test và các thay đổi bảo mật rủi ro cao (viết lại auth/authorization, vòng đời JWT/session, bump major
  dependency, đổi hành vi API công khai) → **đánh dấu để người quyết**, KHÔNG auto-fix.
- Không tự bump **major** rủi ro khi thiếu test bảo chứng; không tự commit — con người **duyệt diff** trước
  merge/push (protected branch: mỗi commit).
- Ngôn ngữ report **đo được** (đếm được, có file:line, có CVE/CVSS, có OWASP/ASVS/CWE); LUÔN nêu **residual
  risk**. KHÔNG tuyên bố "chặn / đảm bảo / loại bỏ / sửa triệt để" lỗ hổng — findings phản ánh thời điểm quét
  với dữ liệu sẵn có, có thể sót.

## Quy trình — quality + security gate

1. **Nạp context + dò cấu hình (BẮT BUỘC — trước khi quét/review).**
   Đọc CLAUDE.md / project-knowledge để nắm **ranh giới an toàn** + `code-convention.md`, và **chốt scope +
   stack** (Java/Spring, Node/React, Python, Docker…). Dò: `sonar-project.properties`, cấu hình Black Duck
   (`detect`) hoặc `trivy`, **file report có sẵn** (issues JSON, SARIF, BOM SPDX/CycloneDX, report bảo mật
   cũ), và **tên biến môi trường** chứa token. Từ đó **chọn chế độ**: chạy scanner vs đọc report vs
   fix-từ-report. Thiếu tất cả → nói rõ (fail-loud), đề nghị người cung cấp cấu hình/report thay vì tự bịa.

2. **Thu thập findings — hai chiều.**
   - *Tool gate:* chạy `sonar-scanner` + Black Duck `detect` (hoặc `trivy fs`) nếu có cấu hình + token; hoặc
     đọc report đã xuất. Chi tiết: [references/sonarqube.md](references/sonarqube.md) +
     [references/blackduck.md](references/blackduck.md).
   - *Đếm ngưỡng go-live (khi đợt có report các nguồn go-live):* chạy script đếm bốn chỉ tiêu (0 secret, 0 Critical/High,
     0 RCE, 0 KEV) từ file đã có. Script không gọi mạng và không cài tool:
     ```bash
     node <thư mục skill>/scripts/go-live-gate.mjs --gitleaks-tree <file> --gitleaks-history <file> --trivy <file> --coverity <file> --zap <file> --nessus <file.csv> --blackduck <file.json> --sonar <file.json> --sarif <file> --kev <file.json> --fp <file.json> --accepted <file.json> --na <nguồn>=<bằng chứng>
     ```
     - Truyền cờ của nguồn có report; cần ít nhất một cờ nguồn, không thì exit 2. `--sarif` lặp được, `--na` lặp được
       cho các nguồn khác nhau; các cờ còn lại chỉ dùng một lần.
     - Exit 0 nghĩa là đọc được input, KHÔNG nghĩa là đạt. Exit 2 là lỗi đầu vào: không có kết luận; báo tên cờ và
       tên file rồi dừng. Kết luận nằm ở `overall` và `status` trong stdout JSON.
     - `--na <nguồn>=<bằng chứng>` chỉ khi bề mặt đó không tồn tại; bằng chứng không được để trống. Tên nguồn hợp lệ:
       `gitleaks-tree`, `gitleaks-history`, `trivy`, `coverity`, `zap`, `nessus`, `blackduck`, `sonar`, `kev`. `sarif` không dùng được với `--na` (exit 2); nguồn đã có cờ riêng cũng không khai `--na` được (exit 2).
     - `--fp` và `--accepted` là JSON mảng `{source, key, reason}`; quy tắc nhãn ở [references/triage-and-fix.md](references/triage-and-fix.md).

     | Nguồn | Cách lấy | Cờ script | Tài liệu |
     |---|---|---|---|
     | Gitleaks working tree | chạy tại chỗ, `--redact` | `--gitleaks-tree` | [gitleaks.md](references/gitleaks.md) |
     | Gitleaks lịch sử git | chạy tại chỗ, `--redact` | `--gitleaks-history` | [gitleaks.md](references/gitleaks.md) |
     | Trivy image | chạy tại chỗ, `--scanners vuln,secret` | `--trivy` | [trivy-image.md](references/trivy-image.md) |
     | Coverity | đọc JSON đã xuất | `--coverity` | [coverity.md](references/coverity.md) |
     | SARIF | đọc file đã xuất, lặp được | `--sarif` | [coverity.md](references/coverity.md) (mục SARIF) |
     | ZAP | đọc JSON đã xuất; XML đọc tay | `--zap` | [zap-nessus.md](references/zap-nessus.md) |
     | Nessus | đọc CSV đã xuất; `.nessus` đọc tay | `--nessus` | [zap-nessus.md](references/zap-nessus.md) |
     | BlackDuck | đọc CycloneDX JSON đã xuất | `--blackduck` | [blackduck.md](references/blackduck.md) (mục Đọc cho ngưỡng go-live) |
     | SonarQube | đọc issues JSON đã xuất | `--sonar` | [sonarqube.md](references/sonarqube.md) (mục Đọc cho ngưỡng go-live) |
     | CISA KEV | file JSON người dùng tải về | `--kev` | [Unverified] đọc `vulnerabilities[].cveID` và `dateReleased`; chưa có reference riêng |
     | Pentest | PDF hoặc md do đơn vị ATTT cung cấp; không qua script | — | [pentest.md](references/pentest.md) |
     | ASVS L2 | checklist csv hoặc md của tổ chức; không qua script | — | [asvs-l2.md](references/asvs-l2.md) |

   - *Security review source-first:* review thủ công theo **vùng rủi ro** dùng
     [references/security-review-areas.md](references/security-review-areas.md), áp **rule engine**
     [references/security-rule-engine.md](references/security-rule-engine.md), ánh xạ OWASP/ASVS/CWE qua
     [references/owasp-asvs-cwe-mapping.md](references/owasp-asvs-cwe-mapping.md). Dùng output scanner **chỉ
     làm enrichment**, không thay cho review source.
   **Gộp** tất cả vào một danh sách chung; mỗi finding có nguồn, severity, vị trí (`file:line` hoặc
   `component@version`), và (nếu là bảo mật) OWASP/ASVS/CWE + evidence (trích code/config/manifest).

3. **Triage.**
   Phân loại severity (chuẩn hoá về một trục chung), gom theo file/component, ưu tiên **blocker/critical**,
   **vulnerability có bản vá**, và **finding bảo mật có exploitability + impact rõ**. Quyết mỗi finding
   **fix / propose / defer** theo bảng quyết định trong [references/triage-and-fix.md](references/triage-and-fix.md).

4. **Fix (người duyệt diff).**
   Áp fix cho **lỗi/vuln rõ ràng** theo `code-convention`: code smell rõ, dead code, đặt tên, bug đơn giản;
   bump version dependency có bản vá; các **safe fix bảo mật** (mask/loại secret ví dụ, thay hardcoded config
   bằng biến môi trường, thêm validate khi hành vi rõ, thay API an toàn hơn khi ánh xạ hiển nhiên). **KHÔNG**
   auto-fix breaking-change thiếu test hay thay đổi bảo mật rủi ro cao — đánh dấu để người quyết. Với
   **fix-từ-report**: chỉ sửa các finding trong report, **trong đúng scope** của report. Xem
   [references/triage-and-fix.md](references/triage-and-fix.md).

5. **Verify + report.**
   Chạy lại build/test/lint (rescan nếu nhanh) xác nhận không vỡ. Xuất report theo
   [references/report-template.md](references/report-template.md): quality-gate status, bảng findings theo
   nguồn/severity/vị trí **+ cột OWASP/ASVS/CWE** cho finding bảo mật, mục **Đã sửa / Hoãn (kèm lý do) /
   Residual risk**, các bước verify đã chạy, secret đã mask. Con người **duyệt diff** trước merge/push
   (protected branch: mỗi commit).

## Dấu hiệu đang tự biện minh

| Suy nghĩ | Thực tế |
|---|---|
| "Không có token Sonar, tự suy ra kết quả quét" | Bước 1: thiếu cấu hình và report thì nói rõ (fail-loud) và xin người dùng cung cấp, không tự bịa. |
| "Scanner sạch là xong, bỏ review source" | Bước 2: output scanner chỉ là enrichment; security review source-first vẫn phải chạy và gộp chung danh sách. |
| "Auto-fix luôn lỗi auth cho nhanh" | Bước 4: thay đổi bảo mật rủi ro cao hoặc breaking thiếu test thì đánh dấu để người quyết, không auto-fix. |
| "Ghi giá trị secret vào report cho rõ" | Ranh giới an toàn: mask mọi giá trị secret, chỉ nêu tên khoá và `file:line`. |
| "Quét sạch nghĩa là đã loại bỏ lỗ hổng" | Bước 5 và ranh giới an toàn: report nêu residual risk, kết quả chỉ phản ánh thời điểm quét. |

## Verification (trước khi báo hoàn thành)

- Đã dò cấu hình, **chốt scope + stack**, và **nêu rõ chế độ** đang dùng (chạy scanner / đọc report /
  fix-từ-report).
- Findings gộp từ **cả tool gate và security review source-first**; mỗi finding có severity + vị trí; finding
  bảo mật có evidence + ánh xạ OWASP/ASVS/CWE (khi ánh xạ được).
- Fix đã áp bám `code-convention`, **trong đúng scope**; build/test/lint xanh, hoặc phần bị bỏ qua đã báo rõ.
- Report có đủ **Đã sửa / Hoãn (lý do) / Residual risk**; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- Không token/secret nào lọt vào output (đã mask); con người duyệt diff trước merge/push
  (protected branch: mỗi commit).

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/sonarqube.md](references/sonarqube.md): thu thập Sonar (chạy `sonar-scanner` / đọc report),
  phân loại type + severity + quality gate, map finding → file:line, bảng "tự sửa an toàn vs cần người review".
- [references/blackduck.md](references/blackduck.md): thu thập Black Duck (chạy `detect` / đọc BOM; Trivy thay
  thế), phân loại component vulnerability (CVE + CVSS) + license risk, triage vuln (bump version theo hệ), quy
  tắc không bump major rủi ro khi thiếu test.
- [references/security-rule-engine.md](references/security-rule-engine.md): phương pháp **review source-first**
  + các nhóm rule theo stack (Java/Spring, React, Python, Docker, secrets, architecture) + quy tắc mask secret.
- [references/security-review-areas.md](references/security-review-areas.md): checklist review gộp theo 5 vùng
  rủi ro (auth/session, input-validation, crypto/secrets, dependency/supply-chain, logging) — key check mỗi vùng.
- [references/owasp-asvs-cwe-mapping.md](references/owasp-asvs-cwe-mapping.md): ánh xạ OWASP Top 10 ↔ họ control
  ASVS ↔ CWE thường gặp để chuẩn hoá report (không thổi phồng finding).
- [references/triage-and-fix.md](references/triage-and-fix.md): vòng dùng chung (gộp → phân loại → quyết
  fix/propose/defer → áp fix → verify → cập nhật report) + bảng quyết định "tự sửa vs người quyết" (cả chất
  lượng lẫn bảo mật) + luồng **fix-từ-report** (safe-fix policy, scope rule) + nhắc ranh giới an toàn.
- [references/gitleaks.md](references/gitleaks.md): chạy Gitleaks tại chỗ (working tree và lịch sử git, `--redact`), cờ `--gitleaks-tree` / `--gitleaks-history`, trường đọc, `.gitleaksignore`.
- [references/trivy-image.md](references/trivy-image.md): chạy Trivy image (`vuln,secret`), cờ `--trivy`, `Metadata.RepoDigests`, `.trivyignore` và VEX.
- [references/coverity.md](references/coverity.md): đọc JSON Coverity đã xuất (`--coverity`) và SARIF (`--sarif`), ánh xạ mức độ, gộp theo `file:line`.
- [references/zap-nessus.md](references/zap-nessus.md): đọc ZAP JSON (`--zap`) và Nessus CSV (`--nessus`); ZAP XML và `.nessus` đọc tay; không ZAP active scan, không quét Nessus.
- [references/pentest.md](references/pentest.md): nhập report pentest, bảng finding để người dùng xác nhận, theo dõi retest.
- [references/asvs-l2.md](references/asvs-l2.md): điền checklist ASVS L2 của tổ chức, evidence `file:line`, không tự soạn yêu cầu.
- [references/report-template.md](references/report-template.md): mẫu report (status + bảng findings có cột
  OWASP/ASVS/CWE + Đã sửa / Hoãn / Residual risk + bước verify + mask secret) với ngôn ngữ đo được, không
  tuyên bố tuyệt đối.
