# Black Duck — thu thập, phân loại lỗ hổng phụ thuộc, và bump version

Mục tiêu bước Black Duck: rút danh sách **component vulnerability** (CVE + CVSS) và **license risk** của
dependency, để gộp cùng Sonar rồi triage. Có **hai cách thu thập, KHÔNG dùng web API**.

## Cách thu thập

### (a) Chạy `detect` CLI tại chỗ

Điều kiện: có cấu hình project cho Black Duck `detect` và token cấp qua **biến môi trường**. Skill chỉ nêu
**tên biến**, KHÔNG đọc/in giá trị:

- `BLACKDUCK_URL` — URL Black Duck server.
- `BLACKDUCK_API_TOKEN` — API token.

Chạy `detect` để quét dependency của project (nó dò manifest theo hệ build và dựng BOM). Để lấy kết quả về
**không qua web API**, ưu tiên cho `detect` **xuất report/BOM ra file** rồi đọc (xem (b)). Thiếu cấu hình
hoặc token → nói rõ, chuyển sang (b) nếu có BOM sẵn, hoặc đề nghị người bổ sung.

### (b) Đọc BOM / report đã xuất sẵn

An toàn nhất, không cần token:

- **JSON report** của Black Duck (danh sách component + vulnerability + license).
- **SPDX** (`*.spdx`, `*.spdx.json`) hoặc **CycloneDX** (`bom.json`, `*.cdx.json`) — SBOM chuẩn; đọc danh
  sách component@version và, với CycloneDX, mảng `vulnerabilities[]` (id CVE, ratings/CVSS, `affects`).

Dò output thư mục `detect`/CI hoặc file người dùng chỉ định. Không thấy → hỏi đường dẫn, đừng bịa.

## Phân loại finding

- **Component vulnerability:** `component@version` + **CVE id** + **CVSS severity**
  (`Critical` ≈ 9.0–10.0 · `High` ≈ 7.0–8.9 · `Medium` ≈ 4.0–6.9 · `Low` ≈ 0.1–3.9). Ghi kèm **fixed
  version** nếu report nêu (có bản vá hay chưa).
- **License risk:** license của component + mức rủi ro theo policy (vd copyleft mạnh trong sản phẩm phân
  phối). Đây là **advisory** — tác động pháp lý/chính sách, **người quyết**, không "sửa" bằng bump version.

## Triage vulnerability phụ thuộc

Theo thứ tự ưu tiên: **Critical/High có bản vá** trước.

1. **Có bản vá (fixed version tồn tại):** đề xuất / áp **bump version** trong manifest **đúng hệ phụ thuộc**:

   | Hệ | Manifest | Ghi chú bump |
   |----|----------|--------------|
   | Node | `package.json` (+ lockfile) | cập nhật range + regenerate lockfile; ưu tiên bump **patch/minor** |
   | Java (Maven) | `pom.xml` | đổi `<version>`; chú ý `dependencyManagement` / BOM cha |
   | Java (Gradle) | `build.gradle`(`.kts`) | đổi khai báo version / `platform`/BOM |
   | Python | `requirements.txt` / `pyproject.toml` | ghim version vá; đồng bộ lock nếu có |
   | Go | `go.mod` | `require` version vá; chạy tidy để đồng bộ `go.sum` |

   Sau bump: **chạy build/test** xác nhận không vỡ. Với **transitive dependency**, bump qua đúng cơ chế của
   hệ (override/resolution/`dependencyManagement`) thay vì sửa trực tiếp cây con.

2. **Không có bản vá:** không bump liều. Cân nhắc **workaround** (tắt đường dùng dễ khai thác), **replace**
   (đổi sang thư viện tương đương còn bảo trì), hoặc **accept-with-note** (ghi rõ lý do + residual risk +
   ngày rà lại). Ghi vào mục Hoãn của report.

3. **License risk:** **advisory** — nêu component + license + mức rủi ro, để **người quyết**; không tự đổi.

## Quy tắc an toàn khi bump

- **KHÔNG tự bump major rủi ro khi thiếu test** bảo chứng — major thường có breaking change. Có thể **đề
  xuất** bump major kèm cảnh báo, nhưng để **người quyết** và cần test trước khi áp.
- Ưu tiên bump **tối thiểu** đủ vá (patch → minor → major). Một bump chỉ "an toàn để tự áp" khi build/test
  xanh và không đổi hành vi quan sát được.
- Token qua biến môi trường; KHÔNG in/log giá trị. KHÔNG đổi cấu hình server/policy.

Sau khi có findings Black Duck, gộp cùng Sonar ([sonarqube.md](sonarqube.md)) rồi theo vòng chung ở
[triage-and-fix.md](triage-and-fix.md). Findings phản ánh **thời điểm quét** và dữ liệu BOM sẵn có — có thể
sót; nêu **residual risk** trong report, không tuyên bố tuyệt đối.

## Đọc cho ngưỡng go-live

Cờ `--blackduck <file.json>` đọc CycloneDX JSON đã xuất, mỗi lần chạy một file. Script chỉ đọc file: không gọi
server Black Duck, không đọc `BLACKDUCK_URL` hay `BLACKDUCK_API_TOKEN`. Black Duck là nguồn bắt buộc của
Critical/High, RCE và KEV (`scripts/go-live-gate.mjs`, `SCAN_SOURCES` và `REQUIRED`).

[Unverified] JSON gốc của Black Duck (chưa qua CycloneDX) chưa kiểm cấu trúc; nếu không có `vulnerabilities` thì
script exit 2. Cách xuất CycloneDX theo phiên bản Black Duck của tổ chức chưa kiểm; người dùng xuất và đưa file.

### Trường đọc

| Trường | Bắt buộc | Script dùng để |
|---|---|---|
| `vulnerabilities[]` | có, mảng | Thiếu mảng → exit 2. License không được đọc |
| `vulnerabilities[].id` | có, chuỗi | Phần đầu của khoá; bắt đầu bằng `CVE-` thì là CVE |
| `vulnerabilities[].ratings[]` | có, mảng không rỗng | Mức cao nhất trong các `severity` được lấy |
| `vulnerabilities[].ratings[].severity` | có | Mức theo bảng dưới |
| `vulnerabilities[].affects[]` | có, mảng không rỗng | Mỗi phần tử thành một finding |
| `vulnerabilities[].affects[].ref` | có, chuỗi | Tài sản: `component@version`, là phần sau của khoá |
| `vulnerabilities[].cwes[]` | không | Mảng số nguyên; sai kiểu → exit 2 |
| `vulnerabilities[].description` | không | Chỉ để xét nhãn "remote code execution" |

[Unverified] Tên trường `cwes` và `description` theo đặc tả CycloneDX; chưa kiểm với report Black Duck thật.

### Mức độ

| `ratings[].severity` | Mức chuẩn hoá |
|---|---|
| critical | Critical |
| high | High |
| medium | Medium |
| low | Low |
| none, unknown, info | Info |

Script không phân biệt hoa thường. Giá trị khác bảng → exit 2.

### Khoá và đếm

- Khoá finding là `id@ref`, ví dụ `CVE-YYYY-NNNN@<tên-component>@<phiên-bản>`.
- Một vulnerability có nhiều `affects[]` cho nhiều finding, mỗi `ref` một finding.
- CVE cùng id ở image (Trivy, khoá `CVE@image`) và ở component (BlackDuck, khoá `CVE@component@version`) được
  đếm hai lần, vì là hai tài sản khác nhau. Điều này làm số Critical/High cao hơn số CVE duy nhất; ghi cạnh số đếm
  trong report.
- `affects` thiếu hoặc rỗng → exit 2, không bỏ qua âm thầm.

### Ví dụ đầu vào

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "vulnerabilities": [
    {
      "id": "CVE-YYYY-NNNN",
      "description": "<mô tả>",
      "cwes": [502],
      "ratings": [{ "severity": "critical" }, { "severity": "low" }],
      "affects": [{ "ref": "<tên-component>@<phiên-bản>" }]
    }
  ]
}
```

### --na

`--na blackduck=<bằng chứng>` chỉ khi bằng chứng cho thấy phạm vi không có BOM hoặc không có dependency quản lý
bằng manifest. Bằng chứng ghi cụ thể (manifest đã kiểm, lệnh đã chạy).
