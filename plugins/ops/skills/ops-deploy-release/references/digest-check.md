# Đối chiếu digest image trước SIT/UAT

Mục này là **mục chặn** của checklist tiền deploy ([release-checklist.md](release-checklist.md), mục 8). Image đang
chạy trên SIT/UAT phải là image đã quét ở skill `engineering-quality-gate` (file `references/trivy-image.md`).

## Định danh đã quét

Định danh đã quét luôn lấy từ chính report Trivy của image đó (`--trivy <report>` ở skill `engineering-quality-gate`). Không lấy từ máy build.

- [Unverified] Report có `Metadata.RepoDigests` không rỗng: lấy `Metadata.RepoDigests[0]`; phần sau `@` là digest, dạng `<tên-repo>@sha256:<digest-đã-quét>`.
- [Unverified] Report không có `Metadata.RepoDigests` (trường thiếu được coi như mảng rỗng `[]`): lấy `Metadata.ImageID`, dạng `sha256:<image-id-đã-quét>`, rồi so theo image ID với image ID của container đang chạy (bước 1 ở mục dưới). Ghi "so theo image ID" trong report. Tên trường `Metadata.ImageID` chưa kiểm với report Trivy thật.
- Report không có định danh dùng được (không có `Metadata.RepoDigests` và `Metadata.ImageID` thiếu, rỗng hoặc không phải chuỗi): mục digest của image đó là `chưa đo`, đề xuất NO-GO.
- [Inference] `Metadata.ImageID` của Trivy chỉ trùng `docker inspect --format '{{.Image}}'` của container khi Docker lưu image theo config digest; với containerd image store, image ID có thể là digest của manifest hoặc index nên so theo image ID có thể ra `không đạt` giả: người xác nhận trên máy SIT/UAT thật.
- Không chạy `docker image inspect` ở máy build để lấy định danh phía đã quét. Image ID của máy build là của tag tại thời điểm chạy lệnh, có thể không phải image đã quét nếu tag được build lại sau lúc quét.

## Digest đang chạy trên SIT/UAT

Chỉ đọc. Chạy các lệnh dưới đây chỉ sau khi người dùng xác nhận máy SIT/UAT và phạm vi (môi trường, service),
hoặc khi người dùng dán output vào chat.

[Unverified] Cú pháp các lệnh dưới đây chưa chạy thật trên Docker; chỉ đối chiếu với thiết kế nội bộ.

1. Image ID của container:

```bash
docker inspect --format '{{.Image}}' <container>
```

[Unverified] Output dạng `sha256:<image-id>`. [Inference] Đây là image ID cục bộ của Docker, không phải digest registry. Khi so theo image ID, đây là định danh đang chạy so với `Metadata.ImageID` của report.

2. Digest của image đang chạy:

```bash
docker image inspect --format '{{json .RepoDigests}}' <image-id>
```

3. Liệt kê service và image trong compose:

```bash
docker compose images
```

[Unverified] Bảng output (container, repository, tag, image ID) theo phiên bản Docker Compose; kiểm trên máy SIT/UAT trước khi dựa vào cột.

[Inference] `docker inspect` không kèm `--format` in cả cấu hình container, có thể gồm giá trị biến môi trường. Chỉ dùng cú pháp `--format` ở trên và không dán output đầy đủ vào report.

## Quy tắc so khớp

| Trạng thái | Điều kiện | Hành động |
|---|---|---|
| `đạt` | Mọi image của mọi service trong scope khớp, so theo digest hoặc theo image ID (ghi rõ "so theo image ID" khi dùng image ID) | Ghi `đạt`. Mục này không tạo lý do NO-GO. |
| `không đạt` | Ít nhất một image lệch, so theo digest hoặc theo image ID | Ghi service và image lệch. Đề xuất NO-GO. |
| `chưa đo` | Ở bất kỳ phía nào không lấy được định danh cần để so (digest, hoặc image ID khi so theo image ID): lệnh lỗi hoặc không chạy được, thiếu quyền, chưa có xác nhận máy hoặc phạm vi, chưa có output người dùng dán; hoặc report Trivy không có định danh dùng được | Coi là chưa đạt. Đề xuất NO-GO. |

- Mỗi service có thể có nhiều image: so từng image với report Trivy của chính image đó (đợt nhiều image chạy script cho từng image). Image không có report Trivy, hoặc service không có image nào trong output, thì ghi `chưa đo`.
- Trạng thái chung của mục digest trong checklist: `không đạt` khi có ít nhất một image lệch, kể cả khi image khác `chưa đo`; không có image lệch nhưng có image `chưa đo` thì `chưa đo`; chỉ `đạt` khi mọi image của mọi service đều khớp. Cả `không đạt` lẫn `chưa đo` đều đề xuất NO-GO.
- Cả hai phía đều có digest: so digest với digest.
- Lệnh `docker image inspect --format '{{json .RepoDigests}}'` ở phía đang chạy lỗi, không chạy được hoặc thiếu quyền: định danh phía đó không lấy được, image ghi `chưa đo`; không chuyển sang so theo image ID dù lệnh lấy image ID vẫn chạy được.
- Một phía không có RepoDigest, nghĩa là report Trivy có `Metadata.RepoDigests` thiếu hoặc rỗng, hoặc lệnh trên ở phía đang chạy chạy được và trả mảng rỗng `[]` (ví dụ image local chưa push registry): so theo image ID. [Unverified] Docker có thể trả `null` thay cho `[]`; coi `null` như mảng rỗng. Phía đã quét lấy `Metadata.ImageID` từ chính report; phía đang chạy lấy bằng `docker inspect --format '{{.Image}}' <container>` (bước 1 ở trên). So image ID với image ID và ghi rõ "so theo image ID" trong báo cáo.
- Report không có định danh dùng được thì không thay bằng image ID lấy từ máy build: image đó ghi `chưa đo` và đề xuất NO-GO.
- Nếu một phía không lấy được định danh cần để so, image đó ghi `chưa đo`, kể cả khi phía kia lấy được.
- [Inference] `RepoDigests` (digest manifest của registry) và image ID (định danh image cục bộ) là hai loại định danh khác nhau. Chỉ so cùng loại, không so chéo.

## Báo cáo

| Service | Image | Định danh đã quét | Định danh đang chạy | Cách so | Trạng thái |
|---|---|---|---|---|---|
| `<service>` | `<tên-image>` | `sha256:<digest-hoặc-image-id-đã-quét>` | `sha256:<digest-hoặc-image-id-đang-chạy>` | digest / so theo image ID | `đạt` / `không đạt` / `chưa đo` |

- Cột "Định danh đã quét" ghi kèm trường của report đã dùng (`Metadata.RepoDigests[0]` hoặc `Metadata.ImageID`). Report không có định danh dùng được thì để `chưa có` và trạng thái `chưa đo`.

## Ranh giới

- Chỉ đọc. Không `docker pull`, `docker run`, `docker exec`, `docker compose up`, `docker compose pull`,
  `docker restart`, `docker rm` hoặc bất kỳ lệnh ghi nào lên SIT/UAT.
- Không đọc giá trị biến môi trường chứa secret; báo cáo chỉ nêu tên biến.
- Không cài tool lên SIT/UAT hoặc vào project. Thiếu tool (Docker, Trivy) thì ghi `chưa đo` và đề nghị người dùng cài hoặc dán output.
- Thiếu máy, quyền hoặc output: nêu rõ và đề nghị người dùng cung cấp (fail-loud), không suy ra digest.
