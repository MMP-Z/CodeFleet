# PROMPT TRIỂN KHAI — dùng cho AI code (Claude Code, Codex CLI, Gemini CLI…)

> **Phiên bản:** 0.1 · **Cập nhật:** 2026-11-02
> Đi kèm: `Document/PROJECT_PLAN.md`, `Document/UI_SPEC.md`, `Document/UI_Mockups/`

---

## Cách dùng

1. **Một phiên làm việc = một phase** (Luật A2). Không gộp nhiều phase vào một phiên.
2. Mỗi phiên dán theo thứ tự:
   - **Prompt 0**: khởi động (luôn dán).
   - **Prompt của phase** đang làm (mục 2).
   - Khi AI báo xong: **Prompt K** để tự kiểm tra (mục 3).
3. Muốn chắc hơn: mở một AI **khác** và dán **Prompt R** để nó soát lại việc AI trước đã làm (mục 4).
4. AI hỏi lại thì trả lời rồi mới cho làm tiếp. Đừng trả lời "tự quyết đi" cho các câu trong `UI_SPEC.md` mục 8.
5. Chỗ nào có `{...}` thì thay bằng nội dung của bạn trước khi dán.

> [!TIP]
> Trước Phase 3, nên chốt các câu Q1–Q12 trong `UI_SPEC.md` mục 8 bằng **Prompt Q** (mục 5). Như vậy AI ít phải dừng lại hỏi.

---

## 1. Prompt 0 — Khởi động phiên (dán đầu mỗi phiên)

```text
Bạn là kỹ sư triển khai cho dự án trong thư mục này. Tài liệu nằm ở thư mục Document/.

BƯỚC 1 — ĐỌC (bắt buộc, chưa viết code):
- Đọc TOÀN BỘ Document/PROJECT_PLAN.md (nguồn sự thật số 1).
- Đọc TOÀN BỘ Document/UI_SPEC.md (nguồn sự thật số 2 cho giao diện).
- Xem Document/UI_Mockups/ (index.html, assets/styles.css và các màn liên quan đến phase này). Mockup chỉ là THAM KHẢO HÌNH DÁNG, không phải code để chép nguyên.
- Thứ tự ưu tiên khi mâu thuẫn: PROJECT_PLAN > UI_SPEC > mockup. Gặp mâu thuẫn giữa PLAN và UI_SPEC thì DỪNG và hỏi tôi.

BƯỚC 2 — BÁO CÁO CHO TÔI (ngắn gọn, tiếng Việt):
a) Phase hiện tại theo Bảng trạng thái (PLAN mục 7) và phase tôi giao ở prompt tiếp theo.
b) Danh sách việc của phase đó (checklist trong PLAN mục 8 + phần giao diện của phase trong UI_SPEC mục 9).
c) Các điểm mơ hồ, các ô [CHƯA CHỐT] liên quan đến phase này, các việc cần xác minh (Luật A4). Mỗi điểm một câu hỏi rõ ràng, kèm đề xuất của bạn.
d) Kế hoạch làm: chia thành các PR/commit nhỏ, mỗi cái một mục đích (Luật P7).

BƯỚC 3 — CHỜ TÔI ĐỒNG Ý rồi mới viết code.

LUẬT LUÔN ÁP DỤNG:
- Làm đúng một phase. Việc mới phát sinh: ghi vào "Việc bị hoãn / ý tưởng mới" của phase, KHÔNG làm (A2).
- Không suy tên lệnh, cờ, định dạng output của CLI từ trí nhớ. Phải chạy thật hoặc đọc tài liệu hiện hành, ghi vào PLAN mục 9 (A4).
- Không hard-code tên model, tên gói, lệnh cài CLI (P10, UI_SPEC G6). Dữ liệu [GIỮ CHỖ] trong mockup là minh hoạ.
- Không làm phần [CHƯA CHỐT] hoặc [SAU MVP] của UI_SPEC trừ khi tôi đã chốt.
- TypeScript strict, cấm any (P1). Mọi IPC validate bằng zod (P3). Renderer không đụng Node/FS/DB (P2, B1).
- Mọi chuỗi giao diện qua file i18n tiếng Việt (U4). Mọi lỗi phải kèm hành động tiếp theo (U2).
- Tick checklist ngay khi xong từng việc nhỏ (A5).
- Sau MỖI thay đổi: cập nhật PROJECT_PLAN.md trong cùng commit: Bảng trạng thái, checklist, Ghi chú giai đoạn, một dòng Nhật ký thay đổi, tăng phiên bản tài liệu (Luật T). Nếu đổi hành vi/kênh IPC/trạng thái giao diện thì cập nhật cả UI_SPEC.md (mục 10 của nó).
- Chỉ báo "xong" khi đã: chạy test, lint, type-check, build, và mở app thử thật (A6, DoD).
```

---

## 2. Prompt theo phase

> Dán **sau** Prompt 0, chỉ dán đúng phase đang làm.

### Phase 0 — Spike và xác minh

```text
Phase giao: PHASE 0 — Spike và xác minh (PLAN mục 8).
Mục tiêu: xác minh giả định, CHƯA viết code sản phẩm. Code thử đặt trong thư mục spikes/, không đưa vào src/.

Yêu cầu:
- Làm lần lượt từng mục checklist Phase 0. Với mỗi CLI (Claude Code, Codex CLI, Gemini CLI): chạy thật trên máy này, ghi lệnh đã chạy, phiên bản, output mẫu (đã xoá thông tin nhạy cảm) vào PLAN mục 9 kèm nguồn và ngày kiểm tra.
- Lưu output mẫu làm fixture ở spikes/fixtures/<cli>/ để Phase 2 dùng (P5).
- Về hạn mức: xác minh rõ "đọc hạn mức có tốn hạn mức không". Kết quả này quyết định câu giữ chỗ ở MH-08 (UI_SPEC).
- Về điều khoản: chỉ ghi điều đọc được từ tài liệu chính thức, kèm link. Không chắc thì ghi "chưa rõ", không suy đoán.
- Thứ gì không làm được trên máy này (ví dụ thiếu tài khoản, thiếu macOS): ghi rõ "chưa xác minh, lý do", báo tôi.
- Kết thúc: điền "Ghi chú kết thúc" Phase 0, chỉ đánh dấu Xong khi đạt toàn bộ tiêu chí thoát (T4).
```

### Phase 1 — Khung dự án

```text
Phase giao: PHASE 1 — Khung dự án (PLAN mục 8) + phần giao diện Phase 1 trong UI_SPEC mục 9.

Ngoài checklist Phase 1 của PLAN, làm phần nền giao diện:
- Chuyển toàn bộ design tokens ở UI_SPEC mục 2 vào tailwind.config.ts, đúng tên token. Không thêm màu ngoài bảng.
- Đóng gói font Be Vietnam Pro và JetBrains Mono vào app (không tải Google Fonts lúc chạy, vì CSP).
- Thiết lập i18n: src/renderer/i18n/vi.json, khoá đặt theo màn (vd mh03.composer.placeholder).
- Thành phần cơ bản trong src/renderer/components/: Button, Pill, Toggle (role=switch), Segmented, Progress, Dialog (focus trap, Esc), Notice (tone danger bắt buộc có action), Toast. Kèm trang thử nội bộ /dev/components sau feature flag.
- AppHeader bản đầu (logo, [Tên app] lấy từ một hằng số, điều hướng), CHƯA có chip hạn mức.
- Khung màn Cài đặt (MH-11) với mục "Chung" và "Dữ liệu" đọc/ghi bảng settings qua IPC có zod.
- So sánh trực quan với Document/UI_Mockups/11-cai-dat.html: màu, cỡ chữ, bo góc, khoảng cách phải khớp.

Không làm: chat, CLI, hạn mức.
```

### Phase 2 — Kết nối CLI

```text
Phase giao: PHASE 2 — Kết nối CLI (PLAN mục 8) + giao diện Phase 2 (UI_SPEC mục 9).

- Adapter theo interface PLAN mục 4.4. Mọi logic riêng của một CLI nằm trong thư mục adapter (P4). Lệnh và định dạng lấy từ kết quả Phase 0 ở PLAN mục 9, KHÔNG từ trí nhớ.
- Fixture test cho cả ba adapter, dùng spikes/fixtures từ Phase 0 (P5).
- Màu hiển thị của AI là thuộc tính của adapter (UI_SPEC mục 2, ghi chú IMPORTANT), không map theo tên trong renderer.
- Giao diện: MH-01 bản đơn giản dùng dữ liệu thật từ agents.detectAll (đủ 5 trạng thái ở UI_SPEC MH-01); MH-11 mục "AI và model": bảng AI trên máy + bảng bậc model đọc từ file ánh xạ (P10), model mới chưa có trong file hiện "Chưa xếp bậc".
- Kiểm tra B4: viết test AI cố ghi ra ngoài thư mục dự án → bị chặn.
- "Mở cửa sổ đăng nhập" mở cửa sổ dòng lệnh hệ thống chạy lệnh đăng nhập chính thức; app không đọc token (B3).
```

### Phase 3 — Chat và điều phối cơ bản

```text
Phase giao: PHASE 3 — Chat và điều phối cơ bản (PLAN mục 8) + giao diện Phase 3 (UI_SPEC mục 9).

Màn phải làm, theo đúng đặc tả từng màn trong UI_SPEC mục 5:
- MH-02 Chọn/tạo dự án.
- MH-03 phần: header (chưa chip hạn mức), khung chat, PlanCard, StepRow (mọi trạng thái ở UI_SPEC 3.1 thuộc phase này), SystemLine, Composer (Dừng, AiPicker), tab "Điều phối chi tiết". Tab "Xem trước" và "Code của bước" chỉ hiện khung + trạng thái "chưa có" (làm ở Phase 4).
- MH-04 Xin phép (không làm ô "Luôn cho phép" trừ khi Q1 đã chốt).
- MH-07 chuỗi dự phòng + thẻ tạm dừng (các nút [CHƯA CHỐT] chỉ làm nếu đã chốt Q3, Q4).
- MH-12 các trường hợp thuộc phase này.

Yêu cầu:
- View model theo UI_SPEC mục 6, IPC theo mục 7 (đổi tên kênh thì cập nhật bảng).
- Mỗi lần router đổi ô (CLI, model): đúng 1 dòng decisions + 1 SystemLine + 1 dòng nhật ký (PLAN 4.5a).
- So sánh trực quan với 03-man-hinh-chinh.html, 04-xin-phep.html, 07-het-han-muc.html.
- Chạy toàn bộ mục "Kiểm tra" của MH-02, MH-03 (phần thuộc phase), MH-04, MH-07 trong UI_SPEC và báo kết quả từng mục.
- Tiêu chí thoát của PLAN: "làm cho tôi trang landing đơn giản" chạy trọn và đổi được model khi một model hết hạn mức (có thể giả lập rate_limit bằng fixture).
```

### Phase 4 — Xem code và lưới an toàn

```text
Phase giao: PHASE 4 — Xem code và lưới an toàn (PLAN mục 8) + giao diện Phase 4 (UI_SPEC mục 9).

- Chọn Monaco hay CodeMirror 6: so sánh ngắn (kích thước bundle, diff, tiếng Việt, CSP), đề xuất cho tôi, chờ tôi chốt, ghi ADR.
- Chọn cách nhúng Xem trước (webview / WebContentsView): đề xuất, chờ tôi chốt, ghi ADR. Trang xem trước không được truy cập preload của app.
- Màn: MH-03 tab "Code của bước" (3 mức, File đã đổi, WhyBox, hoàn tác có cảnh báo bước phụ thuộc, "Hỏi đoạn này làm gì?") và tab "Xem trước"; MH-05 Xung đột; MH-06 Tự sửa trực tiếp; MH-09 Lịch sử/nhật ký/bản đồ; MH-12 phần liên quan.
- Cách tìm "chỗ sửa được" ở MH-06 và nguồn dữ liệu bản đồ dự án (Q7) đang [CHƯA CHỐT]: đề xuất cho tôi trước khi làm.
- Kiểm tra bắt buộc (báo từng mục): hoàn tác bất kỳ bước nào không hỏng dự án; tự sửa rồi AI không ghi đè mà ra MH-05; dự án có git của người dùng thì .git không đổi (so hash trước/sau); MH-06 lưu chỉ đổi đúng chỗ (so từng byte phần còn lại).
```

### Phase 5 — Hiển thị hạn mức

```text
Phase giao: PHASE 5 — Hiển thị quota (PLAN mục 8, mục 6.6) + giao diện Phase 5 (UI_SPEC mục 9).

- QuotaBar, QuotaChip, QuotaPopover, toast low/exhausted, MH-08, và phần hiển thị hạn mức ở MH-07.
- Chữ trên chip, màu chip, nhãn nguồn, câu phạm vi: theo ĐÚNG UI_SPEC 3.2, 3.3 và MH-03 mục 5.3.1. Viết unit test cho hàm định dạng chữ chip với đủ trường hợp: shared, model (1, 2, 3+ model), unknown, tất cả hết, source estimated.
- Câu "Đọc hạn mức không tốn hạn mức" ở MH-08 chỉ hiện nếu Phase 0 đã xác minh đúng (xem PLAN mục 9).
- Parser lỗi → unknown cho đúng CLI đó, các CLI khác bình thường, app không lỗi. Có fixture test.
- Router: loại ô exhausted, giảm ưu tiên ô low, không loại oan cả CLI khi chỉ một model hết (trừ scope shared).
```

### Phase 6 — Plugin v1

```text
Phase giao: PHASE 6 — Plugin v1 (PLAN mục 8, mục 6.7) + MH-10 (UI_SPEC).

- Manifest + zod, checksum, 4 loại plugin, danh mục chính thức, cài/cập nhật/gỡ một nút.
- MH-10 theo UI_SPEC: lưới thẻ, bộ lọc, hộp thoại xin quyền (theo quyết định Q8), cài từ link có cảnh báo, plugin hỏng tự tắt.
- AI thêm qua plugin agent-adapter phải hiện được ở MH-01, MH-11, chip hạn mức (màu lấy từ manifest, thiếu thì dùng muted).
- Kiểm tra: một plugin mẫu mỗi loại; plugin không vượt quyền; plugin hỏng không làm sập app.
```

### Phase 7 — Installer, ký số, tự cập nhật

```text
Phase giao: PHASE 7 — Installer, ký số, tự cập nhật (PLAN mục 8).

- Ngoài checklist của PLAN: hoàn thiện MH-01 (đủ stepper 3 bước: Chào mừng → Kiểm tra AI → Chọn dự án, đánh dấu onboarding_done) và MH-11 mục "Cập nhật".
- Lệnh cài và link tài liệu từng CLI trong MH-01 lấy từ cấu hình adapter đã xác minh, không hard-code trong component.
- Thử cài sạch + nâng cấp từ bản cũ: mọi thiết lập ở MH-11 và dữ liệu chat còn nguyên.
```

### Phase 8 — Beta kín

```text
Phase giao: PHASE 8 — Beta kín (PLAN mục 8).

- MH-11 mục "Báo lỗi": gom log đã lọc (P9), "Xem nội dung sẽ gửi" hiển thị TOÀN BỘ nội dung trước khi gửi, người dùng duyệt mới gửi.
- Số liệu ẩn danh chỉ làm nếu câu hỏi mở trong PLAN đã chốt; nếu làm thì mặc định tắt.
```

---

## 3. Prompt K — Tự kiểm tra khi AI báo xong

```text
Trước khi tôi chấp nhận, hãy tự kiểm tra và báo cáo bằng bảng (Mục · Kết quả · Bằng chứng):

1. Chạy: test, lint, type-check, build. Dán tóm tắt kết quả (số test qua/lỗi).
2. Mở app thật, đi qua các màn của phase này. Với mỗi màn: so với mockup tương ứng trong Document/UI_Mockups/ (màu, chữ, bo góc, khoảng cách), liệt kê chỗ khác và lý do.
3. Chạy từng mục "Kiểm tra" của các màn thuộc phase trong UI_SPEC mục 5. Mục nào chưa đạt: ghi rõ.
4. Rà vi phạm:
   - Có chuỗi tiếng Việt nào viết thẳng trong component (không qua i18n) không?
   - Có tên model / tên gói / lệnh CLI nào hard-code không? (grep tên model, "claude", "gpt", "gemini" trong src/renderer và src/main ngoài thư mục adapter)
   - Có "any" không chú thích lý do không?
   - Có kênh IPC nào thiếu zod không?
   - Có Notice tone danger nào không có nút hành động không?
   - Log có thể chứa token / nội dung .env không?
5. Tài liệu: PROJECT_PLAN.md đã cập nhật Bảng trạng thái, checklist, Ghi chú giai đoạn, Nhật ký, phiên bản chưa? UI_SPEC.md cần cập nhật không (kênh IPC đổi tên, trạng thái mới…)?
6. Liệt kê nợ kỹ thuật và việc bị hoãn đã ghi vào PLAN.

Chỉ nói "xong" khi mọi mục đạt hoặc tôi đồng ý bỏ qua mục cụ thể.
```

---

## 4. Prompt R — Nhờ AI khác soát lại (dán cho một AI khác)

```text
Bạn là người review độc lập. Một AI khác vừa làm PHASE {số} của dự án này.
Đọc Document/PROJECT_PLAN.md và Document/UI_SPEC.md trước, rồi xem các thay đổi (git diff từ {nhánh/commit gốc} hoặc các commit của phase này).

Hãy kiểm tra và báo cáo theo mức độ (Nghiêm trọng / Nên sửa / Góp ý), mỗi mục kèm file:dòng:
1. Vi phạm luật trong PLAN mục 2 (đặc biệt B1–B7, P1–P10, U1–U5).
2. Làm lệch UI_SPEC: trạng thái thiếu, hành vi khác, làm phần [CHƯA CHỐT]/[SAU MVP] khi chưa chốt.
3. Làm vượt phạm vi phase (A2).
4. Thiếu test bắt buộc (fixture adapter, các mục "Kiểm tra" của màn).
5. Tài liệu không khớp code (Luật T).
6. Giao diện khác mockup mà không có lý do.

KHÔNG sửa code. Chỉ báo cáo. Nếu không chắc một điểm là lỗi, ghi "cần hỏi chủ dự án".
```

---

## 5. Prompt Q — Chốt các câu hỏi mở trước khi làm

```text
Đọc Document/UI_SPEC.md mục 8 và Document/PROJECT_PLAN.md mục 12.
Tôi chốt như sau:
{dán danh sách, ví dụ:
Q1: Không có "Luôn cho phép". Mỗi lần đều hỏi.
Q3: Để sau MVP.
Q5: Có, làm migration 002.
...}

Hãy:
1. Với mỗi câu đã chốt: thêm ADR mới vào PROJECT_PLAN mục 10 (bối cảnh, quyết định, lý do, hệ quả).
2. Sửa các ô [CHƯA CHỐT] liên quan trong UI_SPEC.md thành quyết định cụ thể, gạch dòng trong bảng mục 8 (~~như vầy~~, ghi "đã chốt, xem ADR-xxx").
3. Nếu quyết định làm mockup sai: sửa mockup trong Document/UI_Mockups/ cho khớp.
4. Tăng phiên bản cả hai file, ghi Nhật ký.
5. Câu nào tôi chưa trả lời: giữ nguyên, liệt kê lại cho tôi.
KHÔNG viết code sản phẩm trong phiên này.
```

---

## 6. Prompt nhỏ dùng khi cần

**Khi AI làm lan sang việc ngoài phase:**
```text
Dừng. Việc "{việc}" nằm ngoài phase hiện tại. Hoàn tác phần đó, ghi nó vào mục "Việc bị hoãn / ý tưởng mới" của phase trong PROJECT_PLAN, rồi tiếp tục đúng checklist.
```

**Khi AI đoán lệnh / định dạng CLI:**
```text
Lệnh/định dạng "{...}" lấy từ đâu? Nếu không phải từ PLAN mục 9 hoặc chạy thật trên máy này, hãy chạy thật hoặc đọc tài liệu hiện hành, ghi kết quả vào PLAN mục 9 rồi mới dùng (Luật A4).
```

**Khi giao diện lệch mockup:**
```text
So màn {MH-xx} với Document/UI_Mockups/{file}.html. Liệt kê mọi khác biệt về màu (đối chiếu token UI_SPEC mục 2), cỡ chữ, bo góc, khoảng cách, câu chữ. Sửa cho khớp, trừ khi UI_SPEC nói khác.
```

**Khi bắt đầu lại sau khi nghỉ / đổi AI giữa chừng:**
```text
Đọc PROJECT_PLAN.md (đặc biệt Bảng trạng thái, Ghi chú giai đoạn của phase đang làm, Nhật ký 5 dòng mới nhất) và UI_SPEC.md. Tóm tắt: phase đang làm, việc đã xong, việc còn lại, vấn đề đang dở. Chờ tôi xác nhận rồi làm tiếp.
```

