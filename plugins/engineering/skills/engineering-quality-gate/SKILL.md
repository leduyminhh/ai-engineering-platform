---
name: engineering-quality-gate
description: "Skill capability xuyên suốt (plugin engineering) để chạy quality + security gate trên mã nguồn. Hai chiều bổ trợ nhau: (1) TOOL GATE — SonarQube (bug / vulnerability / code smell / security hotspot / quality gate) + Black Duck SCA mặc định (CVE + CVSS + license của dependency; Trivy là lựa chọn thay thế); (2) SECURITY REVIEW SOURCE-FIRST — review thủ công theo vùng rủi ro (auth/session, input-validation/injection, crypto/secrets, dependency/supply-chain, logging) ánh xạ OWASP Top 10 / ASVS / CWE, scanner chỉ là enrichment. Gộp findings, triage, tự sửa lỗi rõ ràng theo code-convention (con người DUYỆT DIFF), rồi xuất report có evidence + residual risk + mask secret. Hỗ trợ luồng fix-từ-report cũ (đọc report → áp fix an toàn trong đúng scope). Truy cập KHÔNG dùng web API: chạy scanner tại chỗ qua CLI khi có cấu hình + token qua biến môi trường, hoặc đọc report/BOM/SARIF đã xuất. Dùng skill NÀY khi người dùng muốn \"quét sonar\", \"chạy sonarqube\", \"check black duck\", \"quét bảo mật phụ thuộc\", \"security review\", \"review bảo mật code\", \"quality gate\", \"sửa lỗi sonar\", \"fix từ report\", \"review chất lượng code\", \"kiểm tra lỗ hổng dependency\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần ở bất kỳ giai đoạn nào cần kiểm chất lượng/bảo mật."
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
chất lượng/bảo mật. Con người giữ chốt: **duyệt diff trước khi commit**.

## Khi nào dùng

- Người dùng yêu cầu quét Sonar / chạy SonarQube, check Black Duck (hoặc Trivy), quét bảo mật phụ thuộc,
  chạy quality gate.
- Người dùng yêu cầu **security review / review bảo mật code** một diff, module, service, config, hoặc
  dependency; hoặc đối chiếu với OWASP/ASVS/CWE.
- Cần sửa lỗi Sonar, review chất lượng code, kiểm tra lỗ hổng dependency, hay **áp fix từ một report cũ**.
- Cần bump version một dependency có lỗ hổng đã có bản vá và xác nhận build/test không vỡ.

KHÔNG dùng skill này để tự cấu hình server/CI, hay gọi web API của SonarQube/Black Duck (ngoài phạm vi).
Kiểm quy ước đặt tên và cấu trúc thư mục/file (không phải chất lượng hay bảo mật) → dùng skill
`engineering-convention-enforce`.

## Ranh giới an toàn

- **KHÔNG** nhập, in, hay log token/secret. Token đi qua **biến môi trường**; skill chỉ nêu **tên biến**
  (vd `SONAR_TOKEN`, `SONAR_HOST_URL`, `BLACKDUCK_URL`, `BLACKDUCK_API_TOKEN`) — không đọc giá trị ra output.
  **Mask** mọi giá trị secret trong report/log (vd `sk_live_****1234`): chỉ nêu tên khoá + file:line.
- **Scope-bound.** Chỉ review/sửa trong **đúng phạm vi người dùng nêu** (diff / module / thư mục `--scope` /
  scope của report). KHÔNG lan sang module anh em, thư mục cha, hay cả repo; dependency ngoài scope → cảnh
  báo, không phân tích.
- Không chạy lệnh phá huỷ; không đổi cấu hình server, quality gate profile, rule pack, hay CI pipeline.
- **Áp fix** chỉ cho lỗi/vuln **rõ ràng** theo `code-convention`; giữ nguyên hành vi nghiệp vụ. Breaking-change
  thiếu test và các thay đổi bảo mật rủi ro cao (viết lại auth/authorization, vòng đời JWT/session, bump major
  dependency, đổi hành vi API công khai) → **đánh dấu để người quyết**, KHÔNG auto-fix.
- Không tự bump **major** rủi ro khi thiếu test bảo chứng; không tự commit — con người **duyệt diff** trước.
- Ngôn ngữ report **đo được** (đếm được, có file:line, có CVE/CVSS, có OWASP/ASVS/CWE); LUÔN nêu **residual
  risk**. KHÔNG tuyên bố "chặn / đảm bảo / loại bỏ / sửa triệt để" lỗ hổng — findings phản ánh thời điểm quét
  với dữ liệu sẵn có, có thể sót.

## Luồng quality + security gate

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
   Residual risk**, các bước verify đã chạy, secret đã mask. Con người **duyệt diff** trước khi commit.

## Verification (trước khi báo hoàn thành)

- Đã dò cấu hình, **chốt scope + stack**, và **nêu rõ chế độ** đang dùng (chạy scanner / đọc report /
  fix-từ-report).
- Findings gộp từ **cả tool gate và security review source-first**; mỗi finding có severity + vị trí; finding
  bảo mật có evidence + ánh xạ OWASP/ASVS/CWE (khi ánh xạ được).
- Fix đã áp bám `code-convention`, **trong đúng scope**; build/test/lint xanh, hoặc phần bị bỏ qua đã báo rõ.
- Report có đủ **Đã sửa / Hoãn (lý do) / Residual risk**; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- Không token/secret nào lọt vào output (đã mask); con người duyệt diff trước commit.

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
- [references/report-template.md](references/report-template.md): mẫu report (status + bảng findings có cột
  OWASP/ASVS/CWE + Đã sửa / Hoãn / Residual risk + bước verify + mask secret) với ngôn ngữ đo được, không
  tuyên bố tuyệt đối.
