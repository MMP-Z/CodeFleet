# ĐẶC TẢ GIAO DIỆN (UI_SPEC)

> **Phiên bản:** 0.4
> **Cập nhật lần cuối:** 2026-11-02
> **Đi kèm:** `PROJECT_PLAN.md` (v0.9) và bộ mockup `Document/UI_Mockups/`

---

## 0. Cách dùng tài liệu này

**Thứ tự ưu tiên khi mâu thuẫn:**

1. `PROJECT_PLAN.md`: luật, kiến trúc, phạm vi.
2. `UI_SPEC.md` (file này): hành vi, trạng thái, dữ liệu của từng màn.
3. `UI_Mockups/*.html`: hình dáng, màu, khoảng cách, câu chữ.

Mockup chỉ vẽ **một khoảnh khắc**. Mọi thứ về *khi nào*, *vì sao*, *lấy dữ liệu ở đâu* nằm ở file này. Nếu mockup và file này khác nhau, làm theo file này. Nếu file này và PROJECT_PLAN khác nhau, **dừng lại và hỏi chủ dự án** (Luật A3).

**Quy ước trong tài liệu:**

| Ký hiệu | Nghĩa |
|---|---|
| `[GIỮ CHỖ]` | Dữ liệu trong mockup chỉ để minh hoạ. **Cấm hard-code.** Lấy từ adapter, cấu hình, hoặc chờ Phase 0 xác minh. |
| `[CHƯA CHỐT]` | Có trong mockup nhưng **chưa có trong PROJECT_PLAN** hoặc còn mâu thuẫn. Không làm cho tới khi chủ dự án chốt (xem mục 8). |
| `[SAU MVP]` | Hiện trong mockup để thấy hướng đi, không làm ở MVP. Ẩn sau feature flag (Luật P6). |
| `MH-xx` | Mã màn hình, khớp với tên file mockup `xx-*.html`. |

**Mỗi khi sửa file này:** tăng phiên bản, thêm dòng vào mục 10, và ghi vào Nhật ký của PROJECT_PLAN (Luật T1, T2).

---

## 1. Nguyên tắc chung (áp dụng cho mọi màn)

| # | Nguyên tắc | Nguồn |
|---|---|---|
| G1 | Mặc định dùng lời thường. Thuật ngữ (diff, commit, token, model id…) chỉ hiện ở mức xem "Toàn bộ", tab "Điều phối chi tiết", hoặc khi bật "Hiện thuật ngữ kỹ thuật". | U1 |
| G2 | Mọi thông báo lỗi có **ít nhất một nút hành động** tiếp theo. Không có lỗi "cụt". | U2 |
| G3 | Số liệu không chính thức luôn có nhãn: `ước lượng`, `đã phát hiện`, `không rõ`. | U3, 6.6 |
| G4 | Mọi chuỗi giao diện nằm trong file chuỗi (`renderer/i18n/vi.json`), không viết thẳng trong component. Khoá đặt theo màn: `mh03.composer.placeholder`. | U4 |
| G5 | Không bao giờ ghi đè phần người dùng tự sửa mà không hỏi. | U5, 4.7 |
| G6 | Không hard-code tên model, tên gói, lệnh cài CLI. Tất cả lấy từ `listModels()`, `detect()`, hoặc file cấu hình. | P10, A4 |
| G7 | Renderer **không** gọi Node, không đọc file, không chạy lệnh. Mọi thứ đi qua IPC có kiểu và zod (mục 7). | P2, P3, B1 |
| G8 | Hành động có thể gây hại phải qua hộp thoại xin phép (MH-04). | B5 |
| G9 | Mọi thao tác của AI hoàn tác được. Nút hoàn tác hiện ở mọi bước có trạng thái `done`. | 1.4 |
| G10 | Tên app chính thức là **CodeFleet** (ADR-011), lấy từ một hằng số duy nhất (`APP_NAME`). | ADR-011 |

### 1.1 Khả năng truy cập (bắt buộc)
- Mọi nút bấm được bằng bàn phím; viền focus `2px solid primary`, `outline-offset: 2px`.
- Vùng bấm tối thiểu cao 32px (nút nhỏ) / 36px (chip, tab) / 44px (nút chính ở ô chat).
- Tab dùng `role="tablist"`/`role="tab"`/`aria-selected`. Nhóm nút chọn mức dùng `aria-pressed`. Popover dùng `role="dialog"` + `aria-expanded` trên nút mở. Hộp thoại chặn dùng `aria-modal="true"` và giữ focus bên trong; `Esc` đóng (trừ MH-04 và MH-05: `Esc` = chọn phương án an toàn nhất, tức "Không cho phép" / "Để sau").
- Chấm màu AI luôn đi kèm tên AI bằng chữ (không truyền thông tin chỉ bằng màu).

### 1.2 Kích thước cửa sổ
- Tối thiểu `1024×680` (ADR-017).
- Khung phải (`aside`) có nút thu gọn / mở rộng; dưới `1180px` chiều rộng khung phải có thể thu gọn hoặc xếp xuống dưới khung chat (ADR-017). Chế độ tối toàn app để `[SAU MVP]` (ADR-017).

---

## 2. Design tokens

Lấy nguyên từ mẫu C. Chuyển thành `tailwind.config.ts` → `theme.extend.colors` với đúng tên dưới đây. **Không thêm màu mới** nếu chưa ghi vào bảng này.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `bg` | `#F4F5F2` | Nền app |
| `surface` | `#FFFFFF` | Thẻ, header, ô chat |
| `surface-2` | `#FBFBF9` | Khung phải, đầu thẻ, ô nhập |
| `border` | `#DCE0DB` | Viền chính |
| `line` | `#ECEEEA` | Đường chia trong thẻ, nền nhóm nút |
| `dashed` | `#C5CCC7` | Viền nét đứt "Vì sao chọn cách này" |
| `text` | `#16201D` | Chữ chính |
| `muted` | `#55625D` | Chữ phụ |
| `primary` | `#0B6B5D` | Nút chính, tab đang chọn, bong bóng người dùng |
| `primary-soft` | `#DDF0EA` | Nền giải thích ngắn, thông báo thông tin |
| `primary-ink` | `#0B3F37` | Chữ trên `primary-soft` |
| `primary-row` | `#EEF7F4` | Dòng bước đang xem |
| `warn-bg` / `warn-ink` / `warn-border` | `#FFEFC9` / `#7A4F00` / `#E8CF8E` | Sắp hết, rủi ro, tạm dừng, "ước lượng" |
| `ok-bg` / `ok-ink` | `#DDF3E6` / `#17663F` | Xong, chính thức, rủi ro thấp |
| `info-bg` / `info-ink` | `#DDEBFA` / `#0B5CAD` | Đang làm, file "Sửa" |
| `danger` / `danger-bg` / `danger-ink` | `#D23B30` / `#FCE9E6` / `#9B231B` | Hết hạn mức, lỗi, xoá |
| `bar-ok` / `bar-low` | `#2E9E65` / `#D9930D` | Thanh tiến độ hạn mức |
| `dark` / `dark-2` / `dark-line` | `#0C1210` / `#19231F` / `#24312C` | Tab "Điều phối chi tiết" |
| `dark-text` / `dark-muted` | `#D8E3DE` / `#93A79F` | Chữ trên nền tối |
| `ai-claude` / `ai-codex` / `ai-gemini` | `#C2603A` / `#2F5FD0` / `#7A4FD0` | Chấm màu AI trên nền sáng |
| `ai-claude-d` / `ai-codex-d` / `ai-gemini-d` | `#E08A64` / `#6F9BFF` / `#B79CFF` | Tên AI trên nền tối |

> [!IMPORTANT]
> Màu AI **không gắn cứng theo tên CLI** trong code. Màu là thuộc tính của adapter (`AgentAdapter.color`), AI thêm qua plugin khai báo màu trong manifest; thiếu thì dùng `muted`.

**Chữ:** `Be Vietnam Pro` (400/500/600/700) cho giao diện; `JetBrains Mono` (400/500/700) cho code, đường dẫn, nhật ký. **Đóng gói font vào app** (không tải từ Google Fonts lúc chạy, vì CSP và máy không có mạng).

**Cỡ chữ:** cơ bản 14px / line-height 1.5. Phụ 12px. Code 12.5px / 1.7. Tiêu đề trang 22px, tiêu đề thẻ 17px, tiêu đề nhỏ 15px.

**Bo góc:** chip/pill `999px`; thẻ `12px`; nút, ô code `8px`; ô nhập, nhóm tab `10px`; hộp thoại `14px`.

**Bóng:** popover `0 8px 24px rgba(22,32,29,.14)`; tab đang chọn `0 1px 2px rgba(22,32,29,.15)`; hộp thoại `0 20px 48px rgba(12,18,16,.28)`.

---

## 3. Bảng ánh xạ trạng thái (dùng chung)

### 3.1 Trạng thái bước (`steps.status`)

| Giá trị DB | Nhãn hiển thị | Kiểu pill | Ghi chú |
|---|---|---|---|
| `pending` | Chờ | `wait` | |
| `running` | Đang làm | `run` | |
| `done` | Xong | `ok` | Hiện nút hoàn tác |
| `failed` | Chưa làm được | `danger` | Phải kèm nút "Thử lại" / "Nhờ AI sửa" (G2) |
| `undone` | Đã hoàn tác | `wait` | Hiện nút "Làm lại bước này" |
| `waiting_permission` | Đang chờ bạn cho phép | `warn` | MH-04 (lưu DB theo ADR-014) |
| `conflict` | Cần bạn xác nhận | `warn` | MH-05 (lưu DB theo ADR-014) |
| `paused` | Tạm dừng | `warn` | MH-07 (lưu DB theo ADR-014) |

> [!NOTE]
> Cả 8 trạng thái trên đều được lưu trực tiếp trong `steps.status` theo ADR-014 để khôi phục đúng trạng thái sau khi tắt/mở lại ứng dụng.

### 3.2 Trạng thái hạn mức (`QuotaSnapshot.status`)

| Giá trị | Chip | Thanh | Router |
|---|---|---|---|
| `ok` (< 80%) | nền trắng, viền `border` | `bar-ok` | Dùng bình thường |
| `low` (≥ 80%) | `warn-*` | `bar-low` | Giảm ưu tiên |
| `exhausted` | `danger-*` | `danger` | Loại ô đó tới `resetsAt` |
| `unknown` | nền `line`, chữ `muted`, chữ "không rõ" | không vẽ thanh | Vẫn dùng; gặp rate limit thì chuyển tầng C |

Ngưỡng 80% đọc từ cài đặt (MH-11), mặc định 80.

**Chữ trên chip theo CLI** (PLAN 6.6):
- `scope = shared` hoặc `unknown`: `"{max usedPercent}%"`, thêm `" · ước lượng"` nếu `source = estimated`.
- `scope = model`: liệt kê model khác `ok`, ví dụ `"Pro hết · Flash 23%"`. Tối đa 2 model; hơn thì `"1/3 model hết"`.
- Hết tất cả: `"Đã hết"`.
- Màu chip lấy theo trạng thái **xấu nhất còn ảnh hưởng tới người dùng**: hết tất cả → `danger`; có ít nhất một model `low`/`exhausted` nhưng vẫn còn model dùng được → `warn`.

### 3.3 Nguồn hạn mức (`source`)

| Giá trị | Nhãn | Pill |
|---|---|---|
| `official` | Số liệu từ CLI (chính thức) | `ok` |
| `estimated` | Ước lượng từ log trên máy bạn | `warn` |
| `detected` | Đã phát hiện khi CLI báo | `danger` |
| `unknown` | Không rõ | `wait` |

### 3.4 Mức rủi ro và nhãn rủi ro

- `steps.risk_level`: `low` → pill `ok` "Rủi ro: thấp"; `medium` → `warn` "Rủi ro: trung bình"; `high` → `warn` + câu cụ thể theo nhãn, ví dụ "Liên quan đăng nhập: nên đọc kỹ".
- `step_files.risk_tags` → câu lời thường (cấu hình trong `project/risk.ts`, có khoá i18n):
  `auth` "Liên quan đăng nhập", `payment` "Liên quan thanh toán", `user_data` "Chạm vào dữ liệu người dùng", `secrets` "Chạm vào file khoá bí mật (.env)", `migration` "Đổi cấu trúc dữ liệu", `new_dependency` "Thêm thư viện mới", `network` "Gọi ra Internet".

### 3.5 Loại thay đổi file (`step_files.change`)

`added` → "Thêm mới" (`ok`); `modified` → "Sửa" (`run`); `deleted` → "Xoá" (`danger`).

### 3.6 Bậc model (`ModelInfo.tier`)

`strong` "Mạnh" (`brand`); `balanced` "Cân bằng" (`wait`); `fast` "Nhanh" (`wait`); `unknown` "Chưa xếp bậc" (`warn`).

---

## 4. Thành phần dùng chung

Đặt ở `src/renderer/components/`. Mỗi thành phần một file, có story hoặc trang thử nội bộ (`/dev/components`, ẩn sau feature flag).

| Thành phần | Props chính | Trạng thái phải hỗ trợ | Mockup tham khảo |
|---|---|---|---|
| `AppHeader` | `project?`, `activeNav`, `showQuota` | không có dự án (MH-01, 02) | mọi màn |
| `ProjectPill` | `name`, `path` | đường dẫn dài → rút gọn giữa | MH-03 |
| `QuotaBar` | `snapshots: QuotaSnapshot[]` | đang tải, lỗi đọc | header |
| `QuotaChip` | `agentId`, `summary`, `status`, `source` | `ok`/`low`/`exhausted`/`unknown` | header, MH-12 |
| `QuotaPopover` | `agentId`, `snapshots` | `scope` shared/model/unknown | MH-03 bấm chip |
| `PlanCard` | `steps: StepVM[]`, `doneCount` | 0 bước (đang lập kế hoạch) | MH-03 |
| `StepRow` | `step`, `active`, `onViewCode` | mọi trạng thái ở 3.1; có/không ghi chú; có/không nhãn rủi ro | MH-03, 04, 05, 07 |
| `SystemLine` | `text`, `tone` | | MH-03, 07 |
| `Composer` | `running`, `aiPick`, `onSend`, `onStop` | đang chạy (hiện "Dừng"), trống, đang gửi | MH-03 |
| `AiPicker` | `value: 'auto' \| ModelRef` | tự chọn; ghim AI; ghim AI+model (Nâng cao) | MH-03 |
| `SideTabs` | `tab`, `onChange` | | MH-03 |
| `PreviewPane` | `state`, `url` | đang khởi động, đang chạy, lỗi build, không phải dự án web | MH-03, 12 |
| `CodeViewer` | `stepId`, `level` | chưa chạy, có code, đã hoàn tác | MH-03 |
| `CodeLevelSwitch` | `level: 'summary' \| 'diff' \| 'full'` | | MH-03 |
| `DiffBlock` | `lines: {sign, text}[]` | dòng dài → cuộn ngang trong dòng | MH-03, 05 |
| `FileCode` | `path`, `lines`, `selection?` | chọn dòng → hiện "Hỏi đoạn này làm gì?" | MH-03 |
| `WhyBox` | `text` | | MH-03 |
| `UndoButton` | `stepId`, `undone` | đang khôi phục | MH-03, 09 |
| `OrchestrationLog` | `reasons`, `entries` | cuộn tự động khi có dòng mới, dừng tự cuộn khi người dùng cuộn lên | MH-03 tab 3 |
| `PermissionDialog` | `request: PermissionRequest` | xem lệnh chính xác (thu gọn) | MH-04 |
| `ConflictDialog` | `conflict: FileConflict` | 3 lựa chọn | MH-05 |
| `Notice` | `tone: info/warn/danger/neutral`, `actions[]` | **bắt buộc có ≥1 action khi tone = danger** (G2) | khắp nơi |
| `Toast` | `tone`, `title`, `body`, `actions` | tự ẩn sau 8s trừ tone `danger` | MH-07 |
| `Pill`, `Button`, `Toggle`, `Segmented`, `Progress`, `Dialog` | | | `styles.css` |

---

## 5. Đặc tả từng màn

> Mỗi màn có: **Mục đích · Phase · Vào từ đâu · Dữ liệu · Trạng thái · Hành vi · Giữ chỗ / chưa chốt · Tiêu chí kiểm tra.**
> Tên kênh IPC ở mục 7.

### MH-01 · Khởi động lần đầu — `01-khoi-dong.html`

- **Mục đích:** phát hiện CLI đã cài/đã đăng nhập, hướng dẫn phần còn thiếu, kiểm tra `git` (PLAN 6.8, B6).
- **Phase:** dữ liệu `detect()` ở Phase 2; màn hoàn chỉnh ở Phase 7.
- **Vào từ đâu:** lần mở app đầu tiên (`settings.onboarding_done` chưa có); hoặc MH-11 → "Kiểm tra lại"; hoặc MH-12 "Chưa có AI nào".
- **Dữ liệu:** `agents.detectAll` → `DetectResult[]` (`installed`, `version`, `loggedIn`, `models.length`); `system.checkGit`.
- **Trạng thái mỗi CLI:**

  | Điều kiện | Pill | Hành động |
  |---|---|---|
  | đang kiểm tra | "Đang kiểm tra…" `wait` | — |
  | `installed && loggedIn` | "✓ Sẵn sàng" `ok` | — |
  | `installed && !loggedIn` | "Chưa đăng nhập" `warn` | "Mở cửa sổ đăng nhập" + 3 bước hướng dẫn |
  | `!installed` | "Chưa cài" `wait` | link tài liệu chính hãng, ô lệnh "Chép", "Bỏ qua" |
  | lỗi khi kiểm tra | "Không kiểm tra được" `danger` | "Thử lại", "Xem chi tiết" |

- **Hành vi:**
  - "Mở cửa sổ đăng nhập" mở **cửa sổ dòng lệnh hệ thống** chạy lệnh đăng nhập chính thức của CLI (`agents.openLogin`). App **không** tự nhập, không đọc token (B3).
  - "Kiểm tra lại" chạy lại `detectAll`; tự chạy lại khi cửa sổ app được focus trở lại.
  - Nút "Tiếp tục với {tên AI}" chỉ bật khi ≥1 CLI sẵn sàng. Có nhiều AI sẵn sàng thì ghi "Tiếp tục".
  - Thiếu git: hiện thông báo như MH-12, cho đi tiếp nhưng tắt hoàn tác (phụ thuộc Câu hỏi mở "máy không có git").
- **Giữ chỗ:** `[GIỮ CHỖ]` lệnh cài và link tài liệu của từng CLI. Lấy từ cấu hình adapter sau khi Phase 0 xác minh (A4). Số model lấy từ `listModels()`.
- **Kiểm tra:**
  - [ ] Máy chỉ có 1 CLI đã đăng nhập → đi tiếp được.
  - [ ] Không CLI nào sẵn sàng → nút tiếp tục bị khoá, có hướng dẫn.
  - [ ] Đăng nhập xong ở cửa sổ ngoài, quay lại app → trạng thái tự cập nhật.
  - [ ] Log không chứa token (P9).

### MH-02 · Chọn / tạo dự án — `02-chon-du-an.html`

- **Mục đích:** chọn thư mục dự án, nơi AI được phép ghi (PLAN 6.1, B4).
- **Phase:** 3 (danh sách mẫu từ plugin: Phase 6).
- **Vào từ đâu:** sau MH-01; bấm `ProjectPill` ở header.
- **Dữ liệu:** `projects.list` (bảng `projects`, sắp theo `last_opened`); `projects.validatePath`; `plugins.list({kind:'template'})`.
- **Trạng thái dòng dự án:** đang làm X/Y bước (có hội thoại có bước `running`/`pending`) · xong · "Có git riêng của bạn" (thư mục có `.git`, chỉ thông tin, app không đụng) · "Không tìm thấy thư mục" (`danger`, kèm "Chỉ lại vị trí" + "Bỏ khỏi danh sách").
- **Hành vi:**
  - "Tạo dự án mới": tên + vị trí (mặc định `Documents/<tên-không-dấu>`), kiểm tra ngay khi gõ: thư mục trống? có quyền ghi? Hiện dòng kết quả bằng lời thường.
  - "Mở thư mục có sẵn": hộp chọn thư mục của hệ điều hành (`dialog.showOpenDialog` ở main). Có code sẵn thì ghi "App không xoá gì của bạn".
  - Lỗi quyền ghi: `Notice danger` + 2 hành động (chọn thư mục trong Documents / chọn thư mục khác).
  - Chọn mẫu: mặc định "Trống". Mẫu từ plugin có pill "Đã kiểm duyệt" nếu danh mục chính thức.
  - "Tạo và bắt đầu chat" → tạo bản ghi `projects` + `conversations` → MH-03 với chat trống (MH-12 "Chat trống").
- **Kiểm tra:**
  - [ ] Đường dẫn chứa `..` hoặc symlink ra ngoài bị từ chối ở main, không chỉ ở renderer.
  - [ ] Thư mục cần quyền quản trị → báo lỗi có hành động.
  - [ ] Mở dự án có `.git` → kho git của người dùng không thay đổi (so hash `.git/HEAD` và `index` trước/sau).

### MH-03 · Màn hình chính — `03-man-hinh-chinh.html`

- **Mục đích:** chat là trung tâm; xem tiến độ bằng lời thường; xem code, xem trước, xem điều phối ở khung phải (ADR-009).
- **Phase:** khung + chat + bước ở Phase 3; tab Code + hoàn tác + xem trước ở Phase 4; chip hạn mức ở Phase 5.

#### 5.3.1 Header
- `QuotaBar` một chip cho mỗi CLI **đang bật** (MH-11), theo thứ tự ưu tiên của người dùng.
- Bấm chip → `QuotaPopover` (bấm lại hoặc "Đóng" để đóng; bấm ra ngoài cũng đóng). Nội dung: pill nguồn, câu phạm vi (`scope`), mỗi cửa sổ một thanh + giờ làm mới, ghi chú router, "Cập nhật lúc HH:mm", link "Xem tất cả →" MH-08.
- Câu phạm vi: `shared` "Dùng chung cho mọi model của {AI}. Model mạnh tốn hạn mức nhanh hơn."; `model` "Tính riêng từng model: …"; `unknown` "Chưa rõ có tách theo model hay không, app tạm coi là dùng chung."
- Nhãn "Dữ liệu minh hoạ" **chỉ có trong mockup**, không đưa vào app.

#### 5.3.2 Khung chat
- Tin người dùng: bong bóng phải, nền `primary`.
- Tin của app: avatar tròn + nội dung. Một yêu cầu sinh ra: câu giới thiệu → `PlanCard` → các `SystemLine` (đổi AI, tạm dừng) → dòng trạng thái cuối ("Codex đang làm giỏ hàng…").
- `PlanCard`: tiêu đề "KẾ HOẠCH", "X / Y bước xong", thanh tiến độ = `done / tổng` (bước `undone` không tính là xong).
- `StepRow`: số thứ tự · tiêu đề (`steps.summary` ngắn hoặc tiêu đề do planner đặt) · `{AI} · {model label}` có chấm màu · ghi chú (ví dụ "Đổi từ Gemini Pro vì hết hạn mức", lấy từ `decisions` gần nhất của bước) · pill rủi ro nếu `risk_level=high` · pill trạng thái · nút "Xem code" khi bước có ít nhất 1 `step_files`.
- Dòng đang xem trong tab Code tô `primary-row`.
- `SystemLine` sinh ra mỗi lần router đổi ô (PLAN 4.5a), nội dung = `decisions.text`.
- Cập nhật thời gian thực qua sự kiện `orchestrator.onEvent`; không làm mới cả danh sách mỗi lần.

#### 5.3.3 Ô chat (`Composer`)
- Enter gửi, Shift+Enter xuống dòng. Trống thì khoá "Gửi".
- Khi có bước `running`: hiện nút "■ Dừng" → `orchestrator.cancel` → bước đang chạy quay về checkpoint đầu bước, trạng thái `pending` (hoặc `failed` nếu không khôi phục được, kèm hành động).
- Gửi tin mới khi đang chạy: hiện hộp hỏi xác nhận "Dừng việc đang làm để nhận yêu cầu mới?" (ADR-017).
- `AiPicker`: "Để app tự chọn (khuyên dùng)" mặc định; "Ghim {AI}" cho mỗi AI đang bật; "Ghim AI + model…" chỉ hiện khi bật Nâng cao ở MH-11. Lưu theo hội thoại.
- Dòng phụ "Mọi thay đổi đều hoàn tác được." cố định.

#### 5.3.4 Tab "Xem trước"
- Chỉ bật khi main nhận diện dự án web (có `package.json` + script dev) (PLAN 6.5). Không thì hiện trạng thái MH-12 "Không phải dự án web".
- Trạng thái: đang khởi động server (thanh chờ) · đang chạy (chấm xanh + địa chỉ + "↻ Làm mới" + "Mở trong trình duyệt") · lỗi build (MH-12) · server dừng ("Chạy lại").
- Nhúng bằng `[CHƯA CHỐT]` `<webview>` hay `BrowserView`/`WebContentsView`: quyết ở Phase 4, ghi ADR. Trang xem trước **không** có quyền gọi preload của app.
- Dòng dưới: "Đây là bản chạy thử ngay trong app…" chỉ hiện khi app phát hiện dữ liệu chỉ nằm trong bộ nhớ: `[CHƯA CHỐT]`, đề xuất bỏ ở MVP, thay bằng câu chung.

#### 5.3.5 Tab "Code của bước"
- Đầu thẻ: "Bước N: tiêu đề", pill trạng thái, pill rủi ro, "{AI} · {model} viết bước này".
- **"File đã đổi"**: pill cho mỗi `step_files` (đường dẫn mono + loại thay đổi). Bấm pill → chuyển sang mức "Toàn bộ" của file đó.
- `CodeLevelSwitch` 3 mức (PLAN 6.2). Mức mặc định đọc từ MH-11 (mặc định "Tóm tắt"; mockup đang để "Đoạn chính" chỉ để minh hoạ).
  - **Tóm tắt:** 1–3 câu lời thường (từ summarizer).
  - **Đoạn chính:** "Chỉ phần thay đổi chính · {file}" + `DiffBlock` rút gọn (tối đa ~15 dòng, chọn bởi summarizer hoặc các hunk lớn nhất) + "GIẢI THÍCH NGẮN" (1–3 câu, chú thích cho từng khối).
  - **Toàn bộ:** tên file + trình soạn thảo chỉ đọc (Monaco hoặc CodeMirror, ADR ở Phase 4) với diff đầy đủ. Chọn đoạn → nổi gợi ý "Hỏi “đoạn này làm gì?”" → gửi câu hỏi vào chat kèm đoạn đã chọn (dùng AI rẻ nhất). Nút "✎ Tự sửa chữ / màu / số" → MH-06.
- `WhyBox` "VÌ SAO CHỌN CÁCH NÀY": `decisions` loại cách làm của bước. Không có thì ẩn.
- `UndoButton` khi `status=done`: "↶ Hoàn tác bước này" + "Khôi phục file về lúc trước bước N." Bấm → hộp xác nhận nếu có bước sau phụ thuộc (bước sau đã sửa cùng file): "Hoàn tác bước 2 sẽ hoàn tác cả bước 3 và 4. Tiếp tục?". Khi `undone`: "Làm lại bước này".
- Bước chưa chạy: "Bước này chưa chạy. Khi AI làm xong, phần code sẽ hiện ở đây."

#### 5.3.6 Tab "Điều phối chi tiết"
- Nền tối, chữ mono. Hai phần:
  - "VÌ SAO APP CHỌN AI VÀ MODEL NÀY": mỗi bước một thẻ, tiêu đề `Bước N → {AI} · {model}`, nội dung `decisions.text` loại chọn AI.
  - "NHẬT KÝ TRỰC TIẾP": giờ (HH:mm:ss) · nguồn ("Điều phối" hoặc tên AI, màu `ai-*-d`) · nội dung lời thường. Nguồn: sự kiện chuẩn hoá (`plan`, `tool_call`, `file_change`, `rate_limit`, `done`, `error`) đã chuyển sang lời thường.
- Ghi chú dưới: "Mặc định thẻ này ẩn sau tab…".
- **Không** hiện token, đường dẫn tuyệt đối ngoài dự án, nội dung `.env` (P9).

- **Kiểm tra MH-03:**
  - [ ] Gửi yêu cầu → thấy kế hoạch và các bước chạy lần lượt, trạng thái đổi theo thời gian thực.
  - [ ] Bấm "Xem code" ở bước bất kỳ → khung phải chuyển tab Code, dòng bước được tô.
  - [ ] Đổi 3 mức xem không gọi lại AI (dữ liệu đã có sẵn).
  - [ ] Hoàn tác rồi làm lại một bước → file trên đĩa đúng như trước/sau.
  - [ ] Bấm "Dừng" giữa bước → file về điểm đầu bước.
  - [ ] Router đổi AI → có `SystemLine` và dòng trong tab Điều phối.
  - [ ] Tắt hết mạng → tab Điều phối và chip hạn mức không làm app lỗi.

### MH-04 · Xin phép hành động rủi ro — `04-xin-phep.html`

- **Mục đích:** Luật B5. Mọi xoá file, cài gói, chạy script lạ, truy cập mạng đều qua đây.
- **Phase:** 3.
- **Kích hoạt:** sự kiện `permission_request` từ adapter. Executor **dừng chờ**; bước hiện "Đang chờ bạn cho phép".
- **Dữ liệu (`PermissionRequest`):** `stepId`, `agent`, `model`, `kind` (`delete` / `install` / `run` / `network` / `write_outside`…), `title` lời thường, `explain` lời thường, `effects[]` (`{tag, text}`), `rawCommand` (chỉ hiện khi mở "Xem lệnh chính xác").
- **Bố cục:** biểu tượng cảnh báo · "{AI} · {model} · Bước N" · tiêu đề · giải thích · thẻ "Việc này sẽ làm gì" (pill `Mạng` / `Chạy lệnh` / `Sửa file` / `Xoá file`) · "Xem lệnh chính xác" thu gọn · ghi chú "đã tạo điểm khôi phục".
- **Hành động:** "Không cho phép" (gửi từ chối cho AI, AI tự tìm cách khác hoặc báo không làm được; đã gộp chung với ý "Hỏi AI cách khác" theo ADR-012) · "Cho phép lần này" (nút chính).
  - Không có ô "Luôn cho phép … trong dự án này" ở MVP — mỗi lần đều hỏi theo Luật B5 (ADR-012).
- `write_outside` (ghi ra ngoài dự án) **không bao giờ** hiện hộp xin phép: bị chặn thẳng và báo như MH-12 (B4).
- **Kiểm tra:**
  - [ ] AI cố cài gói → luôn hiện hộp thoại; từ chối → không có gì được cài.
  - [ ] `Esc` = "Không cho phép".
  - [ ] Tắt app khi đang chờ → mở lại thấy bước ở trạng thái an toàn (không tự cho phép).

### MH-05 · Xung đột với phần bạn tự sửa — `05-xung-dot.html`

- **Mục đích:** PLAN 4.7, U5.
- **Phase:** 4.
- **Kích hoạt:** trước khi nhận thay đổi của AI cho một file, main so với checkpoint gần nhất; nếu file nằm trong `user_edits` mới hơn checkpoint → tạo `FileConflict`, bước chuyển "Cần bạn xác nhận". Các file khác của bước vẫn được nhận.
- **Dữ liệu (`FileConflict`):** `stepId`, `path`, `userEditedAt`, `userVersion`, `aiVersion`, `plainExplain` (do AI rẻ tạo: "AI muốn thêm…, nhưng…").
- **Bố cục:** 2 cột "Bản của bạn (hiện tại)" | "Bản AI muốn ghi", dòng khác nhau tô màu (`mark` / `del` / `add`); "Nói đơn giản"; 3 lựa chọn dạng radio.
- **Lựa chọn:**
  1. *Giữ phần tôi sửa, nhờ AI thêm lại phần của nó* (mặc định, "Khuyên dùng") → gửi lại cho AI kèm bản của người dùng, AI làm lại riêng file đó.
  2. *Giữ nguyên bản của tôi* → bỏ thay đổi của AI cho file này.
  3. *Dùng bản của AI* → ghi bản của AI (vẫn hoàn tác được).
- "Để sau, tạm dừng bước này" → bước giữ trạng thái chờ; chat hiện dòng nhắc.
- MVP làm ở **mức file** (PLAN 4.7); so sánh theo dòng chỉ để hiển thị.
- **Kiểm tra:**
  - [ ] Tự sửa file rồi yêu cầu AI sửa file đó → hiện hộp thoại, file **chưa** bị ghi.
  - [ ] Chọn (2) → nội dung file y như bản của người dùng.
  - [ ] `Esc` = "Để sau".

### MH-06 · Tự sửa trực tiếp — `06-tu-sua.html`

- **Mục đích:** PLAN 6.4, sửa chữ/màu/số không cần AI.
- **Phase:** 4.
- **Vào từ đâu:** MH-03 tab Code mức "Toàn bộ" → "✎ Tự sửa…".
- **Dữ liệu:** `project.editables` → danh sách `{id, kind: 'text'|'color'|'number', label, value, file, locator}`.
  - `[CHƯA CHỐT]` cách tìm "chỗ sửa được": đề xuất MVP chỉ nhận diện chuỗi chữ trong HTML/JSX, mã màu hex trong CSS, và số trong mảng dữ liệu đơn giản; nhãn do AI rẻ đặt **một lần** khi bước xong rồi lưu lại. Ghi ADR ở Phase 4.
- **Bố cục:** trái: tiêu đề, pill "Không cần gọi AI · không tốn hạn mức", bộ lọc (Tất cả / Chữ / Màu / Số), danh sách ô sửa có dòng vị trí (`file · dòng`); dưới: "N chỗ đã đổi, chưa lưu" + "Bỏ thay đổi" + "Lưu vào file". Phải: xem trước trực tiếp + gợi ý "Muốn đổi thứ phức tạp hơn? Hãy nhắn trong chat".
- **Hành vi:**
  - Gõ → xem trước cập nhật ngay (bơm giá trị vào trang xem trước, chưa ghi file). Ô đã đổi tô `primary-row`.
  - "Lưu vào file" → main ghi file, tạo checkpoint, thêm bản ghi `user_edits` (hash + thời điểm) → hiện thông báo "App ghi nhận đây là phần bạn tự sửa…".
  - Rời màn khi chưa lưu → hỏi "Bỏ các thay đổi chưa lưu?".
  - Bộ lọc phải hoạt động (mockup chỉ vẽ).
- **Kiểm tra:**
  - [ ] Đổi giá, lưu → file đổi đúng một chỗ, phần còn lại của file y nguyên (so từng byte).
  - [ ] Sau đó AI sửa file đó → ra MH-05.
  - [ ] Không có lời gọi AI nào khi sửa và lưu.

### MH-07 · Hết hạn mức / chuyển AI — `07-het-han-muc.html`

- **Mục đích:** chuỗi dự phòng PLAN 4.5a và thông báo PLAN 6.6.
- **Phase:** 3 (chuỗi dự phòng), 5 (hiển thị đầy đủ).
- **Kích hoạt:** sự kiện `rate_limit` hoặc snapshot `exhausted` của ô đang dùng.
- **Hành vi router (tóm tắt, chi tiết ở PLAN 4.5a):**
  1. Khôi phục file về điểm đầu bước.
  2. Thử model khác cùng CLI nếu đủ bậc và hạn mức không dùng chung; bước `risk_level=high` **không hạ bậc**.
  3. Thử CLI khác đủ bậc và còn hạn mức.
  4. Còn ô → chạy lại bước, ghi `decisions`, hiện `SystemLine` ("Gemini Pro đã hết hạn mức. Bước 4 nhạy cảm nên không dùng Gemini Flash, app chuyển sang Claude Opus 5.5").
  5. Hết ô → bước "Tạm dừng" + thẻ tạm dừng trong chat.
- **Thẻ tạm dừng:** tiêu đề "⏸ Tạm dừng: chưa có AI đủ mạnh cho bước N" · câu giải thích (không tự hạ, file đã khôi phục) · danh sách từng ô và giờ làm mới · câu "Bạn có thể quay lại sau {giờ sớm nhất} để chạy tiếp" · "Bạn có thể" với các nút:
  - "↻ Thử lại bước này" (hẹn giờ tự chạy tiếp để `[SAU MVP]`, không làm "làm bước khác trước" ở MVP theo ADR-013).
  - "Vẫn dùng {model nhanh} cho bước N" kèm pill "Không khuyên dùng" → hỏi xác nhận thêm một lần; ghi `decisions` "Người dùng chủ động chọn model bậc thấp". Đây là **người dùng chọn**, không phải app tự hạ, nên không trái 4.5a.
  - "Ghim AI khác…" mở `AiPicker`.
- **Toast:** `low` → toast vàng một lần cho mỗi cửa sổ hạn mức ("Codex đã dùng khoảng 81%… ước lượng"); `exhausted` → toast đỏ ("Claude đã hết hạn mức 5 giờ…"), không tự ẩn. Bật/tắt ở MH-11.
- **Chip:** đổi màu ngay khi nhận snapshot mới; **không** tự mở popover hạn mức khi vừa hết, chỉ hiện toast (ADR-013).
- **Kiểm tra:**
  - [ ] Giả lập Gemini Pro hết với bước rủi ro cao → không dùng Gemini Flash; chuyển CLI khác.
  - [ ] Giả lập Claude (shared) hết → không thử model khác của Claude.
  - [ ] Hết mọi ô → tạm dừng, có giờ làm mới sớm nhất, file đã về điểm đầu bước.
  - [ ] Mỗi lần đổi ô có đúng 1 dòng `decisions`.

### MH-08 · Chi tiết hạn mức — `08-han-muc.html`

- **Mục đích:** PLAN 6.6, ADR-008, ADR-010.
- **Phase:** 5.
- **Vào từ đâu:** popover → "Xem tất cả"; toast → "Xem hạn mức".
- **Dữ liệu:** `quota.getAll` (snapshot mới nhất của mỗi ô) + `models.list`.
- **Bố cục:** tiêu đề + "Cập nhật lúc" + "↻ Làm mới" (`quota.refresh`, khoá nút khi đang làm mới) · chú giải 4 nguồn · mỗi CLI một thẻ:
  - Đầu thẻ: chấm màu, tên, pill nguồn, pill phạm vi, (gói nếu CLI báo), pill tổng trạng thái.
  - `scope = shared/unknown`: các thanh cửa sổ ở đầu, rồi bảng model (Model · Bậc · Trạng thái · Ghi chú) không có %.
  - `scope = model`: bảng model có cột % + nguồn + giờ làm mới **cho từng dòng**.
  - `source = unknown`: không thanh, câu "AI này không cho biết hạn mức… App vẫn dùng bình thường".
- Thẻ cuối "App dùng hạn mức thế nào khi chọn AI": 4 ý. Câu "Đọc hạn mức không tốn hạn mức của bạn" ~~`[GIỮ CHỖ]`, chỉ hiện nếu Phase 0 xác minh đúng~~ **đã xác minh đúng ở Phase 0 theo ADR-018** (`QuotaService` chỉ đọc thụ động từ `statusLine` / log cục bộ / lỗi `429`, cấm gửi prompt LLM để đọc quota → hiển thị cố định câu này).
- **Giữ chỗ:** tên model, tên gói, %, giờ làm mới đều từ adapter.
- **Kiểm tra:**
  - [ ] Parser lỗi → thẻ CLI đó hiện `unknown`, các thẻ khác bình thường.
  - [ ] Nhãn nguồn khớp với `source` của snapshot.

### MH-09 · Lịch sử, nhật ký quyết định, bản đồ dự án — `09-nhat-ky.html`

- **Phase:** 4.
- **Tab 1, Lịch sử & hoàn tác:**
  - Cột trái: hội thoại của dự án (`conversations`), mới nhất trên.
  - Dòng thời gian (mới nhất trên): mỗi bước (`steps`) + mỗi lần người dùng tự sửa (`user_edits`, viền vàng, pill "Bạn sửa") + "Bắt đầu dự án". Bước `undone` gạch ngang, mờ.
  - Hành động: "Xem code" (→ MH-03 tab Code của bước đó) · "↶ Quay về trước bước này" (khôi phục `checkpoint_before`, **tạo checkpoint mới trước khi khôi phục** để quay lại được) · "↶ Bỏ thay đổi này" cho dòng tự sửa · "Làm lại" cho bước đã hoàn tác.
  - Mọi lần quay về đều hỏi xác nhận, liệt kê số file sẽ đổi.
- **Tab 2, Vì sao làm vậy:** bảng `decisions` của dự án: Lúc · Bước · Quyết định · Loại (`Cách làm` / `Chọn AI` / `Đổi AI`, đọc từ cột `decisions.kind`: `'approach' | 'pick' | 'switch'` theo ADR-014). Tìm kiếm + lọc theo loại.
- **Tab 3, Bản đồ dự án:** lưới thẻ "chức năng → file". Thẻ chứa file có nhãn rủi ro thì viền vàng + pill "Nhạy cảm". Bấm tên file → MH-03 mức "Toàn bộ".
  - Nguồn dữ liệu: model bậc nhanh/rẻ nhất đang khả dụng cập nhật sau mỗi bước hoàn thành, lưu trong bảng `project_map` (ADR-015).
- **Kiểm tra:**
  - [ ] Quay về trước bước 2 rồi quay về lại "hiện tại" → dự án y như ban đầu.
  - [ ] Dự án có git của người dùng → `.git` không thay đổi.

### MH-10 · Plugin — `10-plugin.html`

- **Phase:** 6.
- **Dữ liệu:** `plugins.catalog` (repo danh mục chính thức) + `plugins.installed` (bảng `plugins`).
- **Bố cục:** bộ chọn Danh mục / Đã cài (N) / Có bản mới (N) · lọc theo loại (`agent-adapter` "Thêm AI", `skill-pack` "Bộ hướng dẫn", `template` "Mẫu dự án", `mcp-server` "Kết nối công cụ (MCP)") · tìm kiếm · lưới thẻ.
- **Thẻ plugin:** biểu tượng, tên, loại · phiên bản, mô tả, pill "✓ Đã kiểm duyệt" (chỉ danh mục chính thức), pill các quyền (`project:read` "Đọc dự án", `project:write` "Ghi vào dự án", `process:run` "Chạy chương trình", `network` "Internet", `mcp:connect` "Kết nối công cụ"), trạng thái + nút (Cài đặt / Cập nhật / Gỡ / Cài lại).
- **Plugin hỏng:** manifest không qua zod hoặc checksum sai → tự tắt, thẻ `danger` "Đã tắt tự động", app vẫn chạy.
- **Hộp thoại cài:** tên, pill kiểm duyệt, phiên bản, nguồn, kết quả kiểm tra checksum · danh sách quyền trọn gói ("tất cả hoặc không" ở MVP, không có checkbox chọn lẻ theo ADR-016): mỗi quyền một dòng có lời giải thích + mã quyền (mono) · dòng "Không xin: …" · ghi chú "Plugin không bao giờ đọc được mật khẩu…" · "Huỷ" / "Đồng ý và cài đặt".
- **Cài từ link:** cảnh báo đỏ, ô "Tôi hiểu rủi ro" phải tick mới bật nút; sau đó vẫn qua hộp thoại quyền.
- **Kiểm tra:**
  - [ ] Plugin hỏng không làm sập app.
  - [ ] Plugin không dùng được quyền chưa cấp.

### MH-11 · Cài đặt — `11-cai-dat.html`

- **Phase:** khung ở Phase 1; từng mục bổ sung theo phase liên quan.
- Lưu ở bảng `settings` (khoá/giá trị). **Không** lưu token (B2).

| Mục | Thiết lập | Khoá `settings` đề xuất | Phase | Ghi chú |
|---|---|---|---|---|
| AI và model | Bảng AI trên máy + bật/tắt từng AI | `agents.enabled` | 2 | |
| | Cách chọn AI: tự chọn / ưu tiên một AI | `router.mode` | 3 | |
| | Thứ tự ưu tiên khi ngang nhau (kéo thả) | `router.priority` | 3 | |
| | Nhờ AI khác kiểm tra bước nhạy cảm | `router.reviewer` | 3 | Reviewer tuỳ chọn (PLAN 4.5) |
| | Nâng cao: bảng bậc model (sửa được), model mới chưa xếp bậc có cảnh báo | file ánh xạ bậc (không phải `settings`) | 2 | P10 |
| | Cho phép chế độ tự chọn model của CLI | `router.allowCliAuto` | 3 | PLAN 4.4a |
| Hạn mức | Ngưỡng cảnh báo (70/80/90%) | `quota.lowThreshold` | 5 | |
| | Thông báo khi hết / dòng đổi AI trong chat | `quota.notify*` | 5 | |
| | ~~Tự chạy tiếp khi được làm mới~~ | ~~`quota.autoResume`~~ | — | `[SAU MVP]`, đã chốt bỏ ở MVP (ADR-013) |
| An toàn | Hỏi trước khi xoá file / chạy lệnh lạ / cài thư viện / truy cập Internet | — | 3 | Luôn hỏi mọi lần ở MVP, không tắt được (ADR-012) |
| | Nhãn rủi ro: tuỳ chỉnh | file cấu hình `risk` | 4 | |
| Chung | Ngôn ngữ | `ui.locale` | 1 | Chỉ `vi` ở MVP |
| | Mức xem code mặc định | `ui.codeLevel` | 4 | Mặc định `summary` |
| | Hiện thuật ngữ kỹ thuật | `ui.showJargon` | 4 | G1 |
| | Tự mở Xem trước | `ui.autoPreview` | 4 | |
| Cập nhật | Phiên bản, bản mới đã tải, "Khởi động lại để cập nhật" | — | 7 | electron-updater |
| | Kênh ổn định / thử nghiệm, tự tải | `update.*` | 7 | |
| Dữ liệu | Vị trí `userData`, "Mở thư mục", "Sao lưu ngay" | — | 1 | |
| | Số liệu ẩn danh | `telemetry.enabled` | — | `[CHƯA CHỐT]` Câu hỏi mở PLAN; nếu làm: mặc định tắt |
| | Báo lỗi: mô tả + "Xem nội dung sẽ gửi" + "Gửi" | — | 8 | Log đã lọc, người dùng duyệt trước |

- Bộ chuyển (toggle) dùng `role="switch"` + `aria-checked`.
- **Kiểm tra:** mọi thiết lập còn nguyên sau khi tắt mở app và sau khi cập nhật phiên bản.

### MH-12 · Lỗi và trạng thái trống — `12-trang-thai-loi.html`

Mỗi trường hợp dưới đây là một `Notice` hoặc trạng thái trống, xuất hiện **tại chỗ** (trong chat, trong tab, hoặc trong thẻ), không phải một trang riêng.

| Trường hợp | Ở đâu | Tone | Hành động bắt buộc |
|---|---|---|---|
| Chat trống, dự án mới | MH-03 khung chat | — | 3 gợi ý câu hỏi bấm được (điền vào ô chat, chưa gửi) |
| Đang lập kế hoạch | MH-03 khung chat | — | "■ Dừng" |
| Lỗi build khi xem trước | MH-03 tab Xem trước | danger | "Nhờ AI sửa lỗi này", "Hoàn tác bước N", "Xem chi tiết lỗi" |
| Không phải dự án web | MH-03 tab Xem trước | neutral | "Nhờ AI thêm cách chạy thử" |
| AI bị đăng xuất giữa chừng | MH-03 chat + chip | warn | "Đăng nhập lại {AI}", "Làm tiếp bằng AI khác" |
| Không có AI nào sẵn sàng | toàn app | danger | "Mở hướng dẫn cài đặt" → MH-01 |
| Chặn ghi ra ngoài dự án | MH-03 chat | warn | "Bảo AI làm cách khác", "Xem trong nhật ký" |
| Hạn mức không đọc được | chip + MH-08 | neutral | "Thử đọc lại" |
| AI không phản hồi sau N phút | MH-03 chat | warn | "Đợi thêm", "Dừng và thử lại", "Chuyển AI khác". `[CHƯA CHỐT]` N, đề xuất 3 phút |
| Sau khi hoàn tác | MH-03 chat | info | "Làm lại bước N", "Đóng" |
| Máy không có git | MH-01, MH-11 | warn | "Hướng dẫn cài git", "Tiếp tục không có hoàn tác" (phụ thuộc Câu hỏi mở PLAN) |

---

## 6. Dữ liệu hiển thị (view model)

Renderer chỉ nhận **view model** đã chuẩn bị ở main, không nhận nguyên bản ghi DB.

```ts
// src/shared/vm.ts (dự kiến; chỉnh khi làm Phase 3, ghi vào Nhật ký)
type StepUiStatus = 'pending' | 'running' | 'done' | 'failed' | 'undone'
                  | 'waiting_permission' | 'conflict' | 'paused';   // lưu thẳng trong steps.status theo ADR-014

interface StepVM {
  id: string; seq: number; title: string;
  agentId: string; agentLabel: string; agentColor: string;
  modelLabel: string | null;          // từ listModels(), KHÔNG hard-code
  status: StepUiStatus;
  note: string | null;                // decisions gần nhất loại "đổi AI"
  riskLevel: 'low' | 'medium' | 'high' | null;
  riskText: string | null;            // câu lời thường theo risk_tags
  hasCode: boolean;
}

interface StepCodeVM {
  stepId: string;
  files: { path: string; change: 'added' | 'modified' | 'deleted'; riskTags: string[] }[];
  summary: string[];                  // mức Tóm tắt
  keyDiff: { file: string; lines: { sign: '+' | '-' | ' '; text: string }[] } | null;
  explain: string[];                  // giải thích ngắn
  why: string | null;                 // "vì sao chọn cách này"
  canUndo: boolean;
}

interface QuotaChipVM {
  agentId: string; label: string; color: string;
  text: string;                       // đã định dạng theo 3.2
  tone: 'ok' | 'low' | 'exhausted' | 'unknown';
}

interface OrchestrationLogEntry {
  at: string;                         // ISO
  source: 'orchestrator' | string;    // agentId
  text: string;                       // lời thường, đã lọc dữ liệu nhạy cảm
}
```

---

## 7. Kênh IPC dùng cho giao diện (dự kiến)

Mọi kênh: dữ liệu vào/ra có zod schema trong `src/shared/ipc/`. Tên dưới đây là đề xuất; khi làm thật có thể đổi nhưng **phải cập nhật bảng này**.

| Kênh | Loại | Màn | Phase |
|---|---|---|---|
| `agents.detectAll` / `agents.openLogin(agentId)` | invoke | 01, 11 | 2 |
| `system.checkGit` | invoke | 01 | 0/1 |
| `models.list` / `models.setTier` | invoke | 08, 11 | 2 |
| `projects.list` / `projects.create` / `projects.open` / `projects.validatePath` / `projects.pickFolder` | invoke | 02 | 3 |
| `conversations.list` / `conversations.messages` | invoke | 03, 09 | 3 |
| `orchestrator.send` / `orchestrator.cancel` / `orchestrator.setAiPick` | invoke | 03 | 3 |
| `orchestrator.onEvent` (step cập nhật, message, system line, log) | sự kiện main → renderer | 03 | 3 |
| `permission.onRequest` / `permission.respond` | sự kiện + invoke | 04 | 3 |
| `steps.code(stepId)` / `steps.fileFull(stepId, path)` | invoke | 03 | 4 |
| `steps.undo` / `steps.redo` / `checkpoints.restore` | invoke | 03, 09 | 4 |
| `conflict.onConflict` / `conflict.resolve` | sự kiện + invoke | 05 | 4 |
| `project.editables` / `project.saveEdits` | invoke | 06 | 4 |
| `decisions.list` / `projectMap.get` | invoke | 09 | 4 |
| `preview.start` / `preview.stop` / `preview.onState` | invoke + sự kiện | 03 | 4 |
| `ask.explainSelection` | invoke | 03 | 4 |
| `quota.getAll` / `quota.refresh` / `quota.onUpdate` | invoke + sự kiện | header, 07, 08 | 5 |
| `plugins.catalog` / `plugins.installed` / `plugins.install` / `plugins.update` / `plugins.uninstall` | invoke | 10 | 6 |
| `settings.get` / `settings.getAll` / `settings.set` | invoke | 11 | 1 |
| `system.getDataInfo` / `system.openDataDir` / `system.backupNow` | invoke | 11 | 1 |
| `update.status` / `update.restart` | invoke | 11 | 7 |
| `feedback.preview` / `feedback.send` | invoke | 11 | 8 |

---

## 8. Câu hỏi cần chủ dự án chốt (UI)

> AI triển khai **không tự quyết** các mục dưới đây (Luật A3). Chốt xong thì chuyển thành ADR trong PLAN, sửa các ô `[CHƯA CHỐT]` liên quan.

| # | Câu hỏi | Đề xuất / Quyết định | Ảnh hưởng |
|---|---|---|---|
| ~~Q1~~ | ~~Cho phép "Luôn cho phép cài thư viện / truy cập mạng trong dự án này" không? Luật B5 nói *phải* xin phép.~~ | **Đã chốt (ADR-012):** MVP không có, mỗi lần đều hỏi. | MH-04, MH-11 |
| ~~Q2~~ | ~~Nút "Hỏi AI cách khác" ở hộp xin phép có cần không?~~ | **Đã chốt (ADR-012):** Gộp vào "Không cho phép" (AI tự tìm cách khác). | MH-04 |
| ~~Q3~~ | ~~Tính năng "tự chạy tiếp khi hạn mức được làm mới" (cần app đang mở, hẹn giờ). Chưa có trong PLAN.~~ | **Đã chốt (ADR-013):** Để sau MVP; MVP chỉ báo giờ + nút "Thử lại". | MH-07, MH-11 |
| ~~Q4~~ | ~~Khi tạm dừng vì hết hạn mức, có cho "làm bước khác trước" không? Có thể trái ADR-005 nếu bước sau phụ thuộc.~~ | **Đã chốt (ADR-013):** MVP không làm. | MH-07 |
| ~~Q5~~ | ~~Lưu 3 trạng thái suy ra (`waiting_permission`, `conflict`, `paused`) vào schema?~~ | **Đã chốt (ADR-014):** Có, lưu thẳng vào `steps.status`. | 3.1, DB |
| ~~Q6~~ | ~~Thêm cột `decisions.kind` (`approach` / `pick` / `switch`)?~~ | **Đã chốt (ADR-014):** Có. | MH-09, MH-03 |
| ~~Q7~~ | ~~Bản đồ dự án lưu ở đâu và cập nhật khi nào?~~ | **Đã chốt (ADR-015):** AI rẻ cập nhật sau mỗi bước; lưu bảng `project_map`. | MH-09 |
| ~~Q8~~ | ~~Plugin: cho bỏ chọn quyền không bắt buộc, hay tất cả hoặc không?~~ | **Đã chốt (ADR-016):** Tất cả hoặc không ở MVP. | MH-10 |
| ~~Q9~~ | ~~Gửi tin mới khi AI đang làm: xếp hàng hay hỏi dừng?~~ | **Đã chốt (ADR-017):** Hỏi dừng. | MH-03 |
| ~~Q10~~ | ~~Kích thước cửa sổ tối thiểu; khung phải thu gọn được không?~~ | **Đã chốt (ADR-017):** `1024×680`; có nút thu gọn khung phải. | 1.2 |
| ~~Q11~~ | ~~Chế độ tối cho toàn app?~~ | **Đã chốt (ADR-017):** Sau MVP. | Tokens |
| ~~Q12~~ | ~~Popover hạn mức tự mở khi một AI vừa hết?~~ | **Đã chốt (ADR-013):** Không tự mở, chỉ toast. | MH-07 |

---

## 9. Ánh xạ màn ↔ phase (để làm đúng một phase một lần)

| Phase | Phần giao diện làm trong phase | Không làm |
|---|---|---|
| 1 | Tokens → Tailwind, font đóng gói, i18n, `AppHeader` (chưa có chip), thành phần cơ bản (Button, Pill, Toggle, Segmented, Dialog, Notice), khung MH-11 (Chung, Dữ liệu) | Mọi thứ cần CLI |
| 2 | MH-01 dữ liệu thật (bản đơn giản), MH-11 mục "AI trên máy" + bảng bậc model | Chat |
| 3 | MH-02, MH-03 (chat, PlanCard, StepRow, Composer, SystemLine, tab Điều phối), MH-04, MH-07 (chuỗi dự phòng, thẻ tạm dừng), MH-12 các trường hợp của phase này | Tab Code, Xem trước, chip hạn mức |
| 4 | MH-03 tab Code + Xem trước + hoàn tác, MH-05, MH-06, MH-09, MH-12 phần liên quan | Chip hạn mức |
| 5 | QuotaBar/Chip/Popover, toast, MH-08, MH-07 phần hiển thị hạn mức | |
| 6 | MH-10 | |
| 7 | MH-01 hoàn chỉnh, MH-11 mục Cập nhật | |
| 8 | MH-11 mục Báo lỗi | |

---

## 10. Nhật ký thay đổi của UI_SPEC

| Ngày | Phiên bản | Người/AI | Thay đổi |
|---|---|---|---|
| 2026-11-02 | 0.4 | Antigravity (AI) | Cập nhật bảng kênh IPC mục 7 cho Phase 1: bổ sung `settings.getAll`, `system.getDataInfo`, `system.openDataDir`, `system.backupNow` khớp với `src/shared/ipc/contracts.ts` |
| 2026-11-02 | 0.3 | Antigravity (AI) | Xác nhận câu "Đọc hạn mức không tốn hạn mức của bạn" ở MH-08 là đúng theo kết quả Phase 0 và ADR-018 (đọc thụ động 0 token LLM); đồng bộ tham chiếu `PROJECT_PLAN.md` v0.6 |
| 2026-11-02 | 0.2 | Antigravity (AI) | Cập nhật tên app **CodeFleet** (G10, ADR-011) và chốt toàn bộ Q1–Q12 theo quyết định của chủ dự án (ADR-012 → ADR-017); gạch các dòng mục 8 và sửa các ô `[CHƯA CHỐT]` liên quan |
| 2026-11-02 | 0.1 | Antigravity (AI) | Tạo tài liệu: nguyên tắc, tokens, ánh xạ trạng thái, thành phần, đặc tả 12 màn, view model, IPC dự kiến, 12 câu hỏi cần chốt, ánh xạ phase |

