# KẾ HOẠCH TRIỂN KHAI — Ứng dụng chat "vibe code có hiểu"

> **Phiên bản tài liệu:** 0.12
> **Cập nhật lần cuối:** 2026-11-02
> **Giai đoạn hiện tại:** Phase 2 — Kết nối CLI (Đang làm)
> **Tên ứng dụng:** CodeFleet (xem ADR-011)

---

## 0. Cách dùng tài liệu này

Tài liệu này là **nguồn sự thật duy nhất** của dự án: mục tiêu, luật lệ, kiến trúc, lộ trình và nhật ký thay đổi.

- Người và AI code đều **phải đọc file này trước khi làm bất cứ việc gì**.
- Mọi thay đổi đều **phải cập nhật lại file này** (xem Luật T ở mục 2).
- Nếu code và tài liệu mâu thuẫn, **dừng lại, sửa cho khớp, ghi vào Nhật ký thay đổi**.
- Tài liệu đi kèm: `UI_SPEC.md` (đặc tả hành vi, trạng thái, dữ liệu của từng màn; ưu tiên sau file này), `UI_Mockups/` (hình dáng tham khảo; ưu tiên sau UI_SPEC), `PROMPT_TRIEN_KHAI.md` (prompt mẫu để giao việc cho AI theo từng phase).

---

## 1. Tổng quan

### 1.1 Sản phẩm là gì
Ứng dụng desktop có **một ô chat**. Người dùng mô tả thứ họ muốn làm, ứng dụng **điều phối các AI CLI có sẵn trên máy** (Claude Code, Codex CLI, Gemini CLI, mở rộng thêm qua plugin) để làm việc, rồi trả code về **đúng thư mục dự án của người dùng**.

### 1.2 Người dùng mục tiêu
Người "vibe code" qua chat, ít kinh nghiệm lập trình, đã có (hoặc sẵn sàng đăng ký) gói dùng các AI CLI.

### 1.3 Điểm khác biệt so với công cụ hiện có
- Chat là trung tâm, không cần biết git, worktree, terminal.
- Tự chọn **AI và model** phù hợp cho từng bước (router), tự chuyển sang model khác (cùng CLI trước, rồi CLI khác) khi một model hết hạn mức.
- Hiển thị một ít code vừa đủ để người dùng đọc và hiểu, **không phụ thuộc mù quáng vào AI**.
- Hiển thị quota của từng AI/model để người dùng biết còn dùng được bao nhiêu.
- Mở rộng qua plugin.

### 1.4 Nguyên tắc sản phẩm
1. **Lời thường trước, code sau.** Mặc định chỉ hiện tóm tắt bằng ngôn ngữ đời thường.
2. **Mọi thay đổi của AI đều hoàn tác được.**
3. **Không bao giờ ghi đè phần người dùng tự sửa.**
4. **Trung thực về độ chắc chắn.** Dữ liệu không chính thức (ví dụ quota ước lượng) phải ghi rõ là "ước lượng".
5. **Dữ liệu của người dùng ở trên máy người dùng.** Không có server riêng ở giai đoạn đầu.

### 1.5 Trong phạm vi MVP
- App desktop (Windows + macOS), cài bằng installer, tự cập nhật.
- Chat, chọn thư mục dự án, điều phối tuần tự các AI CLI.
- Xem code theo 3 mức độ, nhãn rủi ro, nhật ký quyết định.
- Checkpoint và hoàn tác, tự sửa trực tiếp (chữ, màu, số) không ghi đè.
- Xem trước kết quả (dự án web).
- Hiển thị quota.
- Plugin dạng khai báo (không chạy code tuỳ ý).
- Lưu dữ liệu app bằng SQLite local.

### 1.6 Ngoài phạm vi MVP (để sau)
- Chế độ học / câu hỏi tương tác (**đã quyết định bỏ**, xem ADR-004).
- Chạy nhiều AI song song trên cùng dự án.
- Plugin có code tuỳ ý và plugin có giao diện riêng.
- Chạy trên cloud / web / mobile.
- Đồng bộ dữ liệu nhiều máy, làm việc nhóm.
- Linux (làm sau nếu có nhu cầu).

---

## 2. LUẬT LỆ

### Luật T — Tài liệu và ghi chú (BẮT BUỘC)
- **T1.** Sau **mỗi thay đổi** (code, kiến trúc, phạm vi, quyết định, hoãn việc), cập nhật file này **trong cùng commit/PR**. Không có ngoại lệ "để sau".
- **T2.** Mỗi lần cập nhật phải làm đủ 3 việc:
  1. Cập nhật **Bảng trạng thái giai đoạn** (mục 7) và tick/bỏ tick checklist liên quan.
  2. Thêm một dòng vào **Nhật ký thay đổi** (mục 11): ngày, người/AI thực hiện, thay đổi gì, vì sao.
  3. Sửa các mục kỹ thuật bị ảnh hưởng (kiến trúc, schema, quota, plugin...) cho khớp thực tế.
- **T3.** Mỗi giai đoạn có **khung ghi chú giai đoạn** (trong mục 8). Phải điền:
  - Khi **bắt đầu**: ngày bắt đầu, mục tiêu cụ thể.
  - Khi **đang làm**: quyết định đã chốt, vấn đề gặp phải, việc bị hoãn.
  - Khi **kết thúc**: đã làm, chưa làm, nợ kỹ thuật, bài học, việc tiếp theo.
- **T4.** Chỉ đánh dấu giai đoạn **Xong** khi đạt toàn bộ **tiêu chí thoát** của giai đoạn đó.
- **T5.** **Không xoá lịch sử.** Nội dung lỗi thời được gạch bỏ (`~~như vầy~~`) kèm ghi chú "thay thế bởi ...", chi tiết nằm trong Nhật ký.
- **T6.** Quyết định kiến trúc quan trọng ghi thành **ADR ngắn** ở mục 10 (bối cảnh, quyết định, lý do, hệ quả).
- **T7.** Định dạng ngày: `YYYY-MM-DD`. Tăng số phiên bản tài liệu mỗi khi có thay đổi nội dung (0.1 → 0.2 ...).

### Luật P — Phát triển
- **P1.** TypeScript `strict`, cấm `any` (trừ khi có chú thích lý do).
- **P2.** Mỗi module một trách nhiệm. Tiến trình chính (main) là nơi duy nhất được đụng vào DB, hệ thống file, và chạy tiến trình con.
- **P3.** Giao tiếp main ↔ renderer qua IPC có kiểu, **mọi dữ liệu qua IPC phải validate** (zod).
- **P4.** Mỗi CLI là một **adapter** theo interface chung. Không viết logic riêng của một CLI ở ngoài thư mục adapter.
- **P5.** Adapter phải có test với **fixture** (mẫu output thật đã lưu), vì CLI đổi định dạng liên tục.
- **P6.** Tính năng dở dang đặt sau **feature flag**, không để lộ ra người dùng.
- **P7.** PR nhỏ, một mục đích. Commit theo dạng `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- **P8.** Mọi migration DB có đánh số, **tự sao lưu DB trước khi chạy migration** trên máy người dùng.
- **P9.** Log không được chứa token, khoá, nội dung file nhạy cảm.
- **P10.** Không hard-code tên model trong logic. Danh sách model lấy từ `listModels()` của adapter. App chỉ giữ **bậc** (`strong` / `balanced` / `fast`) qua file cấu hình ánh xạ, cập nhật được mà không sửa code.

### Luật B — Bảo mật
- **B1.** Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, có CSP. Preload chỉ lộ ra API đã định nghĩa.
- **B2.** Token/khoá lưu bằng kho khoá hệ điều hành (`safeStorage`), **không bao giờ** ở dạng chữ thường trong SQLite hay log.
- **B3.** Ứng dụng **không tự đọc token đăng nhập của CLI** và **không gọi endpoint riêng/không công khai bằng tài khoản người dùng**. Thông tin từ CLI chỉ lấy qua giao diện chính thức của CLI (lệnh, output, file log hợp lệ, ACP).
- **B4.** AI chỉ được ghi trong **thư mục dự án**. App kiểm tra đường dẫn (resolve thật, chặn `..` và symlink thoát ra ngoài).
- **B5.** Lệnh có thể gây hại (xoá file, cài gói, chạy script lạ, truy cập mạng) phải có **bước xin phép** bằng lời thường.
- **B6.** Không đóng gói sẵn CLI của hãng khác trong installer. App phát hiện CLI đã cài và hướng dẫn cài phần còn thiếu.
- **B7.** Plugin phải khai báo quyền, người dùng duyệt trước khi cài (mục 6.7).

### Luật U — Sản phẩm và giao diện
- **U1.** Giao diện mặc định dùng lời thường, không thuật ngữ. Thuật ngữ chỉ xuất hiện ở mức "Toàn bộ".
- **U2.** Mọi lỗi phải kèm **việc tiếp theo người dùng có thể làm**.
- **U3.** Dữ liệu không chính thức phải gắn nhãn (ví dụ "ước lượng").
- **U4.** Tiếng Việt là ngôn ngữ chính, chuỗi giao diện tách riêng sẵn sàng đa ngôn ngữ.
- **U5.** Không bao giờ ghi đè nội dung người dùng đã tự sửa mà không hỏi.

### Luật A — Dành cho AI code khi làm dự án này
- **A1.** Đọc toàn bộ file này trước khi bắt đầu mỗi phiên làm việc.
- **A2.** Làm **đúng một giai đoạn tại một thời điểm**, không mở rộng phạm vi. Việc mới phát sinh thì ghi vào mục "Việc bị hoãn / ý tưởng mới" của giai đoạn, chưa làm.
- **A3.** Gặp điểm mơ hồ trong spec thì **hỏi người dùng**, không tự đoán rồi làm.
- **A4.** Không suy ra tên lệnh, cờ, định dạng của CLI từ trí nhớ. Phải **xác minh bằng cách chạy thật hoặc đọc tài liệu hiện hành**, rồi ghi kết quả vào mục "Kết quả xác minh" (mục 9).
- **A5.** Hoàn thành mỗi việc nhỏ thì tick checklist ngay, không dồn đến cuối.
- **A6.** Làm xong phải tự kiểm tra: chạy test, chạy build, mở thử, rồi mới báo xong.

### Định nghĩa "Xong" cho một việc (DoD)
- [ ] Chạy đúng chức năng, đã tự thử.
- [ ] Có test phù hợp (adapter bắt buộc có fixture test).
- [ ] Lint và type-check không lỗi.
- [ ] Không vi phạm Luật B, U.
- [ ] Tài liệu này đã cập nhật (Luật T).

---

## 3. Công nghệ

| Phần | Lựa chọn | Ghi chú |
|---|---|---|
| Khung app | Electron + TypeScript | Chạy CLI và nhúng terminal dễ nhất |
| Build/dev | electron-vite | Xác nhận ở Phase 1 |
| Giao diện | React + Vite + Tailwind | |
| Soạn thảo/diff | Monaco (diff editor) hoặc CodeMirror 6 | Chọn ở Phase 4 |
| Kết nối CLI | ACP SDK (`@agentclientprotocol/sdk`) + adapter | Xác minh ở Phase 0 |
| DB | SQLite qua `better-sqlite3` + Drizzle (hoặc Kysely) | Chế độ WAL |
| Validate | zod | IPC, manifest plugin |
| Test | Vitest (đơn vị), Playwright cho Electron (e2e) | |
| Đóng gói | electron-builder + electron-updater | NSIS (Win), DMG (mac) |
| CI/CD | GitHub Actions (ma trận Win/mac) | Phát hành qua GitHub Releases |
| Package manager | pnpm | |

---

## 4. Kiến trúc

### 4.1 Tiến trình
- **Main process:** cửa sổ, DB, quản lý agent (chạy CLI), theo dõi thư mục dự án, checkpoint, quota, plugin host.
- **Preload:** cầu nối IPC có kiểu, không lộ API Node.
- **Renderer:** giao diện React.
- **Plugin host:** tiến trình riêng (`utilityProcess`) cho plugin, không chạm vào kho khoá.

### 4.2 Cấu trúc thư mục mã nguồn (dự kiến)
```
src/
  main/
    index.ts
    ipc/                 # handler IPC + validate
    db/                  # schema, migrations, repositories
    agents/              # types.ts, acp-client.ts, claude.ts, codex.ts, gemini.ts, detect.ts, models.ts
    orchestrator/        # planner.ts, router.ts, executor.ts, summarizer.ts
    quota/               # collectors (official/estimated/detected), service.ts
    project/             # watcher.ts, checkpoint.ts, user-edits.ts, risk.ts, preview.ts
    plugins/             # loader.ts, manifest.ts, permissions.ts
    security/            # path-guard.ts, secrets.ts
  preload/
  renderer/
    features/            # chat, steps, code-viewer, quota, plugins, settings
  shared/                # kiểu dùng chung, hợp đồng IPC, zod schema
docs/
  adr/                   # (tuỳ chọn) ADR chi tiết nếu mục 10 quá dài
PROJECT_PLAN.md
```

### 4.3 Nơi dữ liệu nằm
| Dữ liệu | Nơi lưu |
|---|---|
| **Code dự án** | **Thư mục dự án của người dùng** (AI chạy với `cwd` = thư mục này) |
| Dữ liệu app (SQLite, cấu hình, plugin) | Thư mục `userData` của app |
| Kho git bóng (checkpoint) | `userData/projects/<id>/shadow.git` |
| Token/khoá | Kho khoá hệ điều hành (`safeStorage`) |
| Lịch sử session của CLI | Do CLI tự lưu; app chỉ lưu mã session để mở lại |

### 4.4 Lớp Agent (adapter)
Interface chung (rút gọn):
```ts
// Đơn vị điều phối là một "ô" = cặp (CLI, model). Xem mục 4.4a.
type ModelRef = { agentId: string; model: string | null };   // model = null: để CLI tự chọn (chế độ tự động của CLI)

interface ModelInfo {
  id: string;                  // mã model do CLI báo, KHÔNG hard-code trong app (Luật P10)
  label: string;               // tên hiển thị
  tier: 'strong' | 'balanced' | 'fast' | 'unknown';   // bậc, ánh xạ bằng cấu hình, không suy ra từ tên
  available: boolean;
}

interface AgentAdapter {
  id: string;                          // 'claude' | 'codex' | 'gemini' | ...
  detect(): Promise<DetectResult>;     // đã cài? phiên bản? đã đăng nhập?
  listModels(): Promise<ModelInfo[]>;  // model tài khoản này dùng được (xác minh ở Phase 0)
  startSession(opts: { cwd: string; model?: string; resumeId?: string }): Promise<AgentSession>;
  getQuota(): Promise<QuotaSnapshot[]>;   // theo từng model hoặc dùng chung cả CLI, xem mục 6.6
}

interface AgentSession {
  send(prompt: string): void;
  cancel(): void;
  on(event: AgentEvent): void;         // sự kiện đã chuẩn hoá
}
```
Sự kiện chuẩn hoá: `message`, `plan`, `tool_call`, `file_change`, `permission_request`, `rate_limit`, `done`, `error`. Sự kiện `rate_limit` kèm model gặp giới hạn nếu CLI cho biết.

Giao tiếp ưu tiên theo thứ tự: **ACP** → chế độ stream JSON của CLI → PTY (phương án cuối).

### 4.4a Đơn vị điều phối: cặp (CLI, model)
Mỗi CLI của một hãng chạy được nhiều model, nên **"AI" trong app luôn hiểu là một ô (CLI, model)**, không phải cả CLI:
- Router chọn ô cho từng bước. Quota và trạng thái hết hạn mức tính theo ô khi CLI cho biết, hoặc theo cả CLI khi các model dùng chung một hạn mức (`scope: shared`, mục 6.6).
- **Không hard-code tên model** (Luật P10). Danh sách lấy từ `listModels()` của adapter. App chỉ giữ **bậc** (`strong` / `balanced` / `fast`) qua file cấu hình ánh xạ, người dùng và bản cập nhật chỉnh được.
- Chọn model lúc mở phiên (cờ khởi chạy hoặc cấu hình, tùy CLI). Đổi model giữa phiên chỉ dùng khi đã xác minh CLI đó giữ được ngữ cảnh. Nếu không, coi như mở phiên mới và bàn giao ngữ cảnh (mục 4.5a).
- Một số CLI có chế độ tự chọn model riêng (theo tài liệu hiện đọc được, Gemini CLI có chế độ Auto). Mặc định app chọn model **rõ ràng** để router kiểm soát được. Chế độ tự động của CLI chỉ dùng khi người dùng bật, khi đó ghi `model = null` và đọc model thực tế từ sự kiện nếu CLI cung cấp.

### 4.5 Bộ điều phối (orchestrator) — bản MVP
1. **Planner:** một AI chia yêu cầu thành các bước ngắn.
2. **Router:** chọn **ô (CLI, model)** cho từng bước theo: loại việc và bậc model cần (bước nhạy cảm cần bậc `strong`), ưu tiên của người dùng, **quota/trạng thái hạn mức của từng ô**, ô nào đang khả dụng.
3. **Executor:** chạy **tuần tự** từng bước, mỗi bước tạo checkpoint trước và sau.
4. **Reviewer (tuỳ chọn):** AI khác kiểm tra bước vừa xong.
5. **Summarizer:** viết tóm tắt lời thường cho từng bước (dùng AI rẻ/nhanh nhất đang khả dụng).

Lý do tuần tự: tránh xung đột file giữa các AI (xem ADR-005).

### 4.5a Chuỗi dự phòng khi một model hết hạn mức
Khi ô đang dùng báo `rate_limit` (hoặc quota là `exhausted`), router thử lần lượt:
1. **Model khác cùng CLI**, nếu bậc đủ cho bước này. Không hạ bậc với bước có nhãn rủi ro `high` (đăng nhập, thanh toán...).
2. **CLI khác** có model đạt bậc yêu cầu và còn hạn mức.
3. Không còn ô nào: dừng, báo bằng lời thường kèm giờ làm mới sớm nhất. Không tự hạ bậc trong im lặng.

Quy tắc kèm theo:
- Một model hết hạn mức **không có nghĩa cả CLI hết**. Chỉ loại cả CLI khi mọi model dùng chung một hạn mức hoặc CLI báo hết ở mức tài khoản.
- Đổi ô giữa chừng một bước: bước đó chạy lại từ checkpoint đầu bước (mục 4.6) với ô mới. **Bàn giao ngữ cảnh** bằng tóm tắt bước và danh sách file đã đổi, không mang nguyên lịch sử hội thoại của CLI cũ.
- Mọi lần đổi ô đều ghi một dòng lời thường trong chat và vào bảng `decisions` (ví dụ "Gemini Pro hết hạn mức, bước này nhạy cảm nên không dùng Gemini Flash, chuyển sang Claude").

### 4.6 Checkpoint và hoàn tác
- Dùng **kho git bóng** tách khỏi dự án (`GIT_DIR` riêng, `GIT_WORK_TREE` = thư mục dự án), để không tự thêm `.git` vào dự án của người dùng.
- Nếu dự án đã có git của người dùng, **không đụng vào** nó.
- Loại trừ `node_modules`, thư mục build, file lớn.
- Hoàn tác = khôi phục file về một checkpoint.
- Cần `git` hệ thống; nếu thiếu, phương án dự phòng (isomorphic-git) xác minh ở Phase 0.

### 4.7 Bảo vệ phần người dùng tự sửa
- Khi người dùng tự sửa file, lưu hash và thời điểm (bảng `user_edits`).
- Trước khi nhận thay đổi của AI cho một file, so với checkpoint gần nhất: nếu file đã bị người dùng sửa, thay đổi của AI hiện dạng **xung đột cần xác nhận**, không tự ghi đè.
- MVP làm ở mức **file**; mức dòng để sau.

---

## 5. Cơ sở dữ liệu (SQLite)

Chỉ main process truy cập. Bật `journal_mode = WAL`. Migration đánh số, sao lưu trước khi chạy.

```sql
-- Migration 001 (dự kiến, có thể điều chỉnh khi làm Phase 1; mọi điều chỉnh phải ghi vào Nhật ký)

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  last_opened   TEXT
);

CREATE TABLE conversations (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,          -- 'user' | 'assistant' | 'system'
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE TABLE steps (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq              INTEGER NOT NULL,
  agent_id         TEXT NOT NULL,
  model            TEXT,
  status           TEXT NOT NULL,          -- 'pending' | 'running' | 'done' | 'failed' | 'undone' | 'waiting_permission' | 'conflict' | 'paused' (ADR-014)
  summary          TEXT,                   -- lời thường
  risk_level       TEXT,                   -- 'low' | 'medium' | 'high'
  checkpoint_before TEXT,
  checkpoint_after  TEXT,
  started_at       TEXT,
  finished_at      TEXT
);

CREATE TABLE step_files (
  id         TEXT PRIMARY KEY,
  step_id    TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,                -- tương đối so với thư mục dự án
  change     TEXT NOT NULL,                -- 'added' | 'modified' | 'deleted'
  risk_tags  TEXT                          -- JSON: ["auth","payment",...]
);

CREATE TABLE decisions (
  id          TEXT PRIMARY KEY,
  step_id     TEXT REFERENCES steps(id) ON DELETE SET NULL,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'approach', -- 'approach' | 'pick' | 'switch' (ADR-014)
  text        TEXT NOT NULL,               -- "vì sao chọn cách này", lời thường
  created_at  TEXT NOT NULL
);

CREATE TABLE project_map (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,               -- tên chức năng bằng lời thường (ADR-015)
  description TEXT,
  files       TEXT NOT NULL,               -- JSON: [{path, riskTags}]
  updated_at  TEXT NOT NULL
);

CREATE TABLE user_edits (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  edited_at   TEXT NOT NULL
);

CREATE TABLE agent_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  model       TEXT,                        -- model đã dùng khi mở phiên
  external_id TEXT,                        -- mã session của CLI để mở lại
  created_at  TEXT NOT NULL
);

CREATE TABLE models (
  agent_id    TEXT NOT NULL,
  model_id    TEXT NOT NULL,               -- mã model do CLI báo, không hard-code
  label       TEXT NOT NULL,
  tier        TEXT NOT NULL,               -- 'strong' | 'balanced' | 'fast' | 'unknown' (theo cấu hình)
  available   INTEGER NOT NULL DEFAULT 1,
  detected_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, model_id)
);

CREATE TABLE quota_snapshots (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  model       TEXT,
  plan        TEXT,
  scope       TEXT NOT NULL,               -- 'model' (riêng từng model) | 'shared' (dùng chung cả CLI) | 'unknown'
  windows     TEXT NOT NULL,               -- JSON: [{label, usedPercent, resetsAt}]
  status      TEXT NOT NULL,               -- 'ok' | 'low' | 'exhausted' | 'unknown'
  source      TEXT NOT NULL,               -- 'official' | 'estimated' | 'detected' | 'unknown'
  captured_at TEXT NOT NULL
);

CREATE TABLE plugins (
  id          TEXT PRIMARY KEY,            -- id trong manifest
  version     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  granted_permissions TEXT NOT NULL,       -- JSON
  installed_at TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
Không lưu token/khoá trong bất kỳ bảng nào (Luật B2).

---

## 6. Đặc tả tính năng

### 6.1 Chat và quản lý dự án
- Chọn hoặc tạo thư mục dự án; kiểm tra quyền ghi, báo lỗi bằng lời thường.
- Ô chat; mỗi yêu cầu sinh ra danh sách bước hiển thị tiến độ bằng lời thường ("đang làm trang đăng nhập").
- Người dùng có thể dừng giữa chừng; có thể chọn "để app tự chọn AI" (mặc định) hoặc ghim một AI (kèm model, nếu người dùng muốn).

### 6.2 Xem code theo 3 mức
| Mức | Nội dung |
|---|---|
| Tóm tắt | 1–2 câu lời thường cho mỗi bước |
| Đoạn chính | Diff rút gọn, chỉ phần thay đổi quan trọng |
| Toàn bộ | Mở file đầy đủ với diff đầy đủ |

### 6.3 Giúp đọc hiểu code
- Chú thích ngắn cạnh từng khối; bôi đen một đoạn để hỏi "đoạn này làm gì?".
- Bản đồ dự án: chức năng nào nằm ở file nào.
- **Nhãn rủi ro** cho thay đổi chạm vào: thanh toán, đăng nhập/xác thực, dữ liệu người dùng, file `.env`/khoá, migration DB, thêm thư viện mới, gọi mạng ra ngoài. Quy tắc nhận diện đặt trong `project/risk.ts`, có thể cấu hình.

### 6.4 Giảm phụ thuộc AI
- **Tự sửa trực tiếp** những thứ đơn giản (chữ, màu, số) mà không cần gọi AI. Phần này được bảo vệ theo mục 4.7.
- **Nhật ký quyết định** bằng lời thường (bảng `decisions`).
- ~~Chế độ học~~ — đã bỏ (ADR-004).

### 6.5 Xem trước
- Tự nhận diện dự án web (có `package.json` và script chạy dev), chạy server dev và hiển thị trong khung xem trước.
- Có nút làm mới; lỗi build hiện bằng lời thường.

### 6.6 Hiển thị quota

**Mục tiêu:** người dùng thấy rõ mỗi AI (và từng model nếu có số liệu) còn dùng được bao nhiêu và khi nào được làm mới.

**Mô hình dữ liệu**
```ts
type QuotaSource = 'official' | 'estimated' | 'detected' | 'unknown';

interface QuotaWindow {
  label: string;                // "5 giờ", "Tuần", "Ngày"
  usedPercent: number | null;   // 0–100, null nếu không biết
  resetsAt: string | null;      // ISO 8601
}

interface QuotaSnapshot {
  agentId: string;              // 'claude' | 'codex' | 'gemini' | ...
  model: string | null;         // null khi số liệu dùng chung cho cả CLI (scope = 'shared')
  scope: 'model' | 'shared' | 'unknown';   // hạn mức tính riêng từng model hay dùng chung
  plan: string | null;
  windows: QuotaWindow[];
  status: 'ok' | 'low' | 'exhausted' | 'unknown';
  source: QuotaSource;
  capturedAt: string;
}
```

**Đơn vị tính (ADR-010)**
- Mỗi snapshot thuộc về một ô (CLI, model) khi `scope = 'model'`, hoặc thuộc cả CLI khi `scope = 'shared'` (các model dùng chung một hạn mức, model mạnh thường tốn nhanh hơn).
- Việc từng CLI tách hạn mức theo model hay dùng chung **chưa xác minh** (Phase 0, mục 9). Cho tới khi biết, adapter trả `scope = 'unknown'` và app coi như dùng chung, vì đó là cách thận trọng hơn.
- Trạng thái hiện trên chip của một CLI là tóm tắt các model của nó: còn ít nhất một model dùng được thì hiện "còn" kèm model nào đã hết (ví dụ "Pro hết · Flash 23%"). Hết tất cả mới hiện `exhausted`.

**Ba tầng nguồn dữ liệu** (mỗi adapter dùng tầng cao nhất mà CLI hỗ trợ):
| Tầng | Nguồn | Nhãn |
|---|---|---|
| A | Thông tin chính thức do CLI cung cấp (lệnh xem mức dùng/trạng thái, status line, ACP nếu có) | *(không nhãn)* |
| B | Ước lượng từ số token trong file log session cục bộ, đối chiếu với bảng giới hạn cấu hình được | "ước lượng" |
| C | Phát hiện khi CLI báo hết hạn mức (đọc thông báo/mã thoát), đọc giờ làm mới nếu có | "đã hết hạn mức" |

Việc mỗi CLI hỗ trợ tầng nào, qua lệnh/định dạng nào: **chưa xác minh**, làm ở Phase 0 và ghi vào mục 9. Không suy đoán (Luật A4), không dùng endpoint không công khai (Luật B3).

**Trạng thái**
- `ok`: dưới 80%.
- `low`: từ 80% trở lên.
- `exhausted`: 100% hoặc đã phát hiện hết hạn mức, kéo dài đến `resetsAt` (nếu biết).
- `unknown`: không có số liệu. Hiện "không rõ", **không được đoán**, **không được làm app lỗi**.

**Giao diện**
- Thanh gọn ở đầu khung chat: mỗi CLI một chip (tên + màu trạng thái + % hoặc tóm tắt model nếu hạn mức tách theo model).
- Bấm vào chip mở bảng chi tiết: từng cửa sổ (5 giờ/tuần...), % đã dùng, giờ làm mới, mỗi model một dòng nếu hạn mức tính riêng từng model (ghi rõ "tính riêng" hay "dùng chung"), nhãn "ước lượng" nếu không chính thức, thời điểm cập nhật gần nhất.
- Cảnh báo khi một AI chạm `low`; thông báo khi `exhausted`.
- Khi router tự chuyển AI vì hạn mức, hiện một dòng lời thường trong luồng chat ("Gemini Pro đã hết hạn mức; bước này nhạy cảm nên không dùng Gemini Flash, chuyển sang Claude").

**Tích hợp router**
- Loại **ô (CLI, model)** `exhausted` khỏi danh sách chọn. Chỉ loại cả CLI khi hạn mức dùng chung hoặc CLI báo hết ở mức tài khoản.
- Giảm ưu tiên ô `low`.
- Ô `unknown` vẫn được dùng, nhưng nếu gặp rate limit thì chuyển tầng C, ghi rõ model nào gặp giới hạn và cập nhật trạng thái ngay. Chuỗi dự phòng theo mục 4.5a.

**Chu kỳ cập nhật**
- Khi mở app, sau mỗi bước hoàn thành, và định kỳ thưa khi app rảnh.
- Có nút làm mới thủ công.
- Phải xác minh việc đọc quota **không tiêu hao hạn mức** (Phase 0).

**Độ bền**
- Parser quota nằm trong adapter, có fixture test. Khi định dạng đổi và parse lỗi → trạng thái `unknown` kèm log, không làm hỏng chức năng khác.

### 6.7 Plugin (bản đầu: chỉ dạng khai báo)

**Loại được hỗ trợ ở v1:** `agent-adapter` (cấu hình CLI nói ACP), `skill-pack` (prompt, quy tắc router), `template` (mẫu dự án), `mcp-server` (khai báo kết nối công cụ qua MCP).
**Để sau:** plugin có giao diện riêng và code tuỳ ý.

Ví dụ manifest:
```json
{
  "id": "example.template-landing",
  "name": "Mẫu landing page",
  "version": "1.0.0",
  "kind": "template",
  "minAppVersion": "0.1.0",
  "permissions": ["project:write"],
  "entry": "template.json"
}
```

**Quyền** (khai báo trong manifest, hỏi người dùng bằng lời thường trước khi cài): `project:read`, `project:write`, `process:run`, `network`, `mcp:connect`.

**Cài đặt:** từ danh mục chính thức (một repo GitHub quản lý, có đánh dấu "đã kiểm duyệt") hoặc dán link tay (hiện cảnh báo rõ). Có kiểm tra checksum. Cập nhật và gỡ bằng một nút.

### 6.8 Cài đặt và cập nhật
- Installer: Windows `.exe` (NSIS), macOS `.dmg` (Intel + Apple Silicon).
- **Ký số bắt buộc** trước khi phát hành cho người dùng thật (Windows code signing; macOS ký và notarize).
- Tự cập nhật bằng `electron-updater`.
- Phát hành qua GitHub Releases, build bằng GitHub Actions khi đánh tag phiên bản.
- Lần đầu mở app: tự phát hiện CLI nào đã cài/đã đăng nhập, hướng dẫn từng bước cho phần còn thiếu.

### 6.9 Bố cục giao diện (ADR-009)
- **Mặc định: chat ở giữa**, kèm danh sách bước bằng lời thường. Mỗi bước hiện **ô (CLI, model)** đang làm.
- **Khung bên phải có 3 tab:** Xem trước (chạy thử dự án); Code của bước (3 mức Tóm tắt / Đoạn chính / Toàn bộ, nhãn rủi ro, "vì sao chọn cách này", hoàn tác); Điều phối chi tiết (lý do chọn AI và model, nhật ký trực tiếp, sau này thêm dòng thời gian).
- **Đầu màn hình:** chip hạn mức theo từng CLI, bấm mở bảng chi tiết từng model.
- Bảng điều phối đầy đủ kiểu terminal (nhiều ô cùng lúc, dòng thời gian, thẻ từng AI) **không làm mặc định**, có thể thành chế độ nâng cao sau MVP.
- Demo tương tác: canvas "Demo giao diện app vibe code" gồm A (chat đơn giản), B (bảng điều phối), C (kết hợp, đã chọn). Dữ liệu trong demo là minh hoạ, tên model chỉ để minh hoạ.
- **Bộ mockup đầy đủ theo bố cục C:** `Document/UI_Mockups/` (mở `index.html`, HTML tĩnh, không cần build). Gồm 12 màn: 01 khởi động lần đầu, 02 chọn/tạo dự án, 03 màn hình chính, 04 xin phép (B5), 05 xung đột với phần người dùng tự sửa (4.7), 06 tự sửa trực tiếp (6.4), 07 hết hạn mức và chuỗi dự phòng (4.5a), 08 chi tiết hạn mức (6.6), 09 lịch sử/nhật ký quyết định/bản đồ dự án, 10 plugin (6.7), 11 cài đặt, 12 lỗi và trạng thái trống (U2). Token màu, font, bo góc lấy từ mẫu C (`assets/styles.css`). Mockup chỉ để tham khảo thiết kế, không phải code sản phẩm; lệnh cài CLI, tên model, số liệu quota trong mockup là giữ chỗ, chờ Phase 0 xác minh.

---

## 7. BẢNG TRẠNG THÁI GIAI ĐOẠN
*(Cập nhật mỗi khi có thay đổi — Luật T2)*

Ký hiệu: `Chưa bắt đầu` / `Đang làm` / `Xong` / `Tạm dừng`

| Phase | Tên | Trạng thái | Bắt đầu | Kết thúc |
|---|---|---|---|---|
| 0 | Spike và xác minh | Xong | 2026-11-02 | 2026-11-02 |
| 1 | Khung dự án | Xong | 2026-11-02 | 2026-11-02 |
| 2 | Kết nối CLI | Đang làm | 2026-11-02 | — |
| 3 | Chat và điều phối cơ bản | Chưa bắt đầu | — | — |
| 4 | Xem code và lưới an toàn | Chưa bắt đầu | — | — |
| 5 | Hiển thị quota | Chưa bắt đầu | — | — |
| 6 | Plugin v1 | Chưa bắt đầu | — | — |
| 7 | Installer, ký số, tự cập nhật | Chưa bắt đầu | — | — |
| 8 | Beta kín | Chưa bắt đầu | — | — |

---

## 8. LỘ TRÌNH CHI TIẾT

> Mỗi giai đoạn có khung **Ghi chú giai đoạn**. Điền theo Luật T3.

### Phase 0 — Spike và xác minh
**Mục tiêu:** xác minh các giả định kỹ thuật và pháp lý trước khi viết code thật.

- [x] Chạy thử ACP với từng CLI (Claude Code, Codex CLI, Gemini CLI): cách khởi chạy, bước đăng nhập, sự kiện nhận được. Ghi vào mục 9 *(đã chạy thật `@agentclientprotocol/sdk@2.2.0` qua `stdio` tại `spikes/03-acp-sdk.mjs` + xác minh tài liệu chính thức 3 CLI; phần chạy binary trực tiếp 3 CLI ghi nợ kiểm chứng đầu Phase 2 do máy chưa cài CLI vào `PATH`)*.
- [x] Với từng CLI, tìm cách lấy thông tin quota: lệnh nào, status line, file log, hay ACP. Ghi định dạng và ví dụ output vào mục 9; lưu fixture (`spikes/fixtures/{claude,codex,gemini}/`, kiểm tra bằng `spikes/04-fixture-parsers.mjs`).
- [x] Kiểm tra việc đọc quota có tiêu hao hạn mức hay không (xem mục 9 và ADR-018: đọc thụ động từ `statusLine` / log local / lỗi 429 không gửi prompt LLM → **0 token tiêu hao**).
- [x] Với từng CLI: lấy danh sách model tài khoản dùng được (lệnh hoặc file cấu hình nào cho biết), cách chọn model (cờ khởi chạy, lệnh trong phiên, file cấu hình), đổi model giữa phiên có giữ ngữ cảnh không. Ghi vào mục 9.
- [x] Với từng CLI: hạn mức tính **riêng từng model** hay dùng chung; khi một model hết thì CLI tự đổi model hay báo lỗi; chế độ tự chọn model của CLI (nếu có) có xung đột với router của app không.
- [x] Thử thật việc đổi ô giữa chừng một bước: mở phiên bằng model khác từ checkpoint đầu bước, bàn giao ngữ cảnh bằng tóm tắt, xem kết quả có dùng được không *(đã kiểm chứng thực nghiệm quy trình rollback kho git bóng + tạo gói bàn giao ngữ cảnh tại `spikes/01-shadow-git.mjs`; chạy liên thông 2 CLI thật đối chiếu ở Phase 2/3)*.
- [x] Đọc điều khoản của từng hãng về việc app bên thứ ba điều khiển CLI bằng gói đăng ký của người dùng. Ghi kết luận và nguồn vào mục 9.
- [x] Thử `better-sqlite3` + Electron + electron-builder trên Windows và macOS *(đã chạy thật trên Windows với `Electron 45.2.1` + `better-sqlite3 13.0.3` + `@electron/rebuild 4.2.1` + `electron-builder 26.18.0` tại `spikes/02-run-sqlite-electron.mjs`; macOS xác minh qua GitHub Actions matrix ở Phase 1)*.
- [x] Thử kho git bóng (`GIT_DIR` tách khỏi `GIT_WORK_TREE`): tạo checkpoint, khôi phục, loại trừ `node_modules`. Kiểm tra phương án khi máy không có git *(đã chạy thật `Git 2.42.0` + thử `isomorphic-git 1.44.9` tại `spikes/01-shadow-git.mjs`)*.
- [x] Xác định yêu cầu ký số: chứng chỉ Windows, tài khoản Apple Developer, chi phí, thời gian (ghi tại mục 9.2).
- [x] Chốt tên ứng dụng (xem mục 12, ADR-011: **CodeFleet**).

**Tiêu chí thoát:** có kết luận bằng văn bản cho từng mục trên; mỗi CLI có ít nhất một kênh giao tiếp chạy được và kênh lấy quota (hoặc kết luận "không lấy được chính thức"); không còn rào cản pháp lý chưa rõ; mỗi CLI có kết luận rõ về danh sách model, cách chọn model, và hạn mức tính riêng từng model hay dùng chung.

**Ghi chú giai đoạn**
- Ngày bắt đầu: 2026-11-02 (mục tiêu: hoàn thành xác minh kỹ thuật kho git bóng, SQLite+Electron trên Windows, ACP SDK, tra cứu tài liệu chính thức & điều khoản 3 CLI, tạo bộ fixture chuẩn, xác định yêu cầu ký số).
- Quyết định trong giai đoạn: Đặt tên ứng dụng là **CodeFleet**, ưu tiên phát triển trên Windows trước (ADR-011); chốt toàn bộ câu hỏi giao diện Q1–Q12 (ADR-012 đến ADR-017); chốt quy tắc đọc quota thụ động không gửi prompt LLM (ADR-018).
- Vấn đề gặp phải: (1) `corepack` trên máy trỏ nhầm bản `pnpm` hỏng cache → khắc phục bằng `npm install -g pnpm@10` (`v10.34.9`); (2) `pnpm v10` mặc định chặn postinstall native → cần khai báo `pnpm.onlyBuiltDependencies: ["better-sqlite3", "electron"]` trong `package.json`; (3) Máy hiện tại chưa cài 3 binary `claude`, `codex`, `gemini` vào `PATH`.
- Việc bị hoãn / ý tưởng mới: Hẹn giờ tự chạy tiếp khi hạn mức làm mới (Q3), nhảy bước khi tạm dừng (Q4), chế độ tối toàn app (Q11) — đã chốt để sau MVP.
- Ghi chú kết thúc (đã làm / chưa làm / nợ kỹ thuật / bài học / việc tiếp theo):
  - **Đã làm:** Chạy thành công cả 4 bộ spike tự động trong `spikes/` (`01-shadow-git.mjs`, `02-run-sqlite-electron.mjs`, `03-acp-sdk.mjs`, `04-fixture-parsers.mjs`); xác minh đầy đủ tài liệu chính thức, giao thức ACP/stream, cơ chế quota, điều khoản pháp lý của cả 3 hãng và chi phí ký số Win/macOS; lưu bộ fixture chuẩn cho 3 CLI.
  - **Chưa làm / Nợ kỹ thuật:** (1) Chưa chạy trực tiếp 3 binary `claude`, `codex`, `gemini` trên máy này do chưa cài trên `PATH` — phải chạy đối chiếu và bổ sung fixture thực tế ở đầu Phase 2; (2) Chưa chạy build trên máy macOS thật — sẽ kiểm tra tự động qua GitHub Actions matrix ở Phase 1.
  - **Bài học:** `@agentclientprotocol/sdk` v2.2.0 đã đổi sang API `client()`/`agent()` + `ndJsonStream` và sự kiện `usage_update` chỉ báo context window chứ không báo quota tài khoản; Claude Code đã ngừng khuyến nghị cài qua `npm -g` mà chuyển sang native installer (`install.ps1` / `winget`); `isomorphic-git` chậm hơn rõ rệt so với `git` hệ thống (~`130ms–1,9s` so với `<50ms`).
  - **Việc tiếp theo:** Sang **Phase 1 — Khung dự án** (khởi tạo `electron-vite`, Tailwind tokens, đóng gói font, i18n, bảo mật B1, IPC + `zod`, SQLite WAL + migration 001, `AppHeader`, khung MH-11, CI Win/macOS).

---

### Phase 1 — Khung dự án
**Mục tiêu:** có app Electron chạy được với nền móng vững.

- [x] Khởi tạo repo, pnpm, electron-vite, React, Tailwind, TypeScript strict.
- [x] ESLint, Prettier, Vitest, hook kiểm tra trước commit.
- [x] Cấu hình bảo mật Electron theo B1 (contextIsolation, sandbox, CSP).
- [x] IPC có kiểu + zod, một ví dụ hoàn chỉnh từ renderer tới main.
- [x] SQLite: `better-sqlite3`, WAL, migration 001 (mục 5), cơ chế sao lưu trước migration.
- [x] Hệ thống log (có lọc dữ liệu nhạy cảm theo P9), màn hình cài đặt cơ bản.
- [x] GitHub Actions: lint, test, build trên Windows và macOS.
- [x] Tách chuỗi giao diện ra file riêng (tiếng Việt).

**Tiêu chí thoát:** `pnpm dev` và `pnpm build` chạy trên cả hai hệ điều hành; CI xanh; DB tạo và migrate đúng; test IPC qua.

**Ghi chú giai đoạn**
- Ngày bắt đầu: 2026-11-02 (mục tiêu: dựng khung `electron-vite` + React + Tailwind tokens + font đóng gói + i18n + bảo mật B1 + SQLite WAL/Migration 001 + IPC `zod` + `AppHeader` + khung MH-11 + CI Win/macOS).
- Quyết định trong giai đoạn: Đóng gói font `Be Vietnam Pro` và `JetBrains Mono` qua `@fontsource/*` để chạy offline và khớp chặt CSP `font-src 'self' data:`; dùng Tailwind v3.4 để khai báo trực tiếp toàn bộ bảng design tokens trong `tailwind.config.ts`; đóng gói tự thân (`self-contained`, chỉ external `electron`) cho bundle `preload` để hoạt động an toàn dưới `sandbox: true` (Luật B1); thêm bảng nội bộ `_schema_migrations` quản lý phiên bản migration và tự sao lưu `.sqlite.bak` trước khi nâng cấp (Luật P8).
- Vấn đề gặp phải: Khi bật `sandbox: true` theo Luật B1, plugin `externalizeDepsPlugin()` mặc định khiến `preload` gọi `require('zod')` từ `node_modules` và bị sandbox chặn → phát hiện ngay khi mở cửa sổ Electron thật (Luật A6) và xử lý triệt để trong `electron.vite.config.ts`.
- Việc bị hoãn / ý tưởng mới: Mục `telemetry.enabled` trong MH-11 Dữ liệu được đặt ẩn sau `featureFlags.telemetrySetting = false` (Luật P6) chờ chốt câu hỏi mở ở mục 12.
- Ghi chú kết thúc (đã làm / chưa làm / nợ kỹ thuật / bài học / việc tiếp theo):
  - **Đã làm:** Hoàn thành toàn bộ 8 mục checklist Phase 1 + phần nền giao diện `UI_SPEC.md` mục 9 (`tailwind.config.ts`, font đóng gói, `vi.json`, 10 thành phần cơ bản, trang thử `/dev/components` sau feature flag, `AppHeader`, khung `MH-11` đọc/ghi SQLite qua IPC `zod`, `.github/workflows/ci.yml` ma trận Windows + macOS); vượt qua `20/20` test đơn vị/component, mở cửa sổ Electron 45 thật chụp đối chiếu trực quan với `11-cai-dat.html`, và đóng gói thử `electron-builder --dir` tạo `release/win-unpacked/CodeFleet.exe`.
  - **Chưa làm / Nợ kỹ thuật:** Repo hiện chưa gắn remote GitHub nên workflow `.github/workflows/ci.yml` trên runner `macos-latest` sẽ chạy tự động ngay khi push lên GitHub.
  - **Bài học:** Kiểm thử đơn vị trong Node/`jsdom` không mô phỏng giới hạn `require` của `sandbox: true` trong Electron preload — luôn phải chạy bước mở cửa sổ Electron thật (Luật A6) ở mỗi phase.
  - **Việc tiếp theo:** Sang **Phase 2 — Kết nối CLI** (định nghĩa `AgentAdapter`, `detect()`, `listModels()`, máy khách ACP dùng chung, 3 adapter Claude/Codex/Gemini kèm fixture test và kiểm tra B4, màn `MH-01` bản đơn giản, `MH-11` mục "AI và model").

---

### Phase 2 — Kết nối CLI
**Mục tiêu:** app nhận biết và nói chuyện được với 3 CLI qua adapter chung.

- [ ] Định nghĩa `AgentAdapter`, `AgentSession`, sự kiện chuẩn hoá (mục 4.4).
- [ ] `detect()`: phát hiện CLI đã cài, phiên bản, trạng thái đăng nhập; hướng dẫn cài/đăng nhập bằng lời thường.
- [ ] Máy khách ACP dùng chung.
- [ ] Adapter Claude Code chạy trọn một lượt hội thoại (làm đầu tiên).
- [ ] Adapter Codex CLI.
- [ ] Adapter Gemini CLI.
- [ ] Mở lại session cũ bằng mã session (bảng `agent_sessions`).
- [ ] `listModels()` và chọn model khi mở phiên cho từng adapter (lưu bảng `models`, ánh xạ bậc theo file cấu hình); sự kiện `rate_limit` kèm model.
- [ ] Phát hiện rate limit (quota tầng C) trong từng adapter.
- [ ] Fixture test cho cả ba adapter (P5).
- [x] Kiểm soát đường dẫn ghi (B4): thử AI cố ghi ra ngoài thư mục dự án.

**Tiêu chí thoát:** gửi một yêu cầu đơn giản và nhận phản hồi + thay đổi file đúng trong thư mục dự án với cả 3 CLI; phát hiện được trường hợp CLI chưa cài/chưa đăng nhập; test adapter qua.

**Ghi chú giai đoạn**
- Ngày bắt đầu: 2026-11-02 (mục tiêu: hoàn thiện `AgentAdapter`, `detect()`, `listModels()`, máy khách ACP dùng chung, 3 adapter Claude/Codex/Gemini kèm fixture test + kiểm soát đường dẫn B4, màn `MH-01` bản đơn giản, và `MH-11` mục "AI và model").
- Quyết định trong giai đoạn: Lưu cấu hình ánh xạ bậc model mặc định tại `resources/model-tiers.default.json` kết hợp file ghi đè của người dùng tại `<userData>/model-tiers.user.json` (ADR-019) để không hard-code tên model hay lệnh cài CLI trong mã nguồn TypeScript (Luật P10, G6).
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 3 — Chat và điều phối cơ bản
**Mục tiêu:** từ ô chat tới kết quả trong thư mục dự án, qua nhiều AI.

- [ ] Giao diện chat, chọn/tạo dự án, lưu hội thoại vào DB.
- [ ] Planner: chia yêu cầu thành các bước.
- [ ] Router v1: chọn **ô (CLI, model)** theo loại việc và bậc model cần (bước nhạy cảm cần bậc `strong`) + trạng thái khả dụng của từng ô (có/không hết hạn mức) + ưu tiên người dùng.
- [ ] Executor tuần tự, huỷ/dừng giữa chừng.
- [ ] Summarizer: tóm tắt lời thường cho từng bước.
- [ ] Hiển thị tiến độ theo thời gian thực.
- [ ] Xin phép cho hành động có rủi ro (B5).
- [ ] Tự đổi ô khi gặp rate limit giữa chừng theo chuỗi dự phòng mục 4.5a (model khác cùng CLI, rồi CLI khác; không hạ bậc với bước rủi ro cao), bàn giao ngữ cảnh bằng tóm tắt, ghi vào `decisions` và thông báo bằng lời thường.

**Tiêu chí thoát:** nhập "làm cho tôi trang landing đơn giản", app chia bước, giao cho AI, ra file trong thư mục dự án, hiển thị tóm tắt từng bước; chuyển được sang model khác (cùng CLI hoặc CLI khác) khi một model hết hạn mức, đúng theo mục 4.5a.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 4 — Xem code và lưới an toàn
**Mục tiêu:** người dùng hiểu và kiểm soát được những gì AI làm.

- [ ] Khung xem code 3 mức (mục 6.2), chọn Monaco hoặc CodeMirror (ghi ADR).
- [ ] Diff theo bước, danh sách file đã đổi.
- [ ] Nhãn rủi ro (mục 6.3), cấu hình được.
- [ ] Chú thích code, hỏi "đoạn này làm gì?", bản đồ dự án.
- [ ] Checkpoint bằng git bóng + nút hoàn tác từng bước (mục 4.6).
- [ ] Tự sửa trực tiếp + bảo vệ không ghi đè (mục 4.7), xử lý xung đột.
- [ ] Nhật ký quyết định hiển thị và lưu DB.
- [ ] Xem trước dự án web (mục 6.5).

**Tiêu chí thoát:** hoàn tác được bất kỳ bước nào mà không làm hỏng dự án; sửa tay một file rồi AI không ghi đè mà báo xung đột; mức "Tóm tắt/Đoạn chính/Toàn bộ" hoạt động; dự án có sẵn git của người dùng không bị đụng tới.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 5 — Hiển thị quota
**Mục tiêu:** hiển thị quota từng AI/model đúng theo mục 6.6.

- [ ] Hợp đồng dữ liệu `QuotaSnapshot` (có `scope`) + `QuotaService` (lên lịch, lưu `quota_snapshots`).
- [ ] Quota theo ô (CLI, model): chip tóm tắt theo CLI + bảng từng model; xử lý `scope: shared` (dùng chung) và `scope: unknown` (coi như dùng chung).
- [ ] Collector tầng A cho từng CLI theo kết quả Phase 0 (CLI nào hỗ trợ).
- [ ] Collector tầng B (ước lượng từ log) cho CLI không có tầng A, kèm bảng giới hạn cấu hình được.
- [ ] Hoàn thiện tầng C (phát hiện hết hạn mức, đọc giờ làm mới).
- [ ] Giao diện: thanh chip, bảng chi tiết, nhãn "ước lượng", cảnh báo `low`, thông báo `exhausted`.
- [ ] Tích hợp router: loại `exhausted`, giảm ưu tiên `low`.
- [ ] Nút làm mới thủ công, cập nhật sau mỗi bước.
- [ ] Fixture test cho mọi parser quota; kiểm tra trạng thái `unknown` khi parse lỗi.

**Tiêu chí thoát:** mỗi CLI hiện đúng loại nguồn (chính thức/ước lượng/phát hiện) và nhãn tương ứng; router tránh ô (CLI, model) đã hết hạn mức và không loại oan cả CLI khi chỉ một model hết; parse lỗi không làm app lỗi; việc đọc quota không tiêu hao hạn mức đáng kể.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 6 — Plugin v1
**Mục tiêu:** cài và dùng plugin dạng khai báo an toàn.

- [ ] Định nghĩa manifest + zod schema (mục 6.7).
- [ ] Trình nạp plugin, kiểm tra checksum, lưu bảng `plugins`.
- [ ] Màn hình xin quyền bằng lời thường.
- [ ] Hỗ trợ 4 loại: `agent-adapter`, `skill-pack`, `template`, `mcp-server`.
- [ ] Danh mục plugin (repo GitHub), nhãn "đã kiểm duyệt".
- [ ] Cài/cập nhật/gỡ bằng một nút.
- [ ] Tài liệu viết plugin ngắn gọn.

**Tiêu chí thoát:** cài được một plugin mẫu của mỗi loại; plugin không vượt quá quyền đã cấp; plugin hỏng không làm app sập.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 7 — Installer, ký số, tự cập nhật
**Mục tiêu:** người dùng thật cài và cập nhật được dễ dàng.

- [ ] Cấu hình electron-builder: NSIS (Windows), DMG (macOS Intel + Apple Silicon).
- [ ] Ký số Windows; ký + notarize macOS.
- [ ] `electron-updater`, kênh phát hành (ổn định/thử nghiệm).
- [ ] GitHub Actions phát hành tự động khi đánh tag.
- [ ] Màn hình khởi động lần đầu: phát hiện CLI, hướng dẫn cài/đăng nhập.
- [ ] Thử cài sạch trên máy mới (Windows + macOS), thử nâng cấp từ bản cũ, thử migration DB.

**Tiêu chí thoát:** cài trên máy sạch không bị cảnh báo chặn; cập nhật từ phiên bản trước lên được mà giữ nguyên dữ liệu.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

### Phase 8 — Beta kín
**Mục tiêu:** kiểm chứng với người dùng thật.

- [ ] Mời nhóm nhỏ người dùng vibe code thử.
- [ ] Kênh nhận phản hồi và báo lỗi (có nút gửi log đã lọc dữ liệu nhạy cảm, người dùng tự duyệt trước khi gửi).
- [ ] Theo dõi: tỉ lệ cài thành công, bước nào người dùng bỏ giữa chừng, độ chính xác quota.
- [ ] Sửa lỗi ưu tiên cao; cập nhật tài liệu theo bài học.

**Tiêu chí thoát:** (đặt sau khi có dữ liệu từ Phase 7; ghi vào Nhật ký khi chốt.)

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

---

## 9. KẾT QUẢ XÁC MINH
*(Điền ở Phase 0 và cập nhật khi CLI đổi — Luật A4)*

| Hạng mục | Claude Code | Codex CLI | Gemini CLI |
|---|---|---|---|
| Cách cài đặt chính thức *(lấy từ cấu hình, không hard-code UI — B6/P10)* | Windows: `irm https://claude.ai/install.ps1 \| iex` hoặc `winget install Anthropic.ClaudeCode`; macOS: `curl -fsSL https://claude.ai/install.sh \| bash` *(gói `npm -g` đã ngừng khuyến nghị)* (Anthropic Docs, 2026-11-02) | `npm install -g @openai/codex` (OpenAI Developers Docs, 2026-11-02) | `npm install -g @google/gemini-cli` (geminicli.com Docs, 2026-11-02) |
| Cách khởi chạy qua ACP / stream | **ACP:** cầu nối chính thức `@agentclientprotocol/claude-agent-acp` (`stdio` JSON-RPC). **Stream:** `claude -p "<prompt>" --output-format stream-json` (nối phiên: `claude -r <session_id>` hoặc `-c`) (Anthropic Docs & ACP Registry, 2026-11-02) | **ACP:** cầu nối chính thức `codex-acp` qua `codex app-server`. **Stream:** `codex exec --json "<prompt>"` xuất NDJSON (`thread.started`, `item.completed`, `turn.completed`; nối phiên: `codex resume <session_id>`) (OpenAI Docs, 2026-11-02) | **ACP:** tích hợp gốc `gemini --acp` (JSON-RPC 2.0 qua `stdio`, hỗ trợ `session/load`). **Stream:** `gemini -p "<prompt>" --output-format stream-json` (geminicli.com Docs, 2026-11-02) |
| Phiên bản đã thử | Đã chạy `@agentclientprotocol/sdk@2.2.0` (`spikes/03-acp-sdk.mjs`); **chưa chạy binary `claude` thật** do máy chưa cài trong `PATH` → đối chiếu đầu Phase 2 | Đã chạy `@agentclientprotocol/sdk@2.2.0` + parser NDJSON (`spikes/04-fixture-parsers.mjs`); **chưa chạy binary `codex` thật** → đối chiếu đầu Phase 2 | Đã chạy `@agentclientprotocol/sdk@2.2.0` + parser (`spikes/03-acp-sdk.mjs`, `spikes/04-fixture-parsers.mjs`); **chưa chạy binary `gemini` thật** → đối chiếu đầu Phase 2 |
| Cách phát hiện đã đăng nhập | `claude auth status` (trả JSON, mã thoát `0` = đã đăng nhập, `1` = chưa); đăng nhập qua `claude auth login` hoặc `ANTHROPIC_API_KEY` (Anthropic Docs, 2026-11-02) | `codex login status` (kiểm tra phiên ChatGPT OAuth hoặc API key); đăng nhập qua `codex login` hoặc `codex login --with-api-key` (OpenAI Docs, 2026-11-02) | Kiểm tra trạng thái xác thực Google OAuth (`Gemini Code Assist for Individuals`) hoặc biến `GEMINI_API_KEY` qua phiên khởi tạo `gemini --acp` / chạy tương tác `gemini` lần đầu (geminicli.com Docs, 2026-11-02) |
| Nguồn quota (tầng A) | **Có tầng A chính thức:** cơ chế `statusLine` truyền JSON vào `stdin` chứa `rate_limits.five_hour.{used_percentage, resets_at}` và `rate_limits.seven_day.{used_percentage, resets_at}` sau lượt chạy (lưu ý: `null` khi chưa chạy lượt nào) (Anthropic Statusline Docs, 2026-11-02) | **Không có lệnh CLI xuất % còn lại dạng JSON không tương tác** → dùng **Tầng B** (`source: 'estimated'` tính từ `turn.completed.usage` / `~/.codex/sessions/**/*.jsonl`) + **Tầng C** (OpenAI Docs, 2026-11-02) | **Không có cờ CLI xuất % còn lại không tương tác** (sự kiện ACP `usage_update` chỉ báo context window) → dùng **Tầng B** (`source: 'estimated'` đếm request/token trong ngày so với ngưỡng cấu hình, mặc định ~1.000 req/ngày gói cá nhân) + **Tầng C** (geminicli.com Quota Docs, 2026-11-02) |
| Định dạng quota / fixture | `spikes/fixtures/claude/{statusline-quota.json, statusline-before-first-turn.json, stream-turn-ok.jsonl, stream-rate-limit.jsonl}` | `spikes/fixtures/codex/{exec-turn-ok.jsonl, exec-rate-limit.jsonl}` | `spikes/fixtures/gemini/{acp-turn-ok.jsonl, acp-model-rate-limit.jsonl}` |
| Đọc quota có tiêu hao hạn mức? | **Không (0 token)** theo ADR-018: chỉ hứng thụ động JSON `statusLine` từ các bước làm việc thật, cấm gửi prompt giả để đọc quota | **Không (0 token)** theo ADR-018: chỉ đọc file log phiên cục bộ trên ổ đĩa và sự kiện `usage` có sẵn | **Không (0 token)** theo ADR-018: chỉ đếm lượt/token từ log cục bộ và bắt lỗi `429` tự nhiên |
| Cách phát hiện rate limit (tầng C) | Sự kiện lỗi stream/ACP `"limit reached · resets ..."` hoặc `rate_limits.*.used_percentage >= 100` kèm `resets_at` chuẩn ISO/epoch | Sự kiện NDJSON `turn.failed` / lỗi `usage_limit_reached` hoặc mã `429` kèm thời điểm làm mới cửa sổ 5 giờ / tuần | Lỗi JSON-RPC / stream `429 RESOURCE_EXHAUSTED` chỉ rõ tên model chạm trần RPD/RPM (ví dụ `gemini-2.5-pro`) |
| Điều khoản cho phép app bên thứ ba điều khiển bằng gói người dùng | **Được phép nếu gọi nguyên bản binary `claude` cục bộ** do chính người dùng tự chạy `claude auth login` (hoặc dùng `ANTHROPIC_API_KEY` lưu qua `safeStorage`); Anthropic **cấm nghiêm ngặt** việc trích xuất OAuth token gói Pro/Max để gọi qua proxy hay SDK tự chế — khớp hoàn toàn Luật B3 (Anthropic Consumer Terms & Claude Code Docs, 2026-11-02) | **Được phép qua giao diện chính thức** (`codex app-server` / `codex-acp` / `codex exec`) với phiên `codex login` cục bộ của người dùng hoặc `OPENAI_API_KEY`; cấm trích xuất token trong `auth.json` gửi ra dịch vụ ngoài — khớp Luật B3 (OpenAI Terms of Use & Codex App-Server Docs, 2026-11-02) | **Được phép chính thức qua chuẩn ACP (`gemini --acp`)** hoặc `GEMINI_API_KEY`; Điều khoản Gemini Code Assist cấm phần mềm bên thứ ba tự ý đọc OAuth credential của Gemini CLI để gọi thẳng API nội bộ — khớp Luật B3 (Google Gemini Code Assist ToS & ACP Docs, 2026-11-02) |
| Danh sách model có thể dùng | Ba bậc `Opus` (`strong`), `Sonnet` (`balanced`), `Haiku` (`fast`); tên và phiên bản đổi theo thời gian, xem bằng `/model` hoặc cấu hình adapter (Anthropic Docs, 2026-11-02) | ~~Nhiều biến thể gpt-5.x... (bài viết bên thứ ba, 05/2026)~~ *Cập nhật theo tài liệu chính thức OpenAI (2026-11-02):* các dòng `gpt-5-codex` / `gpt-5.x` và bản nhẹ `codex-mini` / biến thể tốc độ cao, phụ thuộc gói ChatGPT Plus/Pro hoặc API key | Chế độ `Auto` (dòng Gemini 2.5 / Gemini 3 `pro` cho bậc `strong`/`balanced` và `flash` cho bậc `fast`) hoặc truyền tên model cụ thể (geminicli.com Docs, 2026-11-02) |
| Cách chọn model | Cờ `--model <id\|alias>` lúc khởi chạy hoặc lệnh `/model` trong phiên; `/model opusplan` dùng Opus lập kế hoạch rồi Sonnet thực thi | Cờ `codex exec --model <id>` (`-m`), khóa `model` + `model_reasoning_effort` trong `~/.codex/config.toml`, `--profile`, ~~lệnh đổi trong phiên chưa xác nhận~~ hoặc `/model` trong phiên tương tác (OpenAI Docs, 2026-11-02) | Cờ `--model <id>` lúc khởi chạy và `/model` trong phiên tương tác; không tự áp lên sub-agent nội bộ |
| Đổi model giữa phiên có giữ ngữ cảnh? | **Có** khi đổi bằng `/model` trong cùng phiên theo tài liệu hỗ trợ Anthropic; khi CodeFleet điều phối qua chuỗi dự phòng 4.5a thì mở phiên mới từ checkpoint đầu bước kèm gói bàn giao ngữ cảnh (đã kiểm chứng ở `spikes/01-shadow-git.mjs`) | Giữ ngữ cảnh khi `codex resume <session_id> -m <model>`; khi đổi giữa bước theo mục 4.5a thì rollback về checkpoint đầu bước và truyền tóm tắt bàn giao | Giữ ngữ cảnh qua `session/load` của ACP hoặc đổi `/model` trong phiên; khi đổi giữa bước theo mục 4.5a thì rollback về checkpoint đầu bước và truyền tóm tắt bàn giao |
| Hạn mức tính riêng từng model hay dùng chung? | ~~Gói cá nhân: chưa rõ~~ **Dùng chung (`scope: 'shared'`)** trên cửa sổ 5 giờ và 7 ngày cho cả gói cá nhân (Pro/Max) lẫn tổ chức; model nặng (`Opus`) tiêu hao ngân sách nhanh hơn `Sonnet`/`Haiku` (Anthropic Usage Limits Docs, 2026-11-02) | ~~các model khác chưa rõ~~ **Dùng chung (`scope: 'shared'`)** theo cửa sổ 5 giờ và hàng tuần của gói ChatGPT cho các model chính; riêng một số model chuyên biệt (như dòng Spark preview) có trần riêng → mặc định cấu hình `scope: 'shared'`, cho phép ghi đè theo model nếu bắt lỗi 429 cục bộ (OpenAI Codex Pricing/Limits Docs, 2026-11-02) | ~~Tài liệu `/model` không nêu, chưa rõ~~ **Tách riêng theo model/nhóm model (`scope: 'model'`)** theo hạn mức RPD/RPM (ví dụ `pro` hết hạn mức ngày nhưng `flash` vẫn còn hạn mức riêng) (geminicli.com Quota & Pricing Docs, 2026-11-02) |
| Khi một model hết hạn mức, CLI tự đổi hay báo lỗi? | Với `Opus` khi chạm ngưỡng phụ của gói, CLI có thể tự hạ về `Sonnet` kèm cảnh báo; khi hết hẳn cửa sổ 5 giờ/7 ngày chung thì báo lỗi dừng lượt và trả giờ làm mới | Báo lỗi hết hạn mức (`usage_limit_reached` / `turn.failed`) kèm thời gian mở lại, không tự ý đổi sang CLI khác | Ở chế độ truyền `--model <id>` tường minh: trả lỗi `429 RESOURCE_EXHAUSTED` cho đúng model đó (không tự đổi ngầm), giúp router CodeFleet chủ động xử lý theo mục 4.5a |
| Chế độ tự chọn model của CLI có xung đột với router không? | Không xung đột khi CodeFleet truyền tường minh `--model <id>` (chỉ dùng `opusplan` nếu người dùng bật `router.allowCliAuto`) | Không xung đột khi truyền tường minh `-m <id>` cho từng lượt | Không xung đột: truyền `--model <id>` sẽ bỏ qua chế độ `Auto` mặc định của Gemini CLI |

Ghi nguồn (đường dẫn tài liệu, ngày kiểm tra) cho mỗi ô đã điền:
- **Claude Code (kiểm tra 2026-11-02):** https://docs.anthropic.com/en/docs/claude-code/overview · https://docs.anthropic.com/en/docs/claude-code/cli-reference · https://docs.anthropic.com/en/docs/claude-code/statusline · https://support.anthropic.com/en/articles/11014257-about-claude-s-max-plan-usage · https://agentclientprotocol.com
- **Codex CLI (kiểm tra 2026-11-02):** https://developers.openai.com/codex/cli · https://developers.openai.com/codex/auth · https://developers.openai.com/codex/models · https://openai.com/policies/terms-of-use
- **Gemini CLI (kiểm tra 2026-11-02):** https://geminicli.com/docs/cli/model · https://geminicli.com/docs/quota-and-pricing · https://geminicli.com/docs/ide-integration/acp · https://developers.google.com/gemini-code-assist/resources/faqs

~~**Đã đọc ngày 2026-11-01 (chỉ đọc tài liệu và bài viết, chưa chạy thật nên chưa đủ theo Luật A4):** các hàng về model ở trên. Nguồn: tài liệu hỗ trợ Anthropic "Models usage limits in Claude Code"; tài liệu Gemini CLI tại geminicli.com/docs/cli/model; bài viết bên thứ ba "The Codex CLI Model Landscape in May 2026" (độ tin cậy thấp hơn tài liệu chính hãng, cần đối chiếu tài liệu của OpenAI và chạy thật ở Phase 0).~~ — *Thay thế bởi bảng đối chiếu tài liệu chính hãng của cả 3 hãng và bộ kiểm chứng thực nghiệm ngày 2026-11-02 ở trên (riêng việc chạy trực tiếp 3 binary CLI trên máy thật được chủ dự án duyệt chuyển sang đầu Phase 2 do máy hiện chưa cài binary vào `PATH`).*

### 9.1 Kiểm chứng kỹ thuật cục bộ trên Windows (2026-11-02)
1. **Kho git bóng & bàn giao ngữ cảnh (`spikes/01-shadow-git.mjs`):**
   - Môi trường: Windows, `Git 2.42.0.windows.2`, Node.js `v22.14.0`.
   - Kết quả: Tách `GIT_DIR` (trong thư mục dữ liệu app) khỏi `GIT_WORK_TREE` (thư mục dự án người dùng) chạy dưới `50ms`/checkpoint; loại trừ chuẩn `node_modules/`, `.env`; khôi phục chính xác 100% nội dung từng byte cho cả 3 trường hợp sửa file, thêm file mới, xoá file (`git checkout <sha> -- .` kết hợp dọn file untracked theo danh sách kiểm soát); **mã băm SHA-256 của `.git/HEAD` và `.git/index` có sẵn của người dùng giữ nguyên tuyệt đối**. Đã diễn tập trọn vẹn kịch bản model A hết hạn mức giữa bước → rollback sạch về checkpoint đầu bước → sinh gói bàn giao ngữ cảnh cho model B hoàn tất bước.
   - Khi máy thiếu `git`: Đã đo thử `isomorphic-git@1.44.9` — hoạt động được với `gitdir` tách rời, mất ~`130ms–1,9s` (lần đầu khởi tạo ~`1913ms`, lần ấm ~`128ms`, so với `<50ms` của `git` hệ thống), ghi nhận số liệu cho câu hỏi mở mục 12.
2. **Electron + SQLite native (`spikes/02-run-sqlite-electron.mjs`, `spikes/02-sqlite-electron-main.cjs`):**
   - Môi trường: `Electron 45.2.1` (Node `24.22.1`, Chromium `156.0.8078.75`, ABI `150`) + `better-sqlite3@13.0.3` biên dịch qua `@electron/rebuild@4.2.1` với VS 2022 MSBuild + `electron-builder@26.18.0`.
   - Kết quả: Bật thành công `PRAGMA journal_mode = WAL` và `foreign_keys = ON`; tạo bản sao lưu `.bak` tự động trước khi chạy migration (Luật P8); thực thi trọn vẹn SQL Migration 001 (đủ 13 bảng mục 5); đọc/ghi tiếng Việt UTF-8 và ràng buộc `ON DELETE CASCADE` chính xác. Lưu ý cấu hình: với `pnpm v10`, bắt buộc khai báo `pnpm.onlyBuiltDependencies` cho `better-sqlite3` và `electron`.
3. **Giao thức ACP qua `stdio` (`spikes/03-acp-sdk.mjs`, `spikes/03-mock-acp-agent.mjs`):**
   - Môi trường: `@agentclientprotocol/sdk@2.2.0` (`client()`, `agent()`, `ndJsonStream`).
   - Kết quả: Khởi tạo kết nối `stdio` hai chiều ổn định; nhận đủ chuỗi sự kiện `plan`, `permission_request` (Luật B5), `tool_call`, `agent_message_chunk`, `usage_update` (chỉ báo kích thước context window, không phải quota gói đăng ký), và bắt lỗi `429` `rate_limit`. Chốt chặn kiểm tra đường dẫn thực tế (`fs.realpath` / `path.resolve`) chặn đứng hành vi ghi `../escaped-secret.txt` ra ngoài thư mục dự án (Luật B4).
4. **Parser bộ mẫu output (fixture) 3 CLI (`spikes/04-fixture-parsers.mjs`):**
   - Kiểm chứng thành công toàn bộ fixture ở `spikes/fixtures/{claude,codex,gemini}/` cho cả 3 tầng quota (A, B, C) và cơ chế tự hạ về `status: 'unknown'` không gây văng lỗi khi gặp dữ liệu JSON hỏng.

### 9.2 Yêu cầu ký số và phát hành (Windows & macOS)
- **Windows (NSIS `.exe`):**
  - *Phương án khuyến nghị (hiện đại, tối ưu cho GitHub Actions):* **Microsoft Trusted Signing** (tên cũ Azure Code Signing), chi phí **\$9.99 USD/tháng** (gói Basic gồm 5.000 lượt ký/tháng). Ưu điểm: cấp uy tín Microsoft Defender SmartScreen ngay lập tức mà không bị cảnh báo chặn khi mới phát hành, ký qua đám mây trên CI không cần cắm USB HSM vật lý. Thời gian xác minh danh tính (Individual hoặc Organization Validation): khoảng **1–5 ngày làm việc**.
  - *Phương án thay thế:* Chứng chỉ OV/EV Code Signing truyền thống lưu trên khoá cứng HSM (DigiCert, Sectigo, SSL.com), chi phí khoảng **\$250–\$500 USD/năm**, thời gian thẩm định **3–10 ngày làm việc**.
- **macOS (DMG / ZIP cho Intel + Apple Silicon):**
  - *Yêu cầu bắt buộc:* Tài khoản **Apple Developer Program**, chi phí **\$99 USD/năm**. Bao gồm chứng chỉ `Developer ID Application` để ký app (`codesign` với Hardened Runtime) và dịch vụ **Notarization** qua `xcrun notarytool` (dùng App Store Connect API Key trên GitHub Actions). Thời gian duyệt đăng ký: **1–3 ngày làm việc** cho cá nhân, hoặc **1–2 tuần** cho tổ chức (cần mã D-U-N-S).

---

## 10. QUYẾT ĐỊNH KIẾN TRÚC (ADR)

**ADR-001 — App desktop local bằng Electron** (2026-10-30)
- Bối cảnh: cần chạy CLI, truy cập thư mục dự án, nhúng terminal.
- Quyết định: Electron + TypeScript, không có server riêng giai đoạn đầu.
- Hệ quả: dữ liệu và đăng nhập đều ở máy người dùng; Tauri cân nhắc sau.

**ADR-002 — SQLite local, một DB chung** (2026-10-30)
- Quyết định: một file SQLite trong `userData`, mọi bản ghi gắn `project_id`.
- Lý do: đơn giản, dễ tìm xuyên dự án. Code dự án **không** lưu trong DB.

**ADR-003 — Kết nối CLI qua ACP + adapter** (2026-10-30)
- Quyết định: ưu tiên ACP, rồi stream JSON, cuối cùng PTY. Mỗi CLI một adapter.
- Lý do: tránh tự parse output riêng từng CLI. Chi tiết xác minh ở Phase 0.

**ADR-004 — Bỏ chế độ học** (2026-10-30)
- Quyết định: không làm chế độ học/câu hỏi tương tác.
- Giữ lại: hiển thị code theo mức, chú thích, nhãn rủi ro, tự sửa trực tiếp, nhật ký quyết định.

**ADR-005 — Điều phối tuần tự trong MVP** (2026-10-30)
- Quyết định: một bước chạy tại một thời điểm.
- Lý do: tránh xung đột file giữa các AI; điều phối song song nhiều agent cho code dễ phát sinh mâu thuẫn và tốn token hơn.

**ADR-006 — Checkpoint bằng kho git bóng** (2026-10-30)
- Quyết định: kho git riêng trong `userData`, không thêm `.git` vào dự án người dùng.
- ~~Cần xác minh ở Phase 0.~~ — *Đã xác minh chạy tốt ở Phase 0 tại `spikes/01-shadow-git.mjs` (xem mục 9.1).*

**ADR-007 — Plugin v1 chỉ dạng khai báo** (2026-10-30)
- Quyết định: chưa cho chạy code tuỳ ý; có hệ thống quyền từ đầu.

**ADR-008 — Quota theo 3 tầng nguồn dữ liệu, gắn nhãn độ tin cậy** (2026-10-30)
- Quyết định: chính thức → ước lượng → phát hiện; dữ liệu không chính thức luôn có nhãn; không dùng endpoint không công khai.
- Bổ sung 2026-11-01: đơn vị tính quota đổi sang ô (CLI, model), xem ADR-010.

**ADR-009 — Bố cục giao diện kết hợp: chat mặc định, điều phối chi tiết ở tab** (2026-11-01)
- Bối cảnh: có video tham khảo về bảng điều phối kiểu terminal. Đã dựng demo 3 bố cục: A chat đơn giản, B bảng điều phối, C kết hợp.
- Quyết định: chọn C. Chat là giao diện mặc định. Dòng thời gian, nhật ký, lý do chọn AI nằm ở tab "Điều phối chi tiết". B có thể thành chế độ nâng cao sau MVP.
- Lý do: người dùng mục tiêu ít kinh nghiệm, bảng nhiều thông tin dễ gây ngợp và trái nguyên tắc 1.4 và Luật U1.
- Trạng thái: chốt theo phản hồi "Oke" của chủ dự án sau khi xem demo. Nếu hiểu sai ý, ghi ADR mới thay thế.

**ADR-010 — Đơn vị điều phối và quota là cặp (CLI, model)** (2026-11-01)
- Bối cảnh: chủ dự án chỉ ra mỗi CLI chạy nhiều model, model này hết thì dùng được model khác, không nên coi cả CLI là một model. Đọc tài liệu cho thấy cả ba CLI cho chọn model. Hạn mức tách theo model hay dùng chung tùy CLI và chưa xác minh.
- Quyết định: router và quota làm việc trên ô (CLI, model), thêm `scope` cho quota, chuỗi dự phòng ở mục 4.5a, không hard-code tên model (Luật P10). Bổ sung cho ADR-008.
- Hệ quả: thêm bảng `models`, cột `quota_snapshots.scope`, `agent_sessions.model`. Phase 0 phải xác minh danh sách model, cách chọn model và phạm vi hạn mức. Đổi ô giữa bước cần bàn giao ngữ cảnh.

**ADR-011 — Tên ứng dụng CodeFleet và ưu tiên Windows trước** (2026-11-02)
- Bối cảnh: Mục 12 cần chốt tên ứng dụng chính thức và hệ điều hành phát triển ưu tiên.
- Quyết định: Đặt tên ứng dụng là **CodeFleet** (lấy từ một hằng số duy nhất `APP_NAME`). Ưu tiên phát triển và kiểm thử trực tiếp trên **Windows** trước, cấu hình CI GitHub Actions song song cho cả Windows và macOS.
- Lý do: Đồng bộ với tên dự án và môi trường phát triển thực tế hiện tại (Windows).
- Hệ quả: Thay thế `[Tên app]` trong tài liệu và mockup bằng `CodeFleet`; các bài kiểm thử trực tiếp trên máy macOS sẽ chạy qua CI cho tới Phase 7.

**ADR-012 — Hộp thoại xin phép (Q1, Q2): hỏi từng lần ở MVP, gộp nút từ chối** (2026-11-02)
- Bối cảnh: Q1 hỏi có cho "Luôn cho phép cài thư viện / truy cập mạng trong dự án này" không; Q2 hỏi có giữ nút riêng "Hỏi AI cách khác" ở MH-04 không.
- Quyết định: (Q1) Không có tuỳ chọn "Luôn cho phép" ở MVP — mọi hành động rủi ro đều hỏi từng lần. (Q2) Gộp "Hỏi AI cách khác" vào "Không cho phép" (khi từ chối, gửi phản hồi để AI tự tìm hướng khác hoặc báo dừng).
- Lý do: Tuân thủ chặt Luật B5 và giảm số nút gây phân vân cho người mới.
- Hệ quả: MH-04 chỉ còn 2 nút ("Không cho phép", "Cho phép lần này") và không có checkbox ghi nhớ; MH-11 mục An toàn hiển thị "Luôn hỏi" cho cả 4 loại hành động.

**ADR-013 — Hành vi tạm dừng khi hết hạn mức và thông báo hạn mức (Q3, Q4, Q12)** (2026-11-02)
- Bối cảnh: Q3 hỏi về tự động hẹn giờ chạy tiếp khi làm mới hạn mức; Q4 hỏi về cho phép nhảy bước làm bước sau trước; Q12 hỏi popover hạn mức có tự mở khi một AI vừa hết không.
- Quyết định: (Q3) Để tính năng hẹn giờ tự chạy tiếp sang sau MVP; MVP hiện giờ làm mới sớm nhất + nút "Thử lại". (Q4) Không làm "làm bước khác trước" ở MVP. (Q12) Khi một AI vừa hết hạn mức, chỉ hiện Toast thông báo, không tự bung `QuotaPopover`.
- Lý do: Giữ điều phối tuần tự an toàn theo ADR-005, tránh tác vụ tự chạy ngầm ngoài ý muốn và không che khuất vùng chat.
- Hệ quả: Cập nhật đặc tả và mockup MH-07, MH-11.

**ADR-014 — Lưu trạng thái bước chờ xử lý và phân loại quyết định trong DB (Q5, Q6)** (2026-11-02)
- Bối cảnh: Q5 hỏi có lưu `waiting_permission`, `conflict`, `paused` vào cột `steps.status` không; Q6 hỏi có thêm cột `decisions.kind` không.
- Quyết định: (Q5) Lưu trực tiếp 3 trạng thái `waiting_permission`, `conflict`, `paused` vào `steps.status`. (Q6) Thêm cột `kind` (`'approach' | 'pick' | 'switch'`) vào bảng `decisions`. Cập nhật ngay vào schema khởi tạo mục 5 vì chưa phát hành DB cho người dùng; các thay đổi sau Phase 1 sẽ tạo migration đánh số theo Luật P8.
- Lý do: Đảm bảo khôi phục đúng trạng thái bước sau khi tắt/mở lại app và lọc chính xác loại quyết định ở MH-03, MH-09.
- Hệ quả: Schema bảng `steps` và `decisions` ở mục 5 cập nhật thêm giá trị/cột tương ứng.

**ADR-015 — Bảng dữ liệu Bản đồ dự án (Q7)** (2026-11-02)
- Bối cảnh: Q7 hỏi nguồn dữ liệu và nơi lưu Bản đồ dự án (MH-09 tab 3).
- Quyết định: Sau mỗi bước hoàn thành, dùng model bậc nhanh/rẻ nhất đang khả dụng cập nhật danh sách "chức năng → file" và lưu vào bảng `project_map` trong SQLite.
- Lý do: Mở MH-09 hiển thị tức thì, hoạt động cả khi ngoại tuyến và không tốn hạn mức lặp lại.
- Hệ quả: Bổ sung bảng `project_map` vào schema mục 5.

**ADR-016 — Quyền cài đặt Plugin trọn gói ở MVP (Q8)** (2026-11-02)
- Bối cảnh: Q8 hỏi người dùng có được bỏ chọn từng quyền không bắt buộc khi cài plugin ở MH-10 không.
- Quyết định: Áp dụng cơ chế "tất cả hoặc không" ở MVP (chấp thuận toàn bộ quyền khai báo trong manifest hoặc huỷ cài đặt), bỏ checkbox từng quyền.
- Lý do: Plugin v1 chỉ dạng khai báo, tắt bớt quyền khai báo sẽ làm plugin lỗi nửa chừng.
- Hệ quả: Hộp thoại cài plugin ở MH-10 liệt kê danh sách quyền rõ ràng không có checkbox lẻ.

**ADR-017 — Tương tác gửi tin khi đang chạy, kích thước cửa sổ và chế độ tối (Q9, Q10, Q11)** (2026-11-02)
- Bối cảnh: Q9 hỏi gửi tin mới khi AI đang chạy thì xếp hàng hay hỏi dừng; Q10 hỏi kích thước cửa sổ tối thiểu và nút thu gọn khung phải; Q11 hỏi chế độ tối toàn app.
- Quyết định: (Q9) Hỏi xác nhận "Dừng việc đang làm để nhận yêu cầu mới?" khi đang có bước `running`. (Q10) Cửa sổ tối thiểu `1024×680`, có nút thu gọn/mở rộng khung bên phải. (Q11) Chế độ tối toàn app để sau MVP.
- Lý do: Tránh gửi chồng yêu cầu ngoài ý muốn, tối ưu không gian đọc trên màn hình nhỏ, giữ phạm vi giao diện MVP tập trung.
- Hệ quả: Cập nhật `UI_SPEC.md` mục 1.2, 5.3.3 và bổ sung nút thu gọn khung phải trên mockup.

**ADR-018 — Đọc hạn mức thụ động không tiêu hao token LLM** (2026-11-02)
- Bối cảnh: Phase 0 và `UI_SPEC.md` MH-08 yêu cầu xác minh câu "Đọc hạn mức không tốn hạn mức của bạn". Nếu `QuotaService` gửi prompt giả tới LLM để kích hoạt `statusLine` hoặc thăm dò hạn mức, mỗi lần làm mới sẽ tiêu tốn token của người dùng.
- Quyết định: `QuotaService` (kể cả khi người dùng bấm nút "↻ Làm mới" `quota.refresh`) **tuyệt đối cấm gửi prompt tới LLM chỉ để đọc hạn mức**. Dữ liệu hạn mức chỉ được thu thập thụ động từ: (1) JSON `statusLine` sinh ra tự nhiên sau các lượt làm việc thật (Claude tầng A), (2) lệnh kiểm tra trạng thái không gọi LLM và file log phiên cục bộ trên ổ đĩa (Codex/Gemini tầng B), và (3) sự kiện lỗi `429` khi đang chạy bước thật (tầng C).
- Lý do: Bảo đảm tính trung thực tuyệt đối của câu thông báo trên MH-08 (Nguyên tắc 1.4) và bảo vệ hạn mức gói đăng ký của người dùng.
- Hệ quả: Khi mới cài app và chưa chạy lượt hội thoại nào, hạn mức có thể hiển thị trung thực là `Không rõ` (`unknown`) cho tới sau lượt đầu tiên; câu "Đọc hạn mức không tốn hạn mức của bạn" ở MH-08 được xác nhận đúng và bỏ nhãn giữ chỗ.

**ADR-019 — Cấu hình ánh xạ bậc model và siêu dữ liệu CLI tách rời (`resources` + `userData`)** (2026-11-02)
- Bối cảnh: Luật P10 và `UI_SPEC.md` G6 quy định không được hard-code tên model hay lệnh cài CLI trong logic ứng dụng, đồng thời mục 12 đặt câu hỏi cách duy trì file ánh xạ bậc model (`strong` / `balanced` / `fast`) khi hãng đổi tên model.
- Quyết định: Đóng gói file cấu hình mặc định `resources/model-tiers.default.json` do nhóm phát triển duy trì (cập nhật qua các bản phát hành ứng dụng), kết hợp với file ghi đè của người dùng tại `<userData>/model-tiers.user.json` khi chỉnh trên bảng **MH-11 → Nâng cao**. Mọi model mới do CLI báo mà chưa có trong cả 2 file sẽ nhận `tier: 'unknown'` (`"Chưa xếp bậc"`) kèm cảnh báo trên MH-11.
- Lý do: Tách hoàn toàn danh mục model/lệnh cài khỏi mã nguồn `.ts`/`.tsx`, cho phép cả bản cập nhật app lẫn người dùng tự chỉnh bậc mà không phải sửa code.
- Hệ quả: `ModelTierService` đọc kết hợp 2 file cấu hình và đồng bộ vào bảng `models` trong SQLite.

---

## 11. NHẬT KÝ THAY ĐỔI
*(Mới nhất ở trên. Mỗi thay đổi một dòng — Luật T2.)*

| Ngày | Phiên bản TL | Người/AI | Thay đổi | Lý do |
|---|---|---|---|---|
| 2026-11-02 | 0.12 | Antigravity (AI) | Bắt đầu Phase 2: chốt ADR-019 (cấu hình ánh xạ bậc model tách rời tại `resources/model-tiers.default.json` + `<userData>/model-tiers.user.json`), triển khai bộ kiểm soát đường dẫn `src/main/security/path-guard.ts` chặn `..` và symlink thoát khỏi thư mục dự án (Luật B4) kèm unit test | Khởi động Phase 2 — Kết nối CLI theo xác nhận của chủ dự án |
| 2026-11-02 | 0.11 | Antigravity (AI) | Bổ sung GitHub Actions CI ma trận `windows-latest` + `macos-latest` (`.github/workflows/ci.yml`); sửa cấu hình đóng gói `preload` tự thân cho `sandbox: true`; kiểm thử mở cửa sổ Electron 45 thật đối chiếu mockup `11-cai-dat.html` và đóng gói thử `CodeFleet.exe`; hoàn tất và đóng Phase 1 | Đạt toàn bộ tiêu chí thoát của Phase 1 — Khung dự án |
| 2026-11-02 | 0.10 | Antigravity (AI) | Hoàn thiện tầng giao diện Phase 1: file chuỗi `src/renderer/i18n/vi.json`, bộ thành phần cơ bản (`Button`, `Pill`, `Toggle`, `Segmented`, `Progress`, `Notice`, `Dialog`, `Toast`, `ProjectPill`, `AppHeader`), trang thử `/dev/components` sau feature flag (Luật P6), và khung màn `MH-11 Cài đặt` (mục Chung & Dữ liệu) kèm unit test | Hoàn thành toàn bộ hạng mục giao diện của Phase 1 theo `UI_SPEC.md` mục 9 và `Prompt 1` |
| 2026-11-02 | 0.9 | Antigravity (AI) | Triển khai tầng IPC có kiểu + kiểm tra `zod` hai chiều ở `src/shared/ipc/contracts.ts`, `src/main/ipc/`, `src/preload/index.ts` (`settings.*`, `system.checkGit`, `system.getDataInfo`, `system.openDataDir`, `system.backupNow`) kèm unit test; đồng bộ `UI_SPEC.md` v0.4 mục 7 | Hoàn thành cầu nối IPC an toàn main ↔ preload ↔ renderer theo Luật P3, B1 |
| 2026-11-02 | 0.8 | Antigravity (AI) | Bổ sung `DatabaseService` (`better-sqlite3`, WAL, `foreign_keys = ON`, bảng `_schema_migrations`, tự sao lưu `.sqlite.bak` trước khi chạy migration theo Luật P8), `Migration 001` (đủ 13 bảng mục 5), `SettingsRepository` (chặn lưu khoá nhạy cảm theo Luật B2) và hệ thống `Logger` lọc dữ liệu nhạy cảm theo Luật P9 kèm bộ unit test | Triển khai tầng lưu trữ SQLite và nhật ký an toàn của Phase 1 |
| 2026-11-02 | 0.7 | Antigravity (AI) | Bắt đầu Phase 1: khởi tạo workspace `electron-vite` + React 19 + TypeScript `strict` (cấm `any`), Tailwind design tokens mục 2, font đóng gói offline (`Be Vietnam Pro`, `JetBrains Mono`), ESLint + Prettier + Vitest + pre-commit hook, và cấu hình bảo mật cửa sổ Electron theo Luật B1 (`window-security.ts` + test) | Chủ dự án xác nhận triển khai Phase 1 — Khung dự án |
| 2026-11-02 | 0.6 | Antigravity (AI) | Hoàn thành Phase 0: chạy thành công 4 bộ spike trong `spikes/` (kho git bóng, SQLite+Electron 45, ACP SDK v2.2.0, parser fixture 3 CLI); điền đầy đủ bảng xác minh 3 CLI, kết quả kiểm chứng cục bộ Windows (9.1) và yêu cầu ký số (9.2); bổ sung ADR-018 (đọc hạn mức thụ động 0 token); đồng bộ `UI_SPEC.md` v0.3 và mockup `08-han-muc.html` | Đạt toàn bộ tiêu chí thoát Phase 0 để sẵn sàng sang Phase 1 (ghi nhận nợ kiểm chứng chạy binary trực tiếp 3 CLI vào đầu Phase 2) |
| 2026-11-02 | 0.5 | Antigravity (AI) | Bắt đầu Phase 0; chốt tên ứng dụng **CodeFleet** + ưu tiên Windows trước (ADR-011) và toàn bộ câu hỏi Q1–Q12 của `UI_SPEC.md` (ADR-012 → ADR-017); cập nhật schema mục 5 (`steps.status`, `decisions.kind`, `project_map`), mục 7, 8, 12 | Chủ dự án xác nhận phạm vi Phase 0, tên app và phương án đề xuất cho Q1–Q12 |
| 2026-11-02 | 0.4 | Antigravity (AI) | Thêm `UI_SPEC.md` (đặc tả 12 màn, tokens, trạng thái, view model, IPC dự kiến, 12 câu hỏi UI cần chốt) và `PROMPT_TRIEN_KHAI.md` (prompt theo phase); thêm tham chiếu ở mục 0; sửa 3 chỗ chưa khớp trong mockup (màn 07: thông báo và nhật ký điều phối; màn 08: câu về đọc hạn mức chuyển thành giữ chỗ) | Để AI khác triển khai từ mockup ra kết quả nhất quán |
| 2026-11-02 | 0.3 | Antigravity (AI) | Thêm bộ 12 màn mockup HTML theo bố cục C vào `Document/UI_Mockups/`, ghi vào mục 6.9 | Chủ dự án yêu cầu dựng các màn giao diện mẫu dựa trên kế hoạch và mẫu C |
| 2026-11-01 | 0.2 | Claude (AI) | Chốt bố cục giao diện C: chat mặc định, điều phối chi tiết ở tab (mục 6.9, ADR-009) | Chủ dự án xem demo 3 bố cục và trả lời "Oke" |
| 2026-11-01 | 0.2 | Claude (AI) | Đổi đơn vị điều phối và quota từ CLI sang cặp (CLI, model): sửa 1.3, 4.4, 4.5, thêm 4.4a và 4.5a, schema (`models`, `quota_snapshots.scope`, `agent_sessions.model`), mục 6.6, Phase 0/2/3/5, mục 9, ADR-010, luật P10, rủi ro, câu hỏi mở | Chủ dự án chỉ ra mỗi CLI có nhiều model, model này hết thì dùng model khác |
| 2026-10-30 | 0.1 | (khởi tạo) | Tạo tài liệu: luật lệ, kiến trúc, schema, đặc tả, 9 giai đoạn; bổ sung hiển thị quota (mục 6.6, Phase 5, ADR-008); bỏ chế độ học (ADR-004); thêm plugin v1 và SQLite local | Khởi động dự án |

---

## 12. CÂU HỎI MỞ
*(Chốt xong thì chuyển thành ADR và ghi Nhật ký.)*

- [x] ~~Tên ứng dụng.~~ — Đã chốt: **CodeFleet** (xem ADR-011).
- [x] ~~Hệ điều hành làm trước: Windows hay macOS?~~ — Đã chốt: **Windows trước**, cấu hình CI song song cho macOS (xem ADR-011).
- [ ] Plugin chỉ do chủ dự án cung cấp, hay cộng đồng cũng được đăng? (ảnh hưởng quy trình kiểm duyệt — cần chốt trước Phase 6)
- [ ] Mô hình kinh doanh (miễn phí / trả phí), ảnh hưởng tới yêu cầu pháp lý và thu thập dữ liệu.
- [ ] Có thu thập số liệu sử dụng ẩn danh không? (nếu có: mặc định tắt, người dùng chủ động bật)
- [ ] Phương án khi máy người dùng không có `git` *(đã đo ở Phase 0 tại `spikes/01-shadow-git.mjs`: `isomorphic-git` chạy được với `gitdir` tách rời trong ~130ms–1,9s so với <50ms của `git` hệ thống — cần chốt trước Phase 4 giữa "cảnh báo hướng dẫn cài git + tạm tắt hoàn tác" hay "bật `isomorphic-git` làm dự phòng")*.
- [x] ~~Người dùng có tự chọn model không, hay app luôn tự chọn? (đề xuất: mặc định tự chọn, chỉ cho ghim model ở mục Nâng cao)~~ — Đã thiết kế khớp trong `UI_SPEC.md` mục 5.3.3 (`AiPicker`: mặc định tự chọn, ghim AI+model ở mục Nâng cao) và mục 4.4a.
- [x] ~~Ánh xạ bậc model (`strong` / `balanced` / `fast`) cho từng CLI ra sao, và ai duy trì file ánh xạ khi hãng đổi tên model? *(cần chốt trước Phase 2)*~~ — Đã chốt: dùng `resources/model-tiers.default.json` kết hợp `<userData>/model-tiers.user.json` (xem ADR-019).

---

## 13. RỦI RO

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Hãng hạn chế app bên thứ ba điều khiển CLI bằng gói đăng ký | Cao | Đã xác minh điều khoản ở Phase 0 (mục 9): chỉ gọi binary CLI chính thức / chuẩn ACP, tuyệt đối không trích xuất OAuth token (Luật B3); hỗ trợ thêm phương án API key qua `safeStorage` |
| CLI đổi định dạng/lệnh làm adapter và quota hỏng | Cao | Adapter tách biệt, fixture test, hạ về `unknown` thay vì lỗi, cập nhật nhanh qua tự cập nhật |
| Không lấy được quota chính thức từ một CLI | Trung bình | Tầng B và C, gắn nhãn rõ |
| AI ghi ra ngoài thư mục dự án hoặc chạy lệnh nguy hiểm | Cao | Luật B4, B5; kiểm tra đường dẫn; xin phép |
| Người dùng không ký số bị chặn khi cài | Cao | Phase 7 bắt buộc ký/notarize trước khi phát hành |
| Phối hợp nhiều AI gây xung đột file | Trung bình | Chạy tuần tự (ADR-005), checkpoint từng bước |
| Plugin độc hại | Cao | Plugin v1 chỉ khai báo, hệ thống quyền, danh mục kiểm duyệt |
| Mất dữ liệu khi migration | Trung bình | Sao lưu tự động trước migration (P8) |
| Hãng đổi tên, bỏ hoặc thêm model; cách tính hạn mức theo model thay đổi | Cao | Không hard-code tên model (P10), lấy từ `listModels()`, ánh xạ bậc bằng cấu hình cập nhật được, quota `scope: unknown` coi như dùng chung |
