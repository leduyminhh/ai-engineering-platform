# Định dạng đầu ra

## 1. Chọn định dạng

Hỏi một lần ở bước 6 (bỏ qua nếu người dùng đã nói từ đầu):

| Lựa chọn | Sinh ra |
|---|---|
| `md` (mặc định) | `tasks.md` |
| `md + excel` | `tasks.md` + `tasks.xlsx` (môi trường hỗ trợ) hoặc `tasks.csv` (fallback) |

`tasks.md` **luôn sinh** và là **nguồn sự thật**. Excel là bản xuất: sửa task thì sửa `tasks.md` rồi xuất lại;
không sửa ngược từ Excel.

## 2. Vị trí

```
docs/requests/<yyyy-mm-dd>-<slug>/
├── requirement.md   # có sẵn nếu đã chạy engineering-spec-writing — KHÔNG ghi đè
├── plan.md          # có sẵn → chỉ thêm 1 dòng link tới tasks.md
├── tasks.md         # nguồn sự thật
└── tasks.xlsx       # hoặc tasks.csv — chỉ khi chọn excel
```

- Đã có thư mục cho yêu cầu này → ghi vào đó; chưa có → tạo theo ngày hôm nay + slug tiếng Anh kebab-case.
- `tasks.md` **đã tồn tại** → KHÔNG ghi đè im lặng. Hỏi người dùng: (a) cập nhật — giữ nguyên Owner/Trạng thái đã
  điền của các task trùng ID, thêm task mới, đánh dấu task bị bỏ; hoặc (b) ghi đè toàn bộ.
- Dòng link thêm vào `plan.md`: `Chi tiết task: [tasks.md](tasks.md)`.

## 3. Cấu trúc `tasks.md`

````markdown
# Tasks: <tên yêu cầu>

## 1. Tóm tắt

- Nguồn input: <file / mô tả>
- Use case: <n> · Task: <n> (CT <n> · DB <n> · BE <n> · FE-UI <n> · FE-INT <n> · E2E <n>)
- Size: S <n> · M <n>

## 2. Use case

| ID | Tên | Actor | AC | Nguồn |
|---|---|---|---|---|

## 3. Bảng tổng task

| ID | UC | Loại | Tiêu đề | Size | Phụ thuộc | Owner | Trạng thái | Skill gợi ý |
|---|---|---|---|---|---|---|---|---|
| [UC01-CT-01](#uc01-ct-01) | UC01 | CT | Chốt contract đăng ký | S | — |  | Todo | backend-api-contract |

## 4. Thứ tự thực hiện gợi ý

1. UC01-CT-01, UC01-DB-01
2. Song song: UC01-BE-01 ∥ UC01-FE-01
3. UC01-FE-02
4. UC01-E2E-01

## 5. Chi tiết task

<a id="uc01-ct-01"></a>
### UC01-CT-01 — Chốt contract đăng ký

<header chung + mục theo loại — task-template-common / task-template-backend / task-template-frontend>

## 6. Câu hỏi mở & giả định

| # | Câu hỏi | Ảnh hưởng tới | Trạng thái |
|---|---|---|---|
````

Mỗi task có `<a id="<id chữ thường>"></a>` ngay trên heading; bảng tổng và Excel link tới anchor này, không phụ
thuộc cách renderer sinh anchor từ heading tiếng Việt.

## 4. Excel

### Sheet và cột

| Sheet | Cột |
|---|---|
| `Tasks` | ID · UC · Loại · Tiêu đề · Size · Phụ thuộc · Owner · Trạng thái · Skill gợi ý · AC · Link chi tiết |
| `UseCases` | ID · Tên · Actor · AC · Nguồn |
| `OpenQuestions` | # · Câu hỏi · Ảnh hưởng tới · Trạng thái |

- Cột AC: nhiều AC trong một ô, mỗi AC một dòng.
- Link chi tiết: `tasks.md#<id chữ thường>` (vd `tasks.md#uc01-be-01`). Excel không chứa chi tiết đầy đủ để tránh hai
  nguồn lệch nhau.
- Số dòng sheet `Tasks` phải bằng số task trong bảng tổng của `tasks.md`.

### Chọn `.xlsx` hay CSV

1. Môi trường có công cụ tạo xlsx (skill xlsx của provider, hoặc Python có `openpyxl`) → sinh `tasks.xlsx` 3 sheet.
   Kiểm `openpyxl`: `python -c "import openpyxl"` (exit 0 = có).
2. Không có → sinh `tasks.csv` (chỉ sheet `Tasks`) và **báo rõ** đã fallback CSV vì môi trường không có công cụ tạo
   xlsx. Không tự cài package vào môi trường người dùng khi chưa hỏi.

### Quy tắc CSV

- Mã hoá **UTF-8 có BOM** (Python: `encoding="utf-8-sig"`) để Excel trên Windows hiển thị đúng dấu tiếng Việt.
- Quote **mọi ô** (`csv.QUOTE_ALL`): ô chứa dấu phẩy, ngoặc kép hoặc xuống dòng (AC nhiều dòng) vẫn đúng cột;
  ngoặc kép trong nội dung được nhân đôi `""` (module `csv` tự làm).
- Dấu phân cách `,`.

### Mẫu sinh file (Python, chạy tạm — không thêm vào mã nguồn project)

```python
import csv

TASK_COLS = ["ID", "UC", "Loại", "Tiêu đề", "Size", "Phụ thuộc", "Owner",
             "Trạng thái", "Skill gợi ý", "AC", "Link chi tiết"]


def write_tasks_csv(path, tasks):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=TASK_COLS, quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(tasks)


def write_tasks_xlsx(path, tasks, use_cases, questions):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font

    wb = Workbook()
    sheets = [
        ("Tasks", TASK_COLS, tasks),
        ("UseCases", ["ID", "Tên", "Actor", "AC", "Nguồn"], use_cases),
        ("OpenQuestions", ["#", "Câu hỏi", "Ảnh hưởng tới", "Trạng thái"], questions),
    ]
    for i, (name, cols, rows) in enumerate(sheets):
        ws = wb.active if i == 0 else wb.create_sheet()
        ws.title = name
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in rows:
            ws.append([r.get(k, "") for k in cols])
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A2"
    wb.save(path)
```

`tasks`, `use_cases`, `questions` là `list[dict]` với key đúng tên cột; AC là chuỗi nhiều dòng (`"\n"`).
