# CodeFleet CLI

## Cài trên Windows

Trong PowerShell, cài Git và Node.js 22 qua WinGet:

```powershell
winget install --id Git.Git --exact --source winget
winget install --id OpenJS.NodeJS.22 --exact --source winget
```

Mở cửa sổ PowerShell mới rồi cài pnpm 10, cùng phiên bản chính với cấu hình CI:

```powershell
npm.cmd install --global pnpm@10
git --version
node --version
pnpm.cmd --version
```

Tải CodeFleet, cài dependency và mở CLI. Đổi `D:\CongViec` thành thư mục có sẵn mà bạn muốn AI làm việc:

```powershell
git clone https://github.com/MMP-Z/CodeFleet.git
Set-Location CodeFleet
pnpm.cmd install --frozen-lockfile
node scripts/codefleet.cjs --agents
node scripts/codefleet.cjs --agent auto --mode subagent --project "D:\CongViec"
```

Cài và đăng nhập AI CLI theo hướng dẫn từ `--agents`. Với repo private, đăng nhập GitHub bằng tài khoản có quyền đọc repo khi Git yêu cầu.

## Sử dụng

Chạy `codefleet --agent codex --codex-sandbox danger-full-access` để mở phiên Codex với quyền truy cập của tài khoản Windows hiện tại. Các lựa chọn khác là `read-only` và `workspace-write`. Subagent khảo sát của Codex luôn dùng `read-only`.

Gõ `codefleet` để mở giao diện toàn màn hình với Telex tích hợp. Chọn bàn phím ENG trong Windows. Dùng `/input system` để chuyển về bộ gõ hệ thống hoặc `/input vni` để gõ VNI.

Nếu bộ gõ tiếng Việt gặp lỗi trong giao diện toàn màn hình, mở `codefleet --ime`. Chế độ này dùng ô nhập gốc của terminal để bộ gõ xử lý dấu. Gõ lệnh và nhấn Enter như bình thường.

Gõ `/mode subagent` để agent chính đọc yêu cầu và chọn vai trò, nhiệm vụ, đầu ra cho từng AI CLI đang sẵn sàng. Các nhiệm vụ độc lập chạy song song và CodeFleet ưu tiên model bậc nhanh cho agent con. Ví dụ, với yêu cầu CAD, agent chính có thể giao một agent rà soát kích thước và một agent soạn quy trình dựng hình. Agent con làm việc ở chế độ chỉ đọc và trả kết quả về agent chính. Agent chính theo lựa chọn `/agent` và `/model` sẽ tổng hợp, dùng công cụ cần thiết và hoàn thành yêu cầu. Nếu không cần chia việc hoặc kế hoạch phân công gặp lỗi, agent chính tự xử lý.

`/mode agent` quay về chế độ một agent. Dùng `/team <yêu cầu>` để chạy đội cho một lượt hoặc `codefleet --mode subagent` để bật từ lúc mở.

Entry point Node chạy trong terminal, không mở Electron.

```cmd
.\codefleet.cmd
.\codefleet.cmd --agent agy
.\codefleet.cmd --project D:\PROJECT\my-app --agent codex
.\codefleet.cmd --print "Giải thích cấu trúc dự án"
.\codefleet.cmd --agents
.\codefleet.cmd --models --agent codex
.\codefleet.cmd --resume <conversation-id>
```

CLI tự build lần đầu. Sau khi sửa mã, chạy `node scripts/build-cli.cjs`. Trên hệ điều hành khác dùng `node scripts/codefleet.cjs`; có thể dùng `pnpm cli` nếu pnpm đã cấu hình.

Để gọi tên ngắn `codefleet` từ mọi thư mục trên Windows, chạy `node scripts/install-cli.cjs` một lần tại thư mục CodeFleet. Script tạo launcher ở thư mục prefix npm hiện tại, không đổi PATH và không ghi đè lệnh đã có của ứng dụng khác. Gỡ bằng cách xóa launcher `codefleet.cmd` ở đường dẫn script thông báo. Trên macOS/Linux có thể dùng `npm link`. Chưa cần đăng ký để chạy `D:\PROJECT\CODEFLEET\codefleet.cmd`.

Các lệnh: `/help`, `/agents`, `/agent <id|auto>`, `/models [id|auto]`, `/model <id>`, `/history`, `/skill`, `/new`, `/exit`. Nhấn Tab để hoàn thành lệnh hoặc tên agent. Mặc định dùng codex; auto chọn agent đầu tiên báo sẵn sàng. Đổi agent xóa lựa chọn model cũ. Ctrl+C dừng lượt đang chạy; nhấn khi rảnh để thoát. `/history` liệt kê ID hội thoại để dùng với `--resume` khi khởi động.

## Skill

Skill là thư mục chứa `SKILL.md` (frontmatter `name`, `description`) theo chuẩn Agent Skills mà codex, claude, agy và copilot cùng đọc.

```text
/skill                                         Xem skill đã cài; dấu • là skill agent đang chọn đọc được
/skill install https://github.com/owner/repo   Cài mọi skill trong repo cho agent đang chọn
/skill install https://github.com/owner/repo/tree/main/skills/pdf --agent all --project
/skill install <link> --skill pdf --force      Chỉ cài skill pdf, ghi đè bản cũ
/skill remove pdf [--project] [--agent all]
```

Mặc định cài vào thư mục người dùng; `--project` cài vào dự án. `--agent all` (hoặc khi agent đang là `auto`) cài cho mọi agent.

| Agent   | Người dùng               | Dự án            |
| ------- | ------------------------ | ---------------- |
| codex   | `~/.agents/skills`       | `.agents/skills` |
| claude  | `~/.claude/skills`       | `.claude/skills` |
| agy     | `~/.gemini/config/skills` | `.agents/skills` |
| copilot | `~/.copilot/skills`      | `.agents/skills` |

`/skill` còn đọc `~/.codex/skills` (hoặc `$CODEX_HOME/skills`) và `.github/skills`. Lệnh cài dùng `git clone --depth 1` nên cần có git; repo riêng tư dùng credential sẵn có của git, không đưa token vào link. Symlink và `.git` không được sao chép. Sau khi cài hoặc gỡ, lượt chat kế tiếp mở phiên agent mới để nạp skill (ngữ cảnh hội thoại vẫn được giữ). Chỉ cài skill từ nguồn tin cậy vì skill có thể chứa script mà agent sẽ chạy.

`/agents` hiện lệnh cài đặt cho CLI còn thiếu và lệnh đăng nhập khi cần. `/models` kiểm tra agent đang chọn. Dùng `/models agy` để kiểm tra riêng agy hoặc `/models auto` để kiểm tra tất cả agent. Danh sách model có thể đến từ CLI, bộ nhớ đệm hoặc danh mục mặc định.

Phiên tương tác hiển thị khung thông tin dự án, prompt, phản hồi theo luồng và thời gian xử lý. Đặt `NO_COLOR=1` để tắt màu hoặc `CODEFLEET_ASCII=1` nếu terminal không hiển thị được ký hiệu Unicode. `--print` giữ đầu ra văn bản thuần để dùng trong script.

Đăng nhập trước bằng CLI chính thức của từng hãng. CodeFleet giữ cấu hình quyền của từng CLI; quyền bị CLI từ chối trong print mode vẫn bị từ chối. Các yêu cầu quyền do adapter phát ra được hỏi trong terminal; `--print` tự từ chối vì không có tương tác.

Dữ liệu CLI lưu riêng ở `~/.codefleet`; đổi bằng `CODEFLEET_HOME` hoặc `--data-dir`. Chat chạy trực tiếp qua adapter, truyền yêu cầu gốc và giữ ngữ cảnh khi đổi agent hoặc mở lại hội thoại. Phiên bản này chưa cung cấp planner theo bước, màn hình plugin, preview và chỉnh sửa file bằng GUI của desktop.

Cần Node 22+ và dependency dự án. Nếu `better-sqlite3` đang build cho Electron, build lại cho Node (`pnpm rebuild:node`) trước khi dùng CLI vì ABI của hai runtime khác nhau.
