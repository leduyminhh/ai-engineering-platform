# Tổng kết phiên quét source, viết README và so sánh với AIP

Ngày: 2026-11-13. Nguồn: phiên làm việc này và các skill trong `ai-engineering-platform` (AIP). Chỗ nào chưa kiểm được thì đánh dấu [Unverified].

## 1. Mục tiêu và phạm vi

- Yêu cầu gốc: quét source, cập nhật README, nêu tổng quan project, chức năng và mối liên kết.
- Yêu cầu mở rộng giữa phiên: quét toàn bộ source, viết README cho root và từng project, gỡ mô tả lỗ hổng khỏi README, chuyển biến môi trường về README từng project, tạo `env.template` cho backend.
- Repo: monorepo gồm backend Java (Spring Boot 2.5.2, Java 17, 12 module Maven), micro-frontend `lgsp_fe` (React 17, webpack Module Federation), và các tool Node/Python.

## 2. Quy trình đã chạy

| Bước | Việc làm | Công cụ |
|---|---|---|
| 1 | Làm rõ yêu cầu: hỏi gom một thẻ (phạm vi quét, ngôn ngữ, nội dung, nơi lưu brief) | skill `core:brainstorming` |
| 2 | Quét có giới hạn: `pom.xml`, tên và port trong `application*`, route gateway, `@RequestMapping`, `@FeignClient`, `config.json` và webpack của FE, đầu file chính của tool | `grep`, `find`, đọc file |
| 3 | Ghi `brief.md` nháp, builder check bằng một subagent mới, chạy `route.mjs`, người dùng duyệt brief | brainstorming, 1 subagent sonnet |
| 4 | Người dùng yêu cầu quét toàn bộ: giao 5 agent haiku chạy song song, mỗi agent một nhóm thư mục không chồng nhau, mỗi project một README | 5 subagent haiku |
| 5 | Quét secret bằng regex trên README mới | `grep` |
| 6 | Giao 1 agent haiku viết README root và `api-service-structure` sau khi README con xong, để tổng hợp từ README con và đối chiếu code | 1 subagent haiku |
| 7 | Gỡ 24 dòng mô tả lỗ hổng khỏi README, gom về `docs/security-findings.md` | `sed`, ghi file |
| 8 | Chuyển danh sách biến môi trường từ README root về README từng project; bổ sung 12 biến còn thiếu | `grep`, sửa file |
| 9 | Tạo `api-service-structure/env.template`: gom nhóm, mô tả tiếng Việt, giá trị để trống | ghi file |

Số đo (từ thông báo của subagent): 6 agent haiku, tổng 375 lần gọi công cụ, khoảng 1,43 triệu token. Nhóm song song chạy khoảng 6 đến 11 phút mỗi agent; agent root khoảng 12 phút.

## 3. Kết quả

- 27 README: 3 sửa (`README.md`, `hshcMongoToOracle/README.md`, `lgsp_fe/README.md`) và 24 mới (12 module backend, `api-service-structure`, 4 package FE, `excel_tools` 3 file, `toolSyncFile` 4 file).
- `docs/security-findings.md`: 21 mục, mỗi mục có vị trí và trạng thái xác minh, không chứa giá trị bí mật.
- `api-service-structure/env.template`: 195 dòng, biến backend gom thành 9 nhóm.
- Trạng thái git tại thời điểm viết: branch `chore/readme-project-overview`, chưa có commit nào. 25 file đã stage (24 README mới và `env.template`), 3 README sửa chưa stage, `docs/` chưa theo dõi. Hai commit dự kiến chưa chạy.

## 4. Đã kiểm và chưa kiểm

Đã kiểm bằng lệnh:
- Quét regex secret trên 28 file trước commit: không thấy giá trị bí mật (ba khớp là số phiên bản và `127.0.0.1`).
- Dockerfile: cả 6 file (api-adapter-service, api-gateway, mercury-service, server-discovery, tra-cuu-service, user-service) dùng `adoptopenjdk/openjdk14`, trong khi pom đặt Java 17. Lần kiểm đầu đếm ra 12 vì hai glob `Dockerfile` và `dockerfile` khớp cùng file trên Windows; đã đếm lại.
- `tra-cuu-service` không có Feign hay RestTemplate.
- `ApiAdapterClient` trong `mercury-service` chỉ là field trong `BaseService`, không có lời gọi.
- Bốn file `.env` đang được git theo dõi; `permitAll` có ở 2 file; chuỗi `superadmin` chỉ có ở filter của `tra-cuu-service`; dòng log chuỗi kết nối có thật trong `hshcMongoToOracle`.

Chưa kiểm:
- Chưa chạy `mvn`, `npm`, `docker`: mọi lệnh build và chạy trong README là [giả định].
- Chưa render Mermaid; chỉ soát cú pháp bằng mắt (theo báo cáo agent).
- Chưa đọc từng README sau khi viết; chưa kiểm mỗi khẳng định bằng `file:line`.
- Phần lớn mô tả của agent về service impl, DTO, repo dựa trên grep và đếm, không đọc từng dòng (theo báo cáo agent). Chưa đọc test, `deploy/*` (đọc một phần).
- Mô tả nghiệp vụ ở README gốc suy luận từ tên package.

## 5. Sai lệch phát hiện trong quá trình

- Brief ghi FE chọn gateway theo origin; code dùng `baseURL` cố định, dòng ánh xạ origin bị comment.
- Brief ghi `host` có server Express; không có code Express, dockerfile chạy `serve -s`.
- Brief ghi `mercury-service` và `api-adapter-service` gọi nhau qua Feign; chỉ thấy khai báo, chưa thấy lời gọi.
- Lệnh `grep` của agent in dòng gốc có giá trị cấu hình ra log phiên (IP, mật khẩu mặc định). Giá trị không có trong README, nhưng nằm trong log.

## 6. So sánh với AIP

Nguồn so sánh: `engineering-spec-backfill`, `engineering-repo-audit`, `backend-init`, `frontend-init`, `core:brainstorming`, `README_VI.md` của AIP.

| Nhu cầu | AIP hiện có | Phiên này làm | Khoảng cách |
|---|---|---|---|
| Đọc toàn bộ source | `spec-backfill`: "không đọc toàn bộ code", dừng khi đủ để đề xuất năng lực. `repo-audit`: đọc có ngân sách theo điểm nóng, nêu phần chưa soát | Quét theo thư mục bằng 6 agent, đọc rộng nhưng vẫn có phần chưa đọc | AIP chủ đích không đọc hết; chưa có skill đọc toàn bộ theo module |
| Sinh tài liệu tổng quan project | `spec-backfill` chỉ ghi `docs/specs/<năng-lực>/spec.md`. `*-init` điền `project-knowledge/` từ câu trả lời của người dùng. README ghi G7 `engineering-codebase-onboarding` ở mục Roadmap "chưa làm" | README root, từng module, `env.template` | Chưa có skill quét brownfield rồi sinh `project-knowledge/` hay README |
| Mối liên kết giữa module | `engineering-diagram` (PlantUML, người dùng xác nhận) | Mermaid, mũi tên có căn cứ code, mũi tên chỉ khai báo ghi chú riêng | AIP có công cụ vẽ nhưng không tự suy liên kết từ code |
| Bằng chứng | `check-citations.mjs`, nguồn R loại 1 đến 4, nhãn proven và suspected, `file:line` | Nhãn [giả định] và [Unverified], kiểm mẫu bằng `grep` | Phiên này không có checker máy cho trích dẫn |
| An toàn secret | Cấm đọc `.env`, key, credential; thấy secret chỉ ghi loại và `file:line` | Chỉ đọc tên khóa trong `.env`, nhưng `grep` của agent in giá trị ra output | Cần quy tắc chặn in giá trị trong prompt agent |
| Cổng duyệt | Hai cổng: duyệt danh sách năng lực trước khi tạo subagent, duyệt diff trước commit | Duyệt brief, duyệt commit; không có cổng trước khi 6 agent chạy | Phiên này nhanh hơn nhưng thiếu cổng duyệt danh sách module |
| Định tuyến | `route.mjs` chọn workflow theo brief | Trả về `làm-trong-phiên`, nghĩa là không có workflow phù hợp | Xác nhận khoảng trống ở bảng trên |
| Phát hiện bảo mật | `repo-audit`, `engineering-quality-gate`, `workflow-security-review` | Ghi tay vào `docs/security-findings.md`, nhiều mục [Unverified] | Chưa chạy các skill chuyên trách; chưa có `file:line` đầy đủ |

## 7. Trả lời: AIP đã có khả năng đọc toàn bộ source và nêu chi tiết project chưa

Chưa có một skill hay workflow làm đúng việc này.

- Bằng chứng: không có skill nào tên `engineering-codebase-onboarding` hay `workflow-onboarding` trong `plugins/` và `build/`; README của AIP liệt kê chúng ở Roadmap "chưa làm" (mục G7). Lần chạy `route.mjs` trong phiên cho kết quả `làm-trong-phiên`.
- Gần nhất: `spec-backfill` (theo năng lực nghiệp vụ, ghi vào `docs/specs/`, chủ đích không đọc hết code), `repo-audit` (xếp hạng rủi ro, có ngân sách đọc), `*-init` (scaffold từ câu trả lời, không quét).
- [Inference] Suy ra từ danh sách skill và README; mình chưa kiểm các bản draft chưa publish (README ghi một phần skill `data-*` còn draft).

## 8. Đề xuất cho G7 (rút từ phiên này)

[Inference] Các bước đã chạy tốt có thể thành khung skill:

1. Kiểm kê module từ build file (`pom.xml`, `package.json`) và chốt danh sách ở một cổng duyệt.
2. Giao mỗi nhóm thư mục không chồng nhau cho một agent, mỗi agent ghi README của nhóm đó.
3. Tổng hợp root từ README con, đối chiếu code.
4. Quét secret trên đầu ra; cấm in giá trị cấu hình trong prompt agent.
5. Kiểm trích dẫn `file:line` bằng checker có sẵn của AIP.
6. Tách phát hiện bảo mật khỏi README sang file riêng, định tuyến sang `engineering-quality-gate`.
