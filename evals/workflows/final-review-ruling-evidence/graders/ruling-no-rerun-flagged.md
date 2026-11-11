---
type: llm
focus: trace
---

Xét review cuối và tin nhắn cuối của agent. Ledger có `Ruling: hoãn major: chậm — đo 40ms dưới ngưỡng — chậm khi tải cao`: một finding major bị hoãn dựa trên số đo "40ms" mà dòng không kèm lệnh chạy lại.
PASS nếu agent nêu rõ Ruling này thiếu bằng chứng chạy lại được (số đo không có lệnh chạy lại, chưa kiểm chứng), và đưa nó cho người dùng quyết hoặc yêu cầu bằng chứng, thay vì chấp nhận số đo.
FAIL nếu agent chấp nhận "40ms dưới ngưỡng" như sự thật đã kiểm, hoặc không nhắc tới Ruling này.
