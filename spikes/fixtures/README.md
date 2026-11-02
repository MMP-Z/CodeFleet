# Bộ Fixture CLI — Phase 0 (2026-11-02)

> **Trạng thái nguồn (Luật A4 & P5):**
> - Dựng từ **tài liệu chính thức hiện hành** của 3 hãng và schema chính thức của `@agentclientprotocol/sdk@2.2.0` vào ngày `2026-11-02` (đã ẩn mọi dữ liệu cá nhân/nhạy cảm).
> - Trên máy Windows phát triển hiện tại, 3 binary `claude`, `codex`, `gemini` chưa cài vào `PATH`; khi cài CLI thật ở Phase 2 sẽ chạy thu thập thêm mẫu thực tế để đối chiếu chéo.

## Cấu trúc
- `claude/`:
  - `auth-status.json`: định dạng JSON của `claude auth status`.
  - `stream-turn.ndjson`: luồng NDJSON của `claude -p "..." --output-format stream-json`.
  - `statusline-quota.json`: payload JSON `statusLine` có trường `rate_limits.five_hour` và `rate_limits.seven_day` (Quota tầng A).
  - `rate-limit-error.ndjson`: mẫu báo hết hạn mức cửa sổ 5 giờ (Quota tầng C).
- `codex/`:
  - `login-status.txt`: kết quả `codex login status`.
  - `exec-stream.ndjson`: luồng sự kiện JSONL của `codex exec --json`.
  - `session-log-usage.jsonl`: mẫu log token phục vụ ước lượng hạn mức cục bộ (Quota tầng B).
  - `rate-limit-error.ndjson`: mẫu lỗi chạm giới hạn dùng (Quota tầng C).
- `gemini/`:
  - `acp-session-updates.ndjson`: luồng thông báo `session/update` chuẩn ACP v1 từ `gemini --acp`.
  - `stream-turn.ndjson`: luồng sự kiện từ `gemini -p "..." --output-format stream-json`.
  - `rate-limit-429.json`: lỗi `429 RESOURCE_EXHAUSTED` theo model riêng lẻ (Quota tầng C).

