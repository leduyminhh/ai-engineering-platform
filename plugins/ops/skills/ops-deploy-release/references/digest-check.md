# Đối chiếu digest image trước SIT/UAT

Mục này là **mục chặn** của checklist tiền deploy ([release-checklist.md](release-checklist.md), mục 8). Image đang
chạy trên SIT/UAT phải là image đã quét ở skill `engineering-quality-gate` (file `references/trivy-image.md`).

## Digest đã quét

- [Unverified] Từ report Trivy: `Metadata.RepoDigests[0]`; phần sau `@` là digest, dạng `<tên-repo>@sha256:<digest-đã-quét>`.
- [Unverified] Từ máy build khi không có report Trivy (không chạy trên SIT/UAT):

```bash
docker image inspect --format '{{json .RepoDigests}}' <image>
```

Output là mảng JSON, ví dụ `["<tên-repo>@sha256:<digest-đã-quét>"]`.

## Digest đang chạy trên SIT/UAT

Chỉ đọc. Chạy các lệnh dưới đây chỉ sau khi người dùng xác nhận máy SIT/UAT và phạm vi (môi trường, service),
hoặc khi người dùng dán output vào chat.

[Unverified] Cú pháp các lệnh dưới đây chưa chạy thật trên Docker; chỉ đối chiếu với thiết kế nội bộ.

1. Image ID của container:

```bash
docker inspect --format '{{.Image}}' <container>
```

Output dạng `sha256:<image-id>`. Đây là image ID cục bộ của Docker, không phải digest registry.

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
| `đạt` | Mọi image của mọi service trong scope khớp digest đã quét | Ghi `đạt`. Mục này không tạo lý do NO-GO. |
| `không đạt` | Ít nhất một image lệch digest đã quét | Ghi service và image lệch. Đề xuất NO-GO. |
| `chưa đo` | Không lấy được digest: lệnh lỗi, thiếu quyền, chưa có xác nhận máy hoặc phạm vi, chưa có output người dùng dán | Coi là chưa đạt. Đề xuất NO-GO. |

- Mỗi service có thể có nhiều image: so từng image. Service không có image nào trong output thì ghi `chưa đo` cho service đó.
- Cả hai phía đều có digest: so digest với digest.
- Image không có RepoDigest ở một phía (ví dụ image build local chưa push registry): so image ID với image ID. [Unverified] Lấy image ID phía build bằng `docker image inspect --format '{{.Id}}' <image>` trên máy build. Ghi rõ "so theo image ID" trong báo cáo.
- Một phía chỉ có digest, phía kia chỉ có image ID: không so được. Ghi `chưa đo` cho image đó.
- [Inference] `RepoDigests` (digest manifest của registry) và image ID (định danh image cục bộ) là hai loại định danh khác nhau. Chỉ so cùng loại, không so chéo.

## Báo cáo

| Service | Image | Digest đã quét | Digest đang chạy | Cách so | Trạng thái |
|---|---|---|---|---|---|
| `<service>` | `<tên-image>` | `sha256:<digest-đã-quét>` | `sha256:<digest-đang-chạy>` | digest / so theo image ID | `đạt` / `không đạt` / `chưa đo` |

## Ranh giới

- Chỉ đọc. Không `docker pull`, `docker run`, `docker exec`, `docker compose up`, `docker compose pull`,
  `docker restart`, `docker rm` hoặc bất kỳ lệnh ghi nào lên SIT/UAT.
- Không đọc giá trị biến môi trường chứa secret; báo cáo chỉ nêu tên biến.
- Thiếu máy, quyền hoặc output: nêu rõ và đề nghị người dùng cung cấp (fail-loud), không suy ra digest.
