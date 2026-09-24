# Lưu Trữ Tệp Dự Án Vật Lý (Project File Storage)

Tài liệu này quy định cấu trúc thư mục vật lý, cơ chế ghi tệp nguyên tử (Atomic Writes), tự phục hồi (Self-Healing) và bảo mật đường dẫn của từng dự án trong **Local AI Text to Speech Studio**.

---

## 1. Cấu Trúc Thư Mục Dự Án Vật Lý

Mỗi dự án tạo trong ứng dụng được gán một UUID v4 duy nhất và sở hữu một thư mục riêng biệt tại đường dẫn:

```text
<userData>/projects/<project-id>/
├── project.json              # Bản snapshot JSON metadata của dự án
├── script-original.txt       # Nội dung kịch bản văn bản gốc (UTF-8)
├── segments/                 # Thư mục chứa các đoạn kịch bản đã phân đoạn (Phase 3)
├── audio/                    # Thư mục chứa các file âm thanh thô từng đoạn (Phase 4)
├── subtitles/                # Thư mục chứa các file phụ đề SRT/VTT (Phase 5)
├── exports/                  # Thư mục chứa file âm thanh hoàn chỉnh cuối cùng đã ghép (Phase 5)
└── temp/                     # Thư mục xử lý tạm thời (cache âm thanh, file nối)
```

---

## 2. Ghi Tệp An Toàn & Nguyên Tử (Atomic Writes)

Để ngăn chặn việc tệp bị hỏng hoặc bị cắt ngang (truncated) khi xảy ra sự cố đột ngột (mất điện, treo hệ thống), mọi thao tác ghi tệp `project.json` và `script-original.txt` đều tuân thủ quy trình **Atomic Write**:

```text
[Dữ liệu mới]
     │
     ▼
Ghi ra tệp tạm thời: <target-path>.tmp.<timestamp>
     │
     ▼
fs.renameSync(<temp-path>, <target-path>)  (Thao tác nguyên tử ở tầng hệ điều hành)
     │
     ▼
[Tệp đích hoàn thiện, nguyên vẹn 100%]
```

Nếu quá trình ghi tệp tạm thời bị lỗi, tệp gốc chưa bao giờ bị ảnh hưởng.

---

## 3. SQLite là Single Source of Truth & Cơ chế Tự Phục Hồi (Self-Healing)

- Cơ sở dữ liệu SQLite là **nguồn sự thật duy nhất** (Single Source of Truth).
- Các tệp `project.json` và `script-original.txt` trong thư mục dự án đóng vai trò là bản snapshot vật lý, giúp người dùng dễ dàng xem trực tiếp nội dung bằng các phần mềm khác hoặc sao chép khi cần.
- **Tự phục hồi (Self-Healing):**
  Khi người dùng mở một dự án từ danh sách hoặc mở Studio:
  - Nếu `project.json` bị vô tình xóa mất: hệ thống tự động trích xuất metadata từ SQLite và tái tạo lại tệp.
  - Nếu `script-original.txt` bị xóa: hệ thống tự động tái tạo lại tệp từ trường `original_text` trong SQLite.

---

## 4. Bảo Mật Truy Cập Thư Mục (Security Guardrails)

Khi người dùng nhấn nút **"Mở thư mục"** trên giao diện:
1. Đường dẫn thư mục được chuẩn hóa bằng `path.resolve`.
2. Hệ thống kiểm tra nghiêm ngặt:
   - Đường dẫn có nằm trọn vẹn bên trong `<userData>/projects/` hay không.
   - Ngăn chặn triệt để mọi hành vi Path Traversal (`../`) hoặc trỏ ra ngoài hệ thống file nhạy cảm của hệ điều hành.
3. Sử dụng `electron.shell.openPath` an toàn chỉ sau khi xác thực hợp lệ.

---

## 5. Hỗ Trợ Toàn Diện Tiếng Việt (Unicode UTF-8)

Tất cả các tệp văn bản đều được ghi dưới mã hóa chuẩn **UTF-8**:
- Giữ nguyên toàn bộ 6 thanh điệu tiếng Việt (ngang, huyền, sắc, hỏi, ngã, nặng) và các ký tự đặc thù (`ă, â, đ, ê, ô, ơ, ư`).
- Kiểm thử thành công với các đoạn văn dài lên đến **100,000 ký tự** không suy giảm hiệu năng và không lỗi font.
