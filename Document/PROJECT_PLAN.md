# KẾ HOẠCH TRIỂN KHAI — Ứng dụng chat "vibe code có hiểu"

> **Phiên bản tài liệu:** 0.4
> **Cập nhật lần cuối:** 2026-11-02
> **Giai đoạn hiện tại:** Phase 0 — Chưa bắt đầu
> **Tên ứng dụng:** (chưa đặt)

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
  status           TEXT NOT NULL,          -- 'pending' | 'running' | 'done' | 'failed' | 'undone'
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
  text        TEXT NOT NULL,               -- "vì sao chọn cách này", lời thường
  created_at  TEXT NOT NULL
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
| 0 | Spike và xác minh | Chưa bắt đầu | — | — |
| 1 | Khung dự án | Chưa bắt đầu | — | — |
| 2 | Kết nối CLI | Chưa bắt đầu | — | — |
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

- [ ] Chạy thử ACP với từng CLI (Claude Code, Codex CLI, Gemini CLI): cách khởi chạy, bước đăng nhập, sự kiện nhận được. Ghi vào mục 9.
- [ ] Với từng CLI, tìm cách lấy thông tin quota: lệnh nào, status line, file log, hay ACP. Ghi định dạng và ví dụ output vào mục 9; lưu fixture.
- [ ] Kiểm tra việc đọc quota có tiêu hao hạn mức hay không.
- [ ] Với từng CLI: lấy danh sách model tài khoản dùng được (lệnh hoặc file cấu hình nào cho biết), cách chọn model (cờ khởi chạy, lệnh trong phiên, file cấu hình), đổi model giữa phiên có giữ ngữ cảnh không. Ghi vào mục 9.
- [ ] Với từng CLI: hạn mức tính **riêng từng model** hay dùng chung; khi một model hết thì CLI tự đổi model hay báo lỗi; chế độ tự chọn model của CLI (nếu có) có xung đột với router của app không.
- [ ] Thử thật việc đổi ô giữa chừng một bước: mở phiên bằng model khác từ checkpoint đầu bước, bàn giao ngữ cảnh bằng tóm tắt, xem kết quả có dùng được không.
- [ ] Đọc điều khoản của từng hãng về việc app bên thứ ba điều khiển CLI bằng gói đăng ký của người dùng. Ghi kết luận và nguồn vào mục 9.
- [ ] Thử `better-sqlite3` + Electron + electron-builder trên Windows và macOS.
- [ ] Thử kho git bóng (`GIT_DIR` tách khỏi `GIT_WORK_TREE`): tạo checkpoint, khôi phục, loại trừ `node_modules`. Kiểm tra phương án khi máy không có git.
- [ ] Xác định yêu cầu ký số: chứng chỉ Windows, tài khoản Apple Developer, chi phí, thời gian.
- [ ] Chốt tên ứng dụng (xem mục 12).

**Tiêu chí thoát:** có kết luận bằng văn bản cho từng mục trên; mỗi CLI có ít nhất một kênh giao tiếp chạy được và kênh lấy quota (hoặc kết luận "không lấy được chính thức"); không còn rào cản pháp lý chưa rõ; mỗi CLI có kết luận rõ về danh sách model, cách chọn model, và hạn mức tính riêng từng model hay dùng chung.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc (đã làm / chưa làm / nợ kỹ thuật / bài học / việc tiếp theo): —

---

### Phase 1 — Khung dự án
**Mục tiêu:** có app Electron chạy được với nền móng vững.

- [ ] Khởi tạo repo, pnpm, electron-vite, React, Tailwind, TypeScript strict.
- [ ] ESLint, Prettier, Vitest, hook kiểm tra trước commit.
- [ ] Cấu hình bảo mật Electron theo B1 (contextIsolation, sandbox, CSP).
- [ ] IPC có kiểu + zod, một ví dụ hoàn chỉnh từ renderer tới main.
- [ ] SQLite: `better-sqlite3`, WAL, migration 001 (mục 5), cơ chế sao lưu trước migration.
- [ ] Hệ thống log (có lọc dữ liệu nhạy cảm theo P9), màn hình cài đặt cơ bản.
- [ ] GitHub Actions: lint, test, build trên Windows và macOS.
- [ ] Tách chuỗi giao diện ra file riêng (tiếng Việt).

**Tiêu chí thoát:** `pnpm dev` và `pnpm build` chạy trên cả hai hệ điều hành; CI xanh; DB tạo và migrate đúng; test IPC qua.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
- Vấn đề gặp phải: —
- Việc bị hoãn / ý tưởng mới: —
- Ghi chú kết thúc: —

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
- [ ] Kiểm soát đường dẫn ghi (B4): thử AI cố ghi ra ngoài thư mục dự án.

**Tiêu chí thoát:** gửi một yêu cầu đơn giản và nhận phản hồi + thay đổi file đúng trong thư mục dự án với cả 3 CLI; phát hiện được trường hợp CLI chưa cài/chưa đăng nhập; test adapter qua.

**Ghi chú giai đoạn**
- Ngày bắt đầu: —
- Quyết định trong giai đoạn: —
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
| Cách khởi chạy qua ACP / stream | — | — | — |
| Phiên bản đã thử | — | — | — |
| Cách phát hiện đã đăng nhập | — | — | — |
| Nguồn quota (tầng A) | — | — | — |
| Định dạng quota / fixture | — | — | — |
| Đọc quota có tiêu hao hạn mức? | — | — | — |
| Cách phát hiện rate limit (tầng C) | — | — | — |
| Điều khoản cho phép app bên thứ ba điều khiển bằng gói người dùng | — | — | — |
| Danh sách model có thể dùng | Ba bậc Sonnet, Opus, Haiku; tên và phiên bản đổi theo thời gian, xem bằng `/model` (tài liệu hỗ trợ Anthropic) | Nhiều biến thể gpt-5.x; một số chỉ dùng được khi đăng nhập ChatGPT, một số chỉ có ở gói cao (bài viết bên thứ ba, 05/2026) | Chế độ Auto (Gemini 3: pro-preview và flash-preview; Gemini 2.5: pro và flash) hoặc chọn tay (tài liệu geminicli.com) |
| Cách chọn model | `/model`, đổi được giữa phiên; `/model opusplan` dùng Opus để lập kế hoạch rồi Sonnet để làm | `model` và `model_reasoning_effort` trong `~/.codex/config.toml`, `--profile`, `codex exec --model ...`; lệnh đổi trong phiên **chưa xác nhận** | `/model` trong phiên và cờ `--model` lúc khởi chạy; không áp lên sub-agent |
| Đổi model giữa phiên có giữ ngữ cảnh? | Có theo tài liệu hỗ trợ ("không mất hội thoại"), chưa thử | — | — |
| Hạn mức tính riêng từng model hay dùng chung? | Gói tổ chức: một hạn mức chung, model mạnh tốn nhanh hơn. Gói cá nhân: **chưa rõ** | Codex-Spark có giới hạn riêng (bài viết bên thứ ba); các model khác **chưa rõ** | Tài liệu `/model` không nêu, **chưa rõ** |
| Khi một model hết hạn mức, CLI tự đổi hay báo lỗi? | — | — | — (tài liệu `/model` không nêu) |

Ghi nguồn (đường dẫn tài liệu, ngày kiểm tra) cho mỗi ô đã điền.

**Đã đọc ngày 2026-11-01 (chỉ đọc tài liệu và bài viết, chưa chạy thật nên chưa đủ theo Luật A4):** các hàng về model ở trên. Nguồn: tài liệu hỗ trợ Anthropic "Models usage limits in Claude Code"; tài liệu Gemini CLI tại geminicli.com/docs/cli/model; bài viết bên thứ ba "The Codex CLI Model Landscape in May 2026" (độ tin cậy thấp hơn tài liệu chính hãng, cần đối chiếu tài liệu của OpenAI và chạy thật ở Phase 0).

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
- Cần xác minh ở Phase 0.

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

---

## 11. NHẬT KÝ THAY ĐỔI
*(Mới nhất ở trên. Mỗi thay đổi một dòng — Luật T2.)*

| Ngày | Phiên bản TL | Người/AI | Thay đổi | Lý do |
|---|---|---|---|---|
| 2026-11-02 | 0.4 | Antigravity (AI) | Thêm `UI_SPEC.md` (đặc tả 12 màn, tokens, trạng thái, view model, IPC dự kiến, 12 câu hỏi UI cần chốt) và `PROMPT_TRIEN_KHAI.md` (prompt theo phase); thêm tham chiếu ở mục 0; sửa 3 chỗ chưa khớp trong mockup (màn 07: thông báo và nhật ký điều phối; màn 08: câu về đọc hạn mức chuyển thành giữ chỗ) | Để AI khác triển khai từ mockup ra kết quả nhất quán |
| 2026-11-02 | 0.3 | Antigravity (AI) | Thêm bộ 12 màn mockup HTML theo bố cục C vào `Document/UI_Mockups/`, ghi vào mục 6.9 | Chủ dự án yêu cầu dựng các màn giao diện mẫu dựa trên kế hoạch và mẫu C |
| 2026-11-01 | 0.2 | Claude (AI) | Chốt bố cục giao diện C: chat mặc định, điều phối chi tiết ở tab (mục 6.9, ADR-009) | Chủ dự án xem demo 3 bố cục và trả lời "Oke" |
| 2026-11-01 | 0.2 | Claude (AI) | Đổi đơn vị điều phối và quota từ CLI sang cặp (CLI, model): sửa 1.3, 4.4, 4.5, thêm 4.4a và 4.5a, schema (`models`, `quota_snapshots.scope`, `agent_sessions.model`), mục 6.6, Phase 0/2/3/5, mục 9, ADR-010, luật P10, rủi ro, câu hỏi mở | Chủ dự án chỉ ra mỗi CLI có nhiều model, model này hết thì dùng model khác |
| 2026-10-30 | 0.1 | (khởi tạo) | Tạo tài liệu: luật lệ, kiến trúc, schema, đặc tả, 9 giai đoạn; bổ sung hiển thị quota (mục 6.6, Phase 5, ADR-008); bỏ chế độ học (ADR-004); thêm plugin v1 và SQLite local | Khởi động dự án |

---

## 12. CÂU HỎI MỞ
*(Chốt xong thì chuyển thành ADR và ghi Nhật ký.)*

- [ ] Tên ứng dụng.
- [ ] Hệ điều hành làm trước: Windows hay macOS?
- [ ] Plugin chỉ do chủ dự án cung cấp, hay cộng đồng cũng được đăng? (ảnh hưởng quy trình kiểm duyệt)
- [ ] Mô hình kinh doanh (miễn phí / trả phí), ảnh hưởng tới yêu cầu pháp lý và thu thập dữ liệu.
- [ ] Có thu thập số liệu sử dụng ẩn danh không? (nếu có: mặc định tắt, người dùng chủ động bật)
- [ ] Phương án khi máy người dùng không có `git`.
- [ ] Người dùng có tự chọn model không, hay app luôn tự chọn? (đề xuất: mặc định tự chọn, chỉ cho ghim model ở mục Nâng cao)
- [ ] Ánh xạ bậc model (`strong` / `balanced` / `fast`) cho từng CLI ra sao, và ai duy trì file ánh xạ khi hãng đổi tên model?

---

## 13. RỦI RO

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Hãng hạn chế app bên thứ ba điều khiển CLI bằng gói đăng ký | Cao | Xác minh điều khoản ở Phase 0; chuẩn bị phương án dùng API key |
| CLI đổi định dạng/lệnh làm adapter và quota hỏng | Cao | Adapter tách biệt, fixture test, hạ về `unknown` thay vì lỗi, cập nhật nhanh qua tự cập nhật |
| Không lấy được quota chính thức từ một CLI | Trung bình | Tầng B và C, gắn nhãn rõ |
| AI ghi ra ngoài thư mục dự án hoặc chạy lệnh nguy hiểm | Cao | Luật B4, B5; kiểm tra đường dẫn; xin phép |
| Người dùng không ký số bị chặn khi cài | Cao | Phase 7 bắt buộc ký/notarize trước khi phát hành |
| Phối hợp nhiều AI gây xung đột file | Trung bình | Chạy tuần tự (ADR-005), checkpoint từng bước |
| Plugin độc hại | Cao | Plugin v1 chỉ khai báo, hệ thống quyền, danh mục kiểm duyệt |
| Mất dữ liệu khi migration | Trung bình | Sao lưu tự động trước migration (P8) |
| Hãng đổi tên, bỏ hoặc thêm model; cách tính hạn mức theo model thay đổi | Cao | Không hard-code tên model (P10), lấy từ `listModels()`, ánh xạ bậc bằng cấu hình cập nhật được, quota `scope: unknown` coi như dùng chung |
