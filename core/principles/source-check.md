## Kiểm nguồn

Trước khi viết code gọi thư viện hay framework, kiểm API theo đúng phiên bản dự án đang dùng, không theo trí nhớ.

- Đọc phiên bản từ manifest và lockfile: `package.json` cùng lockfile, `pom.xml`, `build.gradle`, `pyproject.toml` hoặc `requirements*.txt`.
- Thứ tự nguồn tin cậy: docs chính thức đúng phiên bản, rồi changelog hoặc migration guide, rồi source thư viện đã cài, cuối cùng mới đến bài viết khác.
- API dùng lần đầu hoặc dễ đổi giữa các phiên bản: ghi deep link tới đúng mục docs vào báo cáo (`agent_result.evidence` hoặc body commit), không ghi vào comment code.
- Không có mạng hoặc WebFetch: gắn `[Unverified]` cho API đó trong báo cáo và làm tiếp, không chặn công việc.
