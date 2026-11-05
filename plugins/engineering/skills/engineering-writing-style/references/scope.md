# Phạm vi áp văn phong

| Loại văn bản | Áp văn phong | Lý do |
|---|---|---|
| README, docs cho người đọc | Cần | Người đọc là người, câu rỗng làm loãng ý |
| Mô tả PR/MR | Cần | Người duyệt đọc để nắm thay đổi và lý do |
| Release notes, CHANGELOG | Cần | Hướng người dùng cuối, cần ngắn và cụ thể |
| Body commit | Cần | Giải thích lý do thay đổi cho người đọc lịch sử |
| Trả lời chat cho người dùng | Cần | Đọc trực tiếp, câu dẫn thừa tốn thời gian |
| Phần mô tả trong spec/design | Cần | Phần văn xuôi; AC, bảng và ID giữ nguyên |
| Email, tin nhắn | Cần | Giao tiếp giữa người với người |
| Code và identifier | Không cần | Cú pháp, không phải văn xuôi |
| Comment code | Không cần | Theo quy tắc Comments của AGENTS.md |
| Header commit | Không cần | Theo định dạng `type(scope): summary` |
| Config JSON/YAML/TOML | Không cần | Máy đọc, đổi chữ có thể đổi hành vi |
| Log | Không cần | Bằng chứng, phải giữ nguyên |
| Output cho máy đọc (`agent_result`, ledger, JSON) | Không cần | Schema cố định |
| Prompt giao agent | Không cần | Cần chính xác, không cần mượt |
| Trích dẫn, văn bản pháp lý | Không cần | Phải giữ nguyên văn |
| Khối baseline AGENTS.md | Không cần | Chuẩn dùng chung, kiểm byte-identical |
| Test pin | Không cần | Chuỗi được so khớp nguyên văn |
