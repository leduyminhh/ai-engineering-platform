# Triage & Fix — vòng dùng chung (chất lượng + bảo mật)

Sau khi thu thập findings từ SonarQube ([sonarqube.md](sonarqube.md)), Black Duck/Trivy
([blackduck.md](blackduck.md)) và **review bảo mật source-first** ([security-review-areas.md](security-review-areas.md)),
chạy một vòng chung để triage và xử lý nhất quán. Con người giữ chốt: **duyệt diff trước merge/push**
(protected branch: mỗi commit).

## Vòng xử lý

1. **Gộp findings mọi nguồn** vào một danh sách chung, mỗi mục có: nguồn (Sonar / Black Duck / Trivy /
   review), loại, severity, vị trí (`file:line` hoặc `component@version` + CVE), và với finding bảo mật thêm
   **OWASP/ASVS/CWE** + **evidence** (trích code/config/manifest) + (nếu có) hướng sửa / fixed version.
2. **Phân loại severity** và gom theo file/component để thấy điểm nóng. Chuẩn hoá thang severity về một trục
   chung (Blocker/Critical → High → Medium → Low/Info); finding bảo mật tính severity từ **exploitability +
   impact + exposure**, không chỉ đếm.
3. **Quyết mỗi finding: fix / propose / defer** theo bảng bên dưới. Ưu tiên **blocker/critical**,
   **vulnerability có bản vá**, và **finding bảo mật đã chứng minh** (auth bypass, injection sink, hardcoded
   secret, crypto yếu).
4. **Áp fix an toàn** theo `code-convention`. Giữ nguyên hành vi nghiệp vụ; fix từng nhóm nhỏ, dễ review.
5. **Verify:** chạy build/test/lint; **rescan nếu nhanh** để xác nhận finding đã đóng và không phát sinh mới.
   Bump version phụ thuộc → bắt buộc chạy build/test.
6. **Cập nhật report** theo [report-template.md](report-template.md): Đã sửa / Hoãn (kèm lý do) / Residual
   risk + bước verify đã chạy + secret đã mask.

## Bảng quyết định: tự sửa vs người quyết

| Tình huống | Quyết định | Lý do |
|------------|-----------|-------|
| Code smell rõ, dead code, unused import, đặt tên sai convention, format | **Tự sửa** | Không đổi hành vi quan sát được |
| Bug đơn giản có pattern sửa chuẩn (rò tài nguyên, null-check hiển nhiên) + có/thêm được test | **Tự sửa** | Hành vi đúng hơn, có test bảo chứng |
| Vulnerability phụ thuộc **có bản vá** (patch/minor) | **Tự sửa** (bump) + build/test | Bump tối thiểu, verify xanh |
| **Safe fix bảo mật** rõ ràng (mask/loại secret trong file ví dụ, thay hardcoded config bằng biến môi trường, thêm validate khi hành vi rõ, thay API an toàn hơn khi ánh xạ hiển nhiên, `yaml.load`→`safe_load`, thêm `USER` non-root/`HEALTHCHECK` khi đủ rõ) | **Tự sửa** (người duyệt) | Ánh xạ sửa hiển nhiên, không đổi hành vi nghiệp vụ |
| Fix **đổi hành vi** mà **thiếu test** bảo chứng | **Propose**, chờ người | Rủi ro hồi quy không đo được |
| **Security Hotspot** / finding nhạy cảm (auth, crypto, input handling) | **Propose / defer**, người đánh giá ngữ cảnh | Cần phán đoán ngoài phạm vi một diff |
| Thay đổi bảo mật **rủi ro cao**: viết lại auth/authorization, vòng đời JWT/session, đổi hành vi API công khai, xoay khoá mã hoá, migration DB, refactor kiến trúc | **Propose**, chờ người | Phạm vi rộng, dễ hồi quy |
| Vulnerability **không có bản vá** | **Defer**: workaround / replace / accept-with-note | Không bump liều |
| Bump **major** rủi ro, thiếu test | **Propose**, chờ người | Major thường breaking |
| **License risk** | **Defer** (advisory), người quyết | Tác động pháp lý/chính sách |
| Coverage/duplication dưới ngưỡng cổng | **Defer**, ghi trong report | Không sửa bằng một diff |

Nguyên tắc bao trùm: một fix chỉ "an toàn để tự áp" khi **không đổi hành vi quan sát được** hoặc **có test
bảo chứng**. Còn nghi ngờ → hạ xuống **Propose/Defer** thay vì tự áp.

## Fix-từ-report (áp fix từ một report cũ)

Khi người dùng chỉ tới một report bảo mật/chất lượng đã có và yêu cầu áp fix:

1. **Validate trước khi sửa:** report tồn tại; đọc được danh sách findings + **scope** của report; scope
   nằm **trong repo**; git working tree an toàn để sửa. Có thay đổi staged không liên quan → **dừng, hỏi người**.
2. **Lọc theo severity** (mặc định ưu tiên CRITICAL/HIGH), **gom nhóm** theo file / category / CWE / OWASP /
   dependency / chiến lược sửa.
3. **Chỉ áp safe fix** (theo bảng trên); thay đổi rủi ro cao → propose, chờ người xác nhận.
4. **Scope rule:** chỉ đọc/sửa file **trong đúng scope của report**; KHÔNG lan sang module anh em, thư mục
   cha, hay cả repo; KHÔNG tự mở rộng scope.
5. **Verify** bằng lệnh hợp stack (Maven `mvn -f <scope> test`; Gradle `./gradlew test`; Node `npm test`/
   `lint`/`build`; Python `pytest`/`compileall`; Docker `docker build`); rescan cùng scope nếu nhanh; so
   before/after. Verify fail → **không commit**.
6. **Cập nhật report** (before/after findings + residual risk). Không tự commit — con người **duyệt diff**.

## Ranh giới an toàn (nhắc lại)

- **Token qua biến môi trường**, chỉ nêu **tên biến** (vd `SONAR_TOKEN`, `BLACKDUCK_API_TOKEN`); KHÔNG
  nhập/in/log giá trị. **Mask** mọi secret trong report/log.
- **Không** chạy lệnh phá huỷ; không đổi cấu hình server / quality gate profile / rule pack / CI.
- **Breaking-change thiếu test = KHÔNG auto-fix.** Finding bảo mật nhạy cảm/rủi ro cao = flag cho người.
- **Scope-bound:** không sửa/đọc ngoài phạm vi người dùng nêu hoặc scope của report.
- **Không tự commit** — con người **duyệt diff** trước merge/push (protected branch: mỗi commit).
- Ngôn ngữ **đo được**; LUÔN nêu **residual risk**. Findings phản ánh thời điểm quét, có thể sót — không
  tuyên bố "chặn / đảm bảo / loại bỏ / sửa triệt để".
