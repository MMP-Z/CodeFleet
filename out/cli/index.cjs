"use strict";
const node_readline = require("node:readline");
const node_child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const node_stream = require("node:stream");
const node_string_decoder = require("node:string_decoder");
const commands = [
  "/agent",
  "/agents",
  "/exit",
  "/help",
  "/history",
  "/input",
  "/model",
  "/mode",
  "/models",
  "/new",
  "/skill",
  "/team"
];
const skillCommands = ["help", "install ", "list", "remove "].map((sub) => `/skill ${sub}`);
function completeCommand(input, agentIds) {
  const agentCommand = ["/agent ", "/models "].find((prefix) => input.startsWith(prefix));
  const candidates = agentCommand ? ["auto", ...agentIds].map((id) => `${agentCommand}${id}`) : input.startsWith("/mode ") ? ["/mode agent", "/mode subagent"] : input.startsWith("/input ") ? ["/input telex", "/input vni", "/input system"] : input.startsWith("/skill ") ? skillCommands : input.startsWith("/") ? commands : [];
  return [candidates.filter((candidate) => candidate.startsWith(input)), input];
}
const tones = ["́", "̀", "̉", "̃", "̣"];
const toneMarks = /[\u0300\u0301\u0303\u0309\u0323]/g;
const shapeMarks = /[\u0302\u0306\u031b]/g;
const circumflex = "̂";
const breve = "̆";
const horn = "̛";
function parseInputMode(value) {
  if (value === "system" || value === "telex" || value === "vni") return value;
  throw new Error("Chọn kiểu nhập system, telex hoặc vni.");
}
function base(letter) {
  return letter[0].toLowerCase();
}
function moveTone(letters, tone) {
  if (!tone) return;
  let vowels = letters.map((letter, index) => "aeiouy".includes(base(letter)) ? index : -1).filter((index) => index >= 0);
  const onset = base(letters[0] ?? " ") + base(letters[1] ?? " ");
  if (vowels.length > 1 && (onset === "qu" || onset === "gi"))
    vowels = vowels.filter((i) => i !== 1);
  if (!vowels.length) return;
  const last = vowels.at(-1);
  const marked = vowels.filter((i) => /[\u0302\u0306\u031b]/.test(letters[i])).at(-1);
  const closed = last < letters.length - 1;
  const modern = /^(oa|oe|uy)$/.test(vowels.map((i) => base(letters[i])).join(""));
  const target = marked ?? (vowels.length >= 3 ? vowels[1] : closed || modern ? last : vowels[0]);
  letters[target] += tone;
}
function shape(letters, targets, mark) {
  const repeated = targets.every((index) => letters[index].includes(mark));
  for (const index of targets) {
    letters[index] = letters[index].replace(shapeMarks, "") + (repeated ? "" : mark);
  }
  return !repeated;
}
function composeWord(stem, key, mode) {
  const lower = key.toLowerCase();
  const decomposed = Array.from(stem.normalize("NFC"), (letter) => letter.normalize("NFD"));
  let tone = decomposed.join("").match(toneMarks)?.[0] ?? "";
  const letters = decomposed.map((letter) => letter.replace(toneMarks, ""));
  const last = letters.length - 1;
  const toneIndex = (mode === "telex" ? "sfrxj" : "12345").indexOf(lower);
  let consumed = false;
  if (toneIndex >= 0 && letters.some((letter) => "aeiouy".includes(base(letter)))) {
    consumed = tone !== tones[toneIndex];
    tone = consumed ? tones[toneIndex] : "";
  } else if (lower === (mode === "telex" ? "z" : "0")) {
    const plain = stem.normalize("NFD").replace(toneMarks, "").replace(shapeMarks, "").replace(/[đĐ]/g, (letter) => letter === "đ" ? "d" : "D");
    if (plain.normalize("NFC") !== stem.normalize("NFC")) return plain.normalize("NFC");
  } else if (lower === "d" && mode === "telex" || lower === "9" && mode === "vni") {
    const index = mode === "telex" ? last : letters.map((letter2) => /[dđ]/i.test(letter2)).lastIndexOf(true);
    const letter = letters[index];
    if (letter && /[dđ]/i.test(letter)) {
      consumed = base(letter) === "d";
      const upper = letter === letter.toUpperCase();
      letters[index] = consumed ? upper ? "Đ" : "đ" : upper ? "D" : "d";
    }
  } else if (mode === "telex" && /^[aeo]$/.test(lower) && base(letters[last]) === lower || mode === "vni" && lower === "6") {
    const index = mode === "telex" ? last : letters.map((letter) => "aeo".includes(base(letter))).lastIndexOf(true);
    if (index >= 0) consumed = shape(letters, [index], circumflex);
  } else if (mode === "telex" && lower === "w" || mode === "vni" && /[78]/.test(lower)) {
    const allowed = mode === "telex" ? "aou" : lower === "7" ? "ou" : "a";
    const index = letters.map((letter) => allowed.includes(base(letter))).lastIndexOf(true);
    if (index >= 0) {
      const isA = base(letters[index]) === "a";
      const pair = index > 0 && base(letters[index]) === "o" && base(letters[index - 1]) === "u" && !(index === 2 && base(letters[0]) === "q");
      consumed = shape(letters, pair ? [index - 1, index] : [index], isA ? breve : horn);
    }
  }
  if (!consumed) letters.push(key);
  moveTone(letters, tone);
  return letters.join("").normalize("NFC");
}
function composeVietnamese(line, cursor, key, mode) {
  if (!/^[a-z0-9]$/i.test(key) || line.trimStart().startsWith("/")) return;
  if (line[cursor - 1] !== key || /^[\p{L}\p{M}\d]/u.test(line.slice(cursor))) return;
  const stem = /[\p{L}\p{M}]+$/u.exec(line.slice(0, cursor - 1))?.[0];
  if (!stem || !/^[a-zđ]+$/i.test(stem.normalize("NFD").replace(new RegExp("\\p{M}", "gu"), ""))) return;
  const rendered = composeWord(stem, key, mode);
  if (rendered === stem + key) return;
  const start = cursor - stem.length - 1;
  return {
    line: line.slice(0, start) + rendered + line.slice(cursor),
    cursor: start + rendered.length
  };
}
function parseOptions(args) {
  const options = {
    project: process.cwd(),
    agent: "codex",
    help: false,
    agents: false,
    inputMode: "telex"
  };
  const values = /* @__PURE__ */ new Map([
    ["--project", "project"],
    ["--agent", "agent"],
    ["--model", "model"],
    ["--print", "prompt"],
    ["-p", "prompt"],
    ["--resume", "resume"],
    ["--data-dir", "dataDir"]
  ]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--agents") options.agents = true;
    else if (arg === "--models") options.models = true;
    else if (arg === "--ime") options.ime = true;
    else if (arg === "--input") options.inputMode = parseInputMode(args[++i]);
    else if (arg === "--codex-sandbox") {
      const mode = args[++i];
      if (mode !== "read-only" && mode !== "workspace-write" && mode !== "danger-full-access") {
        throw new Error("--codex-sandbox cần read-only, workspace-write hoặc danger-full-access.");
      }
      options.codexSandbox = mode;
    } else if (arg === "--mode") options.mode = parseMode(args[++i]);
    else {
      const key = values.get(arg);
      if (!key) throw new Error(`Tham số không hợp lệ: ${arg}. Dùng --help.`);
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Thiếu giá trị cho ${arg}`);
      options[key] = value;
    }
  }
  return options;
}
function parseMode(value) {
  if (value === "agent" || value === "subagent") return value;
  throw new Error("Chọn chế độ agent hoặc subagent.");
}
function terminalText(value) {
  return value.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}
const HELP = [
  "Danh sách lệnh CodeFleet CLI:",
  "  /help              Hiển thị trợ giúp",
  "  /agents            Kiểm tra agent và xem gợi ý cài đặt",
  "  /agent <id|auto>   Chọn agent cụ thể hoặc chế độ tự động (auto)",
  "  /models [id|auto]  Kiểm tra model của agent hiện tại hoặc agent chỉ định",
  "  /model <id>        Đổi model sử dụng",
  "  /history           Xem lịch sử hội thoại",
  "  /input telex|vni|system  Chọn cách gõ tiếng Việt",
  "  /mode agent|subagent  Chọn một agent hoặc để agent chính phân công",
  "  /team <yêu cầu>     Dùng chế độ subagent cho một lượt",
  "  /skill             Xem skill; /skill install <link-git> để cài (/skill help)",
  "  /new               Bắt đầu phiên hội thoại mới",
  "  /exit              Thoát chương trình"
].join("\n");
function quotaLabel(agentId, model, snapshots) {
  const snapshot = (model ? snapshots.find((item) => item.model === model) : void 0) ?? snapshots.find((item) => item.model === null);
  const remaining = (pattern) => {
    const window = snapshot?.windows.find((item) => pattern.test(item.label));
    if (!window) return null;
    if (window.usedPercent === null || !Number.isFinite(window.usedPercent)) return "—";
    if (window.resetsAt && Date.parse(window.resetsAt) <= Date.now()) return "—";
    const percent = Math.round(100 - Math.max(0, Math.min(100, window.usedPercent)));
    return (snapshot?.source === "estimated" ? "≈" : "") + percent + "%";
  };
  const month = remaining(/^(tháng|month)/i);
  if (month !== null) {
    const count = snapshot?.windows.find((item) => /^(tháng|month)/i.test(item.label))?.label.match(/\((\d+)\/(\d+)\)/);
    return "Còn tháng " + month + (count ? ` (${Math.max(0, Number(count[2]) - Number(count[1]))}/${count[2]} lượt)` : "");
  }
  const short = remaining(/^(5\s*(h|giờ)|five hour)/i) ?? "—";
  const week = remaining(/^(tuần|7\s*(d|ngày)|week)/i) ?? "—";
  const minimum = agentId === "agy" && snapshot?.source === "official" && snapshot.model === null;
  return "Còn 5h " + short + " · Tuần " + week + (minimum ? " (thấp nhất)" : "");
}
const SKILL_AGENTS = ["codex", "claude", "agy", "copilot"];
const IGNORED_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", ".venv", "__pycache__"]);
const MAX_SEARCH_DEPTH = 5;
function parseSkillFrontmatter(text) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const result = {};
  for (let i = 0; i < lines.length; i++) {
    const field = /^(name|description):\s*(.*)$/.exec(lines[i]);
    if (!field) continue;
    let value = field[2].trim();
    if (/^[>|][-+]?$/.test(value) || value === "") {
      const block = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        block.push(lines[++i].trim());
      }
      value = block.filter(Boolean).join(" ");
    } else if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    result[field[1]] = value;
  }
  return result;
}
function parseGitSource(input) {
  const url = input.trim();
  if (!url || url.startsWith("-")) throw new Error("Link git không hợp lệ.");
  if (/^git@[\w.-]+:[\w./~-]+$/.test(url) || /^ssh:\/\//.test(url)) return { repo: url };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Link git phải bắt đầu bằng https://, http://, ssh:// hoặc git@.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Link git phải bắt đầu bằng https://, http://, ssh:// hoặc git@.");
  }
  if (parsed.username || parsed.password) {
    throw new Error(
      "Không đưa thông tin đăng nhập vào link; dùng trình quản lý credential của git."
    );
  }
  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const marker = segments.findIndex(
    (segment, index) => (segment === "tree" || segment === "blob") && index >= 2
  );
  if (marker === -1) {
    parsed.hash = "";
    parsed.search = "";
    return { repo: parsed.toString().replace(/\/+$/, "") };
  }
  const repoSegments = segments.slice(0, segments[marker - 1] === "-" ? marker - 1 : marker);
  const ref = segments[marker + 1];
  let rest = segments.slice(marker + 2);
  if (rest.length && /^skill\.md$/i.test(rest[rest.length - 1])) rest = rest.slice(0, -1);
  if (rest.some((segment) => segment === ".." || segment === ".")) {
    throw new Error("Đường dẫn trong link git không hợp lệ.");
  }
  return {
    repo: `${parsed.protocol}//${parsed.host}/${repoSegments.join("/")}`,
    ref,
    subpath: rest.length ? rest.join("/") : void 0
  };
}
function sanitizeSkillName(name) {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  if (!clean) throw new Error(`Tên skill không hợp lệ: ${name}`);
  return clean.slice(0, 64);
}
function resolveSkillAgents(value, current) {
  const target = value ?? current;
  if (target === "all" || target === "auto") return [...SKILL_AGENTS];
  if (SKILL_AGENTS.includes(target)) return [target];
  throw new Error(`Agent ${target} chưa hỗ trợ skill. Chọn: ${SKILL_AGENTS.join(", ")}, all.`);
}
const defaultClone = (source, destination) => new Promise((resolve, reject) => {
  const args = ["clone", "--depth", "1", "--quiet"];
  if (source.ref) args.push("--branch", source.ref);
  args.push("--", source.repo, destination);
  node_child_process.execFile(
    "git",
    args,
    {
      timeout: 12e4,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
    },
    (error, _stdout, stderr) => {
      if (!error) return resolve();
      const code = error.code;
      if (code === "ENOENT") reject(new Error("Không tìm thấy git. Cài git rồi thử lại."));
      else reject(new Error(`git clone thất bại: ${String(stderr).trim() || error.message}`));
    }
  );
});
class SkillService {
  projectDir;
  homeDir;
  env;
  clone;
  constructor(options) {
    this.projectDir = options.projectDir;
    this.homeDir = options.homeDir ?? os.homedir();
    this.env = options.env ?? process.env;
    this.clone = options.clone ?? defaultClone;
  }
  /** Các thư mục mà từng AI CLI đọc skill. */
  locations() {
    const project = (rel) => path.join(this.projectDir, rel);
    const home = (rel) => path.join(this.homeDir, rel);
    const codexHome = this.env.CODEX_HOME ? path.resolve(this.env.CODEX_HOME) : home(".codex");
    return [
      { scope: "project", dir: project(".agents/skills"), agents: ["codex", "agy", "copilot"] },
      { scope: "project", dir: project(".claude/skills"), agents: ["claude", "copilot"] },
      { scope: "project", dir: project(".github/skills"), agents: ["copilot"] },
      { scope: "user", dir: home(".agents/skills"), agents: ["codex", "copilot"] },
      { scope: "user", dir: path.join(codexHome, "skills"), agents: ["codex"] },
      { scope: "user", dir: home(".claude/skills"), agents: ["claude"] },
      { scope: "user", dir: home(".copilot/skills"), agents: ["copilot"] },
      { scope: "user", dir: home(".gemini/config/skills"), agents: ["agy"] }
    ];
  }
  /** Thư mục cài đặt cho mỗi agent theo phạm vi. */
  installDir(agent, scope) {
    const project = scope === "project";
    const base2 = project ? this.projectDir : this.homeDir;
    switch (agent) {
      case "codex":
        return path.join(base2, ".agents/skills");
      case "claude":
        return path.join(base2, ".claude/skills");
      case "agy":
        return project ? path.join(base2, ".agents/skills") : path.join(base2, ".gemini/config/skills");
      case "copilot":
        return project ? path.join(base2, ".agents/skills") : path.join(base2, ".copilot/skills");
    }
  }
  list() {
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    for (const location of this.locations()) {
      const key = path.resolve(location.dir).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let entries;
      try {
        entries = fs.readdirSync(location.dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const dir = path.join(location.dir, entry.name);
        const file = path.join(dir, "SKILL.md");
        let text;
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          continue;
        }
        const meta = parseSkillFrontmatter(text);
        result.push({
          name: meta.name || entry.name,
          description: meta.description ?? "",
          dir,
          location
        });
      }
    }
    return result;
  }
  async install(options) {
    if (!options.agents.length) throw new Error("Chưa chọn agent để cài skill.");
    const source = parseGitSource(options.url);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codefleet-skill-"));
    try {
      const checkout = path.join(temp, "repo");
      await this.clone(source, checkout);
      const root = source.subpath ? path.resolve(checkout, source.subpath) : checkout;
      if (!isInside(checkout, root) || !fs.existsSync(root)) {
        throw new Error(`Không tìm thấy thư mục ${source.subpath} trong repo.`);
      }
      let found = findSkillDirs(root).map((dir) => {
        const meta = parseSkillFrontmatter(fs.readFileSync(path.join(dir, "SKILL.md"), "utf8"));
        const fallback = dir === checkout ? repoName(source.repo) : path.basename(dir);
        return { dir, name: sanitizeSkillName(meta.name || fallback) };
      });
      if (!found.length) throw new Error("Repo không có file SKILL.md nào.");
      if (options.only) {
        const wanted = sanitizeSkillName(options.only);
        found = found.filter((skill) => skill.name === wanted);
        if (!found.length) throw new Error(`Không tìm thấy skill ${options.only} trong repo.`);
      }
      const names = /* @__PURE__ */ new Set();
      for (const skill of found) {
        if (names.has(skill.name)) throw new Error(`Repo có nhiều skill trùng tên ${skill.name}.`);
        names.add(skill.name);
      }
      const dirs = [
        ...new Set(options.agents.map((agent) => this.installDir(agent, options.scope)))
      ];
      const plan = found.map((skill) => ({
        ...skill,
        targets: dirs.map((dir) => path.join(dir, skill.name))
      }));
      if (!options.force) {
        const existing = plan.flatMap((skill) => skill.targets).filter((t) => fs.existsSync(t));
        if (existing.length) {
          throw new Error(`Skill đã tồn tại: ${existing.join(", ")}. Thêm --force để ghi đè.`);
        }
      }
      for (const skill of plan) {
        for (const target of skill.targets) {
          fs.rmSync(target, { recursive: true, force: true });
          copySkillDir(skill.dir, target);
        }
      }
      return plan.map(({ name, targets }) => ({ name, targets }));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  }
  /** Gỡ skill khỏi các thư mục cài đặt của agent đã chọn. */
  remove(name, scope, agents) {
    const clean = sanitizeSkillName(name);
    const removed = [];
    for (const dir of new Set(agents.map((agent) => this.installDir(agent, scope)))) {
      const target = path.join(dir, clean);
      if (!fs.existsSync(path.join(target, "SKILL.md"))) continue;
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
    if (!removed.length) throw new Error(`Không tìm thấy skill ${clean} để gỡ.`);
    return removed;
  }
}
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || !relative.startsWith("..") && !path.isAbsolute(relative);
}
function repoName(repo) {
  return repo.replace(/\.git$/, "").split(/[/:]/).filter(Boolean).pop() ?? "skill";
}
function findSkillDirs(root, depth = 0) {
  if (fs.existsSync(path.join(root, "SKILL.md"))) return [root];
  if (depth >= MAX_SEARCH_DEPTH) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
    result.push(...findSkillDirs(path.join(root, entry.name), depth + 1));
  }
  return result;
}
function copySkillDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.isSymbolicLink()) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copySkillDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
const SKILL_HELP = [
  "Lệnh skill:",
  "  /skill                              Xem skill đã cài (dự án và người dùng)",
  "  /skill install <link-git> [tùy chọn] Cài skill từ repo git",
  "  /skill remove <tên> [tùy chọn]      Gỡ skill",
  "Tùy chọn:",
  "  --project            Cài vào thư mục dự án (mặc định: thư mục người dùng)",
  `  --agent <id|all>     Agent nhận skill (${SKILL_AGENTS.join(", ")}, all; mặc định agent đang chọn)`,
  "  --skill <tên>        Chỉ cài một skill khi repo có nhiều skill",
  "  --force              Ghi đè skill trùng tên",
  "Hỗ trợ link thư mục, ví dụ https://github.com/owner/repo/tree/main/skills/pdf"
].join("\n");
function splitArgs(input) {
  const result = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while (match = pattern.exec(input)) result.push(match[1] ?? match[2] ?? match[3]);
  return result;
}
function parseArgs(args) {
  const positional = [];
  let scope = "user";
  let agent;
  let skill;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = () => {
      const next = args[++i];
      if (!next || next.startsWith("--")) throw new Error(`Thiếu giá trị cho ${arg}.`);
      return next;
    };
    if (arg === "--project") scope = "project";
    else if (arg === "--global" || arg === "--user") scope = "user";
    else if (arg === "--force" || arg === "-f") force = true;
    else if (arg === "--agent") agent = value();
    else if (arg === "--skill") skill = value();
    else if (arg.startsWith("--"))
      throw new Error(`Tùy chọn không hợp lệ: ${arg}. Gõ /skill help.`);
    else positional.push(arg);
  }
  return { positional, scope, agent, skill, force };
}
function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function formatSkillList(skills, currentAgent) {
  if (!skills.length) {
    return "Chưa có skill nào. Cài bằng /skill install <link-git>.";
  }
  const lines = [];
  let lastDir = "";
  const width2 = Math.min(28, Math.max(...skills.map((skill) => skill.name.length)));
  for (const skill of skills) {
    if (skill.location.dir !== lastDir) {
      lastDir = skill.location.dir;
      const scope = skill.location.scope === "project" ? "Dự án" : "Người dùng";
      lines.push(
        `${lines.length ? "\n" : ""}${scope} · ${lastDir} (${skill.location.agents.join(", ")})`
      );
    }
    const active = currentAgent === "auto" || skill.location.agents.includes(currentAgent);
    const description = shorten(skill.description.replace(/\s+/g, " "), 90);
    lines.push(`  ${active ? "•" : " "} ${skill.name.padEnd(width2)}  ${description}`.trimEnd());
  }
  lines.push(`
• skill agent ${currentAgent} đọc được. Tổng: ${skills.length}.`);
  return lines.join("\n");
}
async function runSkillCommand(input, ctx) {
  const [sub = "list", ...rest] = splitArgs(input);
  if (sub === "help") {
    ctx.line(SKILL_HELP);
    return;
  }
  if (sub === "list" || sub === "ls") {
    ctx.line(formatSkillList(ctx.service.list(), ctx.currentAgent));
    return;
  }
  const args = parseArgs(rest);
  const agents = resolveSkillAgents(args.agent, ctx.currentAgent);
  const where = args.scope === "project" ? "dự án" : "người dùng";
  if (sub === "install" || sub === "add") {
    const url = args.positional[0];
    if (!url || args.positional.length > 1) {
      throw new Error("Dùng: /skill install <link-git> [--project] [--agent <id|all>] [--force]");
    }
    ctx.notice(`Đang tải skill từ ${url}…`);
    const installed = await ctx.service.install({
      url,
      scope: args.scope,
      agents,
      force: args.force,
      only: args.skill
    });
    for (const skill of installed) {
      ctx.line(`Đã cài ${skill.name} (${where}, ${agents.join(", ")})`);
      for (const target of skill.targets) ctx.line(`  ${target}`);
    }
    ctx.line("Chỉ cài skill từ nguồn tin cậy: skill có thể chứa lệnh và script mà agent sẽ chạy.");
    ctx.onChanged();
    return;
  }
  if (sub === "remove" || sub === "rm" || sub === "uninstall") {
    const name = args.positional[0];
    if (!name || args.positional.length > 1) {
      throw new Error("Dùng: /skill remove <tên> [--project] [--agent <id|all>]");
    }
    for (const target of ctx.service.remove(name, args.scope, agents)) {
      ctx.line(`Đã gỡ ${target}`);
    }
    ctx.onChanged();
    return;
  }
  throw new Error(`Lệnh skill không hợp lệ: ${sub}. Gõ /skill help.`);
}
const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
const reset = "\x1B[0m";
const sgr = /(\x1b\[[0-9;]*m)/;
function width(glyph) {
  if (new RegExp("^\\p{Mark}+$", "u").test(glyph)) return 0;
  return /[\p{Extended_Pictographic}\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff01-\uff60]/u.test(
    glyph
  ) ? 2 : 1;
}
function wrap(text, columns) {
  const lines = [];
  let style = "";
  let line = "";
  let used = 0;
  for (const part of text.replace(/\t/g, "    ").split(sgr)) {
    if (part.startsWith("\x1B[")) {
      style = part === reset ? "" : style + part;
      line += part;
      continue;
    }
    for (const { segment } of segmenter.segment(part)) {
      const cells = width(segment);
      if (used + cells > columns) {
        lines.push(line);
        line = style;
        used = 0;
      }
      line += segment;
      used += cells;
    }
  }
  lines.push(line);
  return lines;
}
function sliceDraft(draft, cursor, columns) {
  const glyphs = Array.from(segmenter.segment(draft.replace(/[\t\r\n]/g, " ")));
  let caret = 0;
  let start = 0;
  let end = 0;
  while (end < glyphs.length && glyphs[end].index < cursor) {
    caret += width(glyphs[end++].segment);
    while (caret >= columns) caret -= width(glyphs[start++].segment);
  }
  let used = caret;
  while (end < glyphs.length && used + width(glyphs[end].segment) <= columns) {
    used += width(glyphs[end++].segment);
  }
  return {
    text: glyphs.slice(start, end).map(({ segment }) => segment).join(""),
    caret
  };
}
function createTerminalScreen(stdout, color, unicode) {
  const history = [];
  let headerLines = 0;
  let tail = "";
  let offset = 0;
  let frame = [];
  let pending;
  let pendingInput;
  let open = true;
  let getComposer = () => ({ draft: "", cursor: 0, status: "", prompt: "> " });
  function render() {
    const columns = stdout.columns - 1;
    const rows = stdout.rows;
    if (columns < 12 || rows < 6) {
      stdout.write("\x1B[?25l\x1B[2J\x1B[HMở rộng terminal để tiếp tục.");
      frame = [];
      return;
    }
    const contentHeight = rows - 4;
    const content = [];
    let skipped = 0;
    const tailRows = tail ? wrap(tail, columns) : [];
    for (let i = history.length; i >= 0 && content.length < contentHeight; i--) {
      const entry = history[i];
      if (entry && entry.columns !== columns) {
        entry.columns = columns;
        entry.rows = wrap(entry.text, columns);
      }
      const lines = entry?.rows ?? tailRows;
      for (let j = lines.length - 1; j >= 0 && content.length < contentHeight; j--) {
        if (skipped++ >= offset) content.push(lines[j]);
      }
    }
    if (content.length < contentHeight && offset > 0) {
      offset = Math.max(0, skipped - contentHeight);
      return render();
    }
    const next = content.reverse();
    while (next.length < contentHeight) next.push("");
    const state = getComposer();
    const prompt = terminalText(state.prompt);
    const draft = sliceDraft(terminalText(state.draft), state.cursor, columns - prompt.length);
    const divider = (unicode ? "─" : "-").repeat(columns);
    const muted = (text) => color ? "\x1B[38;5;245m" + text : text;
    const status = offset ? state.status + " · ↓ PgDn để về cuối" : state.status;
    next.push(
      muted(divider),
      prompt + draft.text,
      muted(divider),
      muted(wrap(terminalText(status), columns)[0])
    );
    let output = "\x1B[?25l";
    next.forEach((line, i) => {
      if (frame[i] !== line) output += "\x1B[" + (i + 1) + ";1H\x1B[2K" + line + reset;
    });
    frame = next;
    stdout.write(
      output + "\x1B[" + (contentHeight + 2) + ";" + (prompt.length + draft.caret + 1) + "H\x1B[?25h"
    );
  }
  function refresh() {
    if (!open || pending) return;
    pending = setImmediate(() => {
      pending = void 0;
      if (open) render();
    });
  }
  function refreshInput() {
    if (!open || pendingInput) return;
    pendingInput = setTimeout(() => {
      pendingInput = void 0;
      refresh();
    }, 20);
  }
  function write(text) {
    if (text === "\r\x1B[2K") {
      tail = "";
    } else {
      const lines = (tail + text).split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) history.push({ text: line });
      if (history.length > 3e3) history.splice(headerLines, history.length - 3e3);
    }
    refresh();
  }
  const inputOutput = new node_stream.Writable({
    write(_chunk, _encoding, callback) {
      refreshInput();
      callback();
    }
  });
  Object.defineProperty(inputOutput, "columns", { get: () => stdout.columns });
  function resize() {
    frame = [];
    stdout.write("\x1B[2J");
    refresh();
  }
  function close() {
    if (!open) return;
    open = false;
    if (pending) clearImmediate(pending);
    clearTimeout(pendingInput);
    stdout.off("resize", resize);
    process.off("exit", close);
    stdout.write("\x1B[?2004l\x1B[?1006l\x1B[?1000l\x1B[0m\x1B[?25h\x1B[?1049l");
  }
  stdout.write("\x1B[?1049h\x1B[2J");
  stdout.on("resize", resize);
  process.once("exit", close);
  return {
    inputOutput,
    write,
    refresh,
    refreshInput,
    close,
    enableMouse() {
      stdout.write("\x1B[?1000h\x1B[?1006h\x1B[?2004h");
    },
    setHeader(text) {
      const rows = text.split("\n");
      if (rows.at(-1) === "") rows.pop();
      history.splice(0, headerLines, ...rows.map((row) => ({ text: row })));
      headerLines = rows.length;
      refresh();
    },
    setComposer(read) {
      getComposer = read;
      refresh();
    },
    submit(text) {
      offset = 0;
      const label = (unicode ? "❯ " : "> ") + terminalText(text);
      write("\n" + (color ? "\x1B[1;38;5;255;48;5;237m" + label + reset : label) + "\n");
    },
    scroll(direction, lines = Math.max(1, stdout.rows - 6)) {
      offset = Math.max(0, offset + direction * lines);
      refresh();
    }
  };
}
const mousePrefix = "\x1B[<";
function enableWindowsVtInput() {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace CodeFleet -Name ConsoleInput -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern System.IntPtr GetStdHandle(int id);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool GetConsoleMode(System.IntPtr handle, out uint mode);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool SetConsoleMode(System.IntPtr handle, uint mode);
'@
$handle = [CodeFleet.ConsoleInput]::GetStdHandle(-10)
$mode = [uint32]0
if (-not [CodeFleet.ConsoleInput]::GetConsoleMode($handle, [ref]$mode)) { exit 1 }
if (-not [CodeFleet.ConsoleInput]::SetConsoleMode($handle, (($mode -bor 0x290) -band (-bnot 0x40)))) { exit 1 }
`;
  node_child_process.spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64")
    ],
    { stdio: ["inherit", "ignore", "ignore"], windowsHide: true, timeout: 4e3 }
  );
}
function createTerminalInput(source, scroll) {
  const decoder = new node_string_decoder.StringDecoder("utf8");
  let pending = "";
  let flushTimer;
  function consume(data) {
    clearTimeout(flushTimer);
    let text = pending + data;
    pending = "";
    let start = text.indexOf(mousePrefix);
    while (start >= 0) {
      input.push(text.slice(0, start));
      text = text.slice(start);
      const body = text.slice(mousePrefix.length);
      const report = /^(\d{1,5});\d{1,5};\d{1,5}([Mm])/.exec(body);
      if (report) {
        const button = Number(report[1]);
        if (report[2] === "M" && (button & 224) === 64 && (button & 3) < 2) {
          scroll((button & 1) === 0 ? 1 : -1);
        }
        text = body.slice(report[0].length);
      } else if (/^\d{0,5}(?:;\d{0,5}){0,2}$/.test(body)) {
        pending = text;
        text = "";
        break;
      } else {
        text = body.replace(/^[\d;]{0,17}[Mm]?/, "");
      }
      start = text.indexOf(mousePrefix);
    }
    if (text.endsWith("\x1B[")) {
      pending = "\x1B[";
      text = text.slice(0, -2);
    } else if (text.endsWith("\x1B")) {
      pending = "\x1B";
      text = text.slice(0, -1);
    }
    input.push(text);
    if (pending) {
      flushTimer = setTimeout(() => {
        if (!pending.startsWith(mousePrefix)) input.push(pending);
        pending = "";
      }, 80);
      flushTimer.unref();
    }
  }
  const input = Object.assign(
    new node_stream.Transform({
      transform(chunk, _encoding, done) {
        consume(decoder.write(chunk));
        done();
      },
      flush(done) {
        consume(decoder.end());
        if (!pending.startsWith(mousePrefix)) this.push(pending);
        clearTimeout(flushTimer);
        done();
      },
      destroy(error, done) {
        clearTimeout(flushTimer);
        done(error);
      }
    }),
    {
      isTTY: true,
      setRawMode(mode) {
        source.setRawMode(mode);
        if (mode && process.platform === "win32" && source.isTTY) enableWindowsVtInput();
      }
    }
  );
  source.pipe(input);
  return input;
}
const ANSI = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  terracotta: "\x1B[38;5;173m",
  terracottaBright: "\x1B[1;38;5;209m",
  amber: "\x1B[38;5;215m",
  muted: "\x1B[38;5;245m",
  coral: "\x1B[1;38;5;203m"
};
function sanitize(value) {
  return terminalText(value).replace(/\r\n/g, "\n").replace(/\r/g, "");
}
function sanitizeInline(value) {
  return sanitize(value).replace(/[\n\t]+/g, " ").trim();
}
function formatDuration(elapsedMs) {
  const safeMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (safeMs < 1e3) {
    return `${Math.round(safeMs)}ms`;
  }
  const seconds = safeMs / 1e3;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  return `${mins}m ${remSec}s`;
}
function truncateEnd(text, maxLength, ellipsis) {
  if (maxLength <= 0) return "";
  if (text.length <= maxLength) return text;
  if (maxLength <= ellipsis.length) return ellipsis.slice(0, maxLength);
  return `${text.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
}
function truncateMiddlePath(pathText, maxLength, ellipsis) {
  if (maxLength <= 0) return "";
  if (pathText.length <= maxLength) return pathText;
  if (maxLength <= ellipsis.length + 4) {
    return truncateEnd(pathText, maxLength, ellipsis);
  }
  const available = maxLength - ellipsis.length;
  const head = Math.ceil(available * 0.4);
  const tail = available - head;
  return `${pathText.slice(0, head)}${ellipsis}${pathText.slice(pathText.length - tail)}`;
}
function wrapPlainLine(line, maxWidth) {
  if (maxWidth <= 0 || line.length <= maxWidth) {
    return [line];
  }
  const chunks = [];
  let remaining = line;
  while (remaining.length > maxWidth) {
    let splitAt = remaining.lastIndexOf(" ", maxWidth);
    if (splitAt <= Math.floor(maxWidth * 0.3)) {
      splitAt = maxWidth;
    }
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}
function createTerminalView(config) {
  let hasAssistantBullet = false;
  let atLineStart = true;
  let progressStartedAt;
  let progressTimer;
  let progressVisible = false;
  let progressFrame = 0;
  const frames = config.unicode ? ["✶", "✸", "✹", "✷"] : ["|", "/", "-", "\\"];
  const paint = (code, text) => config.color && text.length > 0 ? `${code}${text}${ANSI.reset}` : text;
  const getColumns = () => {
    const raw = Number(config.columns());
    if (!Number.isFinite(raw) || raw <= 0) return 80;
    return Math.max(24, Math.floor(raw));
  };
  const symbols = () => config.unicode ? {
    h: "─",
    star: "✻",
    chevron: "❯",
    bullet: "●",
    tool: "⎿",
    dot: "·",
    warn: "⚠",
    err: "✖",
    info: "ℹ",
    ellipsis: "…"
  } : {
    h: "-",
    star: "*",
    chevron: ">",
    bullet: "*",
    tool: "|-",
    dot: "|",
    warn: "!",
    err: "x",
    info: "i",
    ellipsis: "..."
  };
  const clearProgressLine = () => {
    if (!progressVisible) return;
    config.write("\r\x1B[2K");
    progressVisible = false;
  };
  const drawProgress = () => {
    if (!atLineStart || progressStartedAt === void 0) return;
    clearProgressLine();
    const elapsed = Math.floor((performance.now() - progressStartedAt) / 1e3);
    const frame = frames[progressFrame++ % frames.length];
    const label = `  ${frame} Đang suy nghĩ… ${symbols().dot} ${elapsed}s ${symbols().dot} Ctrl+C để dừng`;
    config.write(paint(ANSI.terracotta, truncateEnd(label, getColumns() - 1, symbols().ellipsis)));
    progressVisible = true;
  };
  const stopProgress = () => {
    clearInterval(progressTimer);
    progressTimer = void 0;
    clearProgressLine();
  };
  const resumeProgress = () => {
    if (!config.animateProgress || progressStartedAt === void 0 || progressTimer || hasAssistantBullet)
      return;
    drawProgress();
    progressTimer = setInterval(drawProgress, 160);
    progressTimer.unref();
  };
  const writeRaw = (text) => {
    if (!text) return;
    clearProgressLine();
    config.write(text);
    atLineStart = text.endsWith("\n");
    if (progressTimer) drawProgress();
  };
  const ensureLineStart = () => {
    if (atLineStart) return "";
    atLineStart = true;
    return "\n";
  };
  return {
    welcome(info) {
      const s = symbols();
      const cols = getColumns();
      const projectClean = sanitizeInline(info.project) || ".";
      const agentClean = sanitizeInline(info.agent) || "auto";
      const modelClean = info.model ? sanitizeInline(info.model) : "mặc định";
      const logo = config.unicode ? ["  ▄██▄  ", "▄██████▄", " ▀▀  ▀▀ "] : ["  /\\    ", " /==\\   ", " \\__/   "];
      const gap = "   ";
      const budget = cols - logo[0].length - gap.length - 1;
      const rows = [
        paint(ANSI.bold, "CodeFleet"),
        paint(ANSI.muted, truncateEnd(`${agentClean} ${s.dot} ${modelClean}`, budget, s.ellipsis)),
        paint(ANSI.muted, truncateMiddlePath(projectClean, budget, s.ellipsis))
      ];
      const header = rows.map((row, index) => paint(ANSI.terracotta, logo[index]) + gap + row);
      const text = "\n" + header.join("\n") + "\n";
      if (config.writeHeader) config.writeHeader(text);
      else writeRaw(ensureLineStart() + text);
    },
    prompt() {
      const s = symbols();
      return `${paint(ANSI.terracottaBright, s.chevron)} `;
    },
    footer(agent, model, quota) {
      const s = symbols();
      const cols = getColumns();
      const agentClean = sanitizeInline(agent) || "auto";
      const modelClean = model ? sanitizeInline(model) : "mặc định";
      const hint = `  /help${config.completion === false ? "" : ` ${s.dot} Tab`}`;
      const label = `  ${agentClean} ${s.dot} ${modelClean}${quota ? `   ${quota}` : ""}`;
      const fitted = `${truncateEnd(label, cols - hint.length, s.ellipsis)}${hint}`;
      const divider = s.h.repeat(Math.min(cols - 1, 74));
      writeRaw(`${ensureLineStart()}
${paint(ANSI.dim, divider)}
${paint(ANSI.muted, fitted)}
`);
    },
    beginTurn() {
      stopProgress();
      hasAssistantBullet = false;
      progressStartedAt = performance.now();
      writeRaw(ensureLineStart());
      if (config.animateProgress) resumeProgress();
      else writeRaw(`  ${symbols().star} Đang suy nghĩ… ${symbols().dot} Ctrl+C để dừng
`);
    },
    stopProgress,
    resumeProgress,
    status(text) {
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).trim();
      if (!clean) return;
      const prefixPlain = `  ${s.tool} `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const lines = clean.split("\n");
      const formattedLines = [];
      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const looksLikePath = /[\\/]/.test(trimmed) && !/\s/.test(trimmed);
        const fitted = looksLikePath ? truncateMiddlePath(trimmed, budget, s.ellipsis) : truncateEnd(trimmed, budget, s.ellipsis);
        formattedLines.push(`${paint(ANSI.terracotta, prefixPlain)}${paint(ANSI.muted, fitted)}`);
      }
      if (formattedLines.length > 0) {
        writeRaw(`${ensureLineStart()}${formattedLines.join("\n")}
`);
      }
    },
    message(text) {
      const clean = sanitize(text);
      if (!clean) return;
      stopProgress();
      const s = symbols();
      if (!hasAssistantBullet) {
        hasAssistantBullet = true;
        const lead = ensureLineStart();
        const bulletPrefix = `${paint(ANSI.terracottaBright, s.bullet)} `;
        writeRaw(`${lead}${bulletPrefix}${clean}`);
        return;
      }
      writeRaw(clean);
    },
    endTurn(elapsedMs, outcome) {
      stopProgress();
      progressStartedAt = void 0;
      const s = symbols();
      const duration = formatDuration(elapsedMs);
      let label;
      let tone;
      let icon = s.star;
      if (outcome === "done") {
        label = `Hoàn tất ${s.dot} ${duration}`;
        tone = ANSI.muted;
      } else if (outcome === "stopped") {
        label = `Đã dừng ${s.dot} ${duration}`;
        tone = ANSI.amber;
      } else {
        label = `Lỗi xử lý ${s.dot} ${duration}`;
        tone = ANSI.coral;
        icon = s.err;
      }
      const line = `  ${paint(tone, `${icon} ${label}`)}`;
      hasAssistantBullet = false;
      writeRaw(`${ensureLineStart()}${line}
`);
    },
    permission(title) {
      stopProgress();
      const s = symbols();
      const cols = getColumns();
      const cleanTitle = sanitizeInline(title) || "Thao tác cần xác nhận";
      const prefixPlain = `${s.warn} Xin quyền: `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const wrapped = wrapPlainLine(cleanTitle, budget);
      const firstLine = `${paint(ANSI.amber, prefixPlain)}${paint(ANSI.bold, wrapped[0] ?? cleanTitle)}`;
      const restLines = wrapped.slice(1).map((part) => `${" ".repeat(prefixPlain.length)}${paint(ANSI.bold, part)}`);
      const promptLine = `  ${paint(ANSI.terracotta, s.tool)} ${paint(ANSI.muted, "Cho phép? [y/N]")}`;
      writeRaw(`${ensureLineStart()}${[firstLine, ...restLines, promptLine].join("\n")}
`);
    },
    error(text) {
      stopProgress();
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).trim() || "Đã xảy ra lỗi không xác định.";
      const stripped = clean.replace(/^lỗi:\s*/i, "");
      const prefixPlain = `${s.err} Lỗi: `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const lines = stripped.split("\n").flatMap((line) => wrapPlainLine(line, budget));
      const first = `${paint(ANSI.coral, prefixPlain)}${paint(ANSI.coral, lines[0] ?? stripped)}`;
      const rest = lines.slice(1).map((line) => `${" ".repeat(prefixPlain.length)}${paint(ANSI.coral, line)}`);
      writeRaw(`${ensureLineStart()}${[first, ...rest].join("\n")}
`);
    },
    notice(text) {
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).replace(/^\n+|\n+$/g, "");
      if (!clean.trim()) return;
      const rawLines = clean.split("\n");
      if (rawLines.length === 1) {
        const prefixPlain = `${s.info} `;
        const budget = Math.max(12, cols - prefixPlain.length);
        const line = rawLines[0];
        const fitted = /[\\/]/.test(line) && line.length > budget ? truncateMiddlePath(line, budget, s.ellipsis) : truncateEnd(line, budget, s.ellipsis);
        writeRaw(
          `${ensureLineStart()}${paint(ANSI.terracotta, prefixPlain)}${paint(ANSI.muted, fitted)}
`
        );
        return;
      }
      const formatted = rawLines.map((line, idx) => {
        const fitted = truncateEnd(line, cols, s.ellipsis);
        return idx === 0 ? paint(ANSI.terracottaBright, fitted) : paint(ANSI.muted, fitted);
      });
      writeRaw(`${ensureLineStart()}${formatted.join("\n")}
`);
    }
  };
}
async function main() {
  const options = parseOptions(process.argv.slice(2));
  let screen;
  let savedTitle = false;
  const write = (text) => {
    const clean = terminalText(text);
    if (screen) screen.write(clean);
    else process.stdout.write(clean);
  };
  const line = (text) => write(`${text}
`);
  if (options.help) {
    line(
      `CodeFleet CLI

codefleet [--project <folder>] [--agent <id>] [--model <id>]
codefleet --print "yêu cầu"
codefleet --agents
codefleet --models [--agent <id|auto>]
codefleet --resume <conversation-id>

--data-dir <folder>  Thư mục dữ liệu CLI (mặc định ~/.codefleet)
--help               Trợ giúp

${HELP}`
    );
    line("--codex-sandbox <mode>  Chọn sandbox của Codex cho phiên CLI này");
    return;
  }
  if (!options.prompt && !options.agents && !options.models && !process.stdin.isTTY) {
    throw new Error("Dùng --print, --agents hoặc --models khi chạy ngoài terminal tương tác.");
  }
  const { CliRuntime: Runtime } = await Promise.resolve().then(() => require("./assets/runtime-DicqwmZx.js"));
  const runtime = new Runtime(options);
  const skills = new SkillService({ projectDir: options.project });
  const showAgent = (agent) => {
    line(`${agent.agentId.padEnd(10)} ${agent.status} ${agent.version ?? ""}`.trimEnd());
    if (agent.status === "not_installed") {
      line(`  Gợi ý cài đặt  ${agent.installCommand}`);
      line(`  Hướng dẫn     ${agent.docsUrl}`);
    } else if (agent.status === "not_logged_in") {
      line(`  Đăng nhập     ${agent.loginCommand}`);
    }
  };
  const showAgents = async () => {
    line("Đang kiểm tra AI CLI...");
    for (const agent of await runtime.registry.detectAll()) showAgent(agent);
  };
  const showModels = async (agentId = options.agent) => {
    line("Đang kiểm tra model...");
    const agents = await runtime.registry.detectAll(agentId === "auto" ? void 0 : agentId);
    for (const agent of agents) {
      showAgent(agent);
      if (agent.status !== "ready") continue;
      const models = runtime.models.listModels(agent.agentId);
      if (!models.length) {
        line("  Chưa tìm thấy model.");
        continue;
      }
      line("  Danh sách model từ CLI, bộ nhớ đệm hoặc danh mục mặc định");
      for (const model of models) {
        const selected = agent.agentId === options.agent && model.id === options.model;
        line(`  ${model.id}${selected ? "  (đang chọn)" : ""}`);
      }
      if (agent.agentId === options.agent && options.model && !models.some((model) => model.id === options.model)) {
        line(`  Model đang chọn ${options.model} chưa xuất hiện trong danh sách.`);
      }
    }
  };
  try {
    if (options.agents) {
      await showAgents();
      return;
    }
    if (options.models) {
      await showModels();
      return;
    }
    if (options.prompt !== void 0) {
      const onSignal = () => {
        void runtime.cancel();
        process.exitCode = 130;
      };
      process.on("SIGINT", onSignal);
      try {
        await runtime.send(options.prompt, {
          message: write,
          status: (text) => process.stderr.write(`${terminalText(text)}
`),
          permission: async (title) => {
            process.stderr.write(`Từ chối quyền trong chế độ --print: ${terminalText(title)}
`);
            return false;
          }
        });
        line("");
      } finally {
        process.off("SIGINT", onSignal);
      }
      return;
    }
    const dumbTerminal = process.env.TERM === "dumb";
    const canSetTitle = process.stdout.isTTY && !dumbTerminal;
    const syncTitle = () => {
      if (!canSetTitle) return;
      const agent = terminalText(options.agent).replace(/[\r\n\t]/g, " ");
      process.stdout.write("\x1B]0;CodeFleet · " + agent + "\x07");
    };
    if (canSetTitle) {
      process.stdout.write("\x1B[22;0t");
      savedTitle = true;
      syncTitle();
    }
    const color = Boolean(
      process.stdout.isTTY && !dumbTerminal && process.env.NO_COLOR === void 0
    );
    const unicode = !dumbTerminal && process.env.CODEFLEET_ASCII !== "1";
    if (process.stdout.isTTY && !dumbTerminal && !options.ime && process.stdout.rows >= 10) {
      screen = createTerminalScreen(process.stdout, color, unicode);
    }
    const view = createTerminalView({
      writeHeader: screen?.setHeader,
      write: (text) => screen ? screen.write(text) : process.stdout.write(text),
      columns: () => process.stdout.columns || 80,
      color,
      unicode,
      completion: !dumbTerminal && !options.ime,
      animateProgress: Boolean(process.stdout.isTTY && !dumbTerminal && !options.ime)
    });
    view.welcome(options);
    const mouseInput = screen ? createTerminalInput(process.stdin, (direction) => screen?.scroll(direction, 3)) : void 0;
    const input = mouseInput ?? process.stdin;
    const rl = node_readline.createInterface({
      input,
      output: screen?.inputOutput ?? process.stdout,
      terminal: !options.ime,
      completer: (input2) => completeCommand(
        input2,
        runtime.registry.getAllAdapters().map((adapter) => adapter.id)
      )
    });
    screen?.enableMouse();
    let pasting = false;
    let busy = false;
    let closed = false;
    let turnStopped = false;
    let pendingPermission;
    let task = Promise.resolve();
    let quota = [];
    let quotaKey = "";
    let quotaGeneration = 0;
    let refreshQuotaAfter = 0;
    const refreshQuota = async () => {
      const key = options.agent + ":" + (options.model ?? "");
      if (closed || key === quotaKey && Date.now() < refreshQuotaAfter) return;
      if (key !== quotaKey) quota = [];
      quotaKey = key;
      refreshQuotaAfter = Date.now() + 6e4;
      const generation = ++quotaGeneration;
      const adapter = runtime.registry.get(options.agent);
      if (!adapter) return;
      try {
        const snapshots = await adapter.getQuota(options.model);
        if (closed || generation !== quotaGeneration) return;
        quota = snapshots;
        screen?.refresh();
      } catch {
      }
    };
    const quotaTimer = setInterval(() => void refreshQuota(), 6e4);
    quotaTimer.unref();
    const stopProgressBeforeInput = () => {
      if (!screen) view.stopProgress();
    };
    input.prependListener("keypress", stopProgressBeforeInput);
    const onScreenKey = (text, key) => {
      if (key?.name === "paste-start") pasting = true;
      if (key?.name === "paste-end") pasting = false;
      const mode = options.inputMode;
      if (mode && mode !== "system" && text && !pasting && !key?.ctrl && !key?.meta) {
        const composed = composeVietnamese(rl.line, rl.cursor, text, mode);
        if (composed) {
          rl.write(null, { name: "u", ctrl: true });
          rl.write(composed.line.slice(0, composed.cursor));
        }
      }
      if (key?.name === "pageup") screen?.scroll(1);
      else if (key?.name === "pagedown") screen?.scroll(-1);
      else screen?.refreshInput();
    };
    if (screen) input.on("keypress", onScreenKey);
    screen?.setComposer(() => {
      const [suggestions] = completeCommand(
        rl.line,
        runtime.registry.getAllAdapters().map((agent) => agent.id)
      );
      const selection = [options.agent, options.model ?? "mặc định", options.mode ?? "agent"].join(
        " · "
      );
      const hint = pendingPermission ? "Nhập y hoặc N" : busy ? "Đang xử lý · Ctrl+C dừng" : suggestions.length ? `Tab · ${suggestions.slice(0, 3).join("  ")}` : "/help · Tab · PgUp/PgDn";
      return {
        draft: rl.line,
        cursor: rl.cursor,
        prompt: unicode ? "❯ " : "> ",
        status: selection + (options.inputMode && options.inputMode !== "system" ? " · " + options.inputMode.toUpperCase() : "") + "   " + quotaLabel(options.agent, options.model, quota) + "   " + hint
      };
    });
    const prompt = () => {
      if (!closed && !busy) {
        void refreshQuota();
        syncTitle();
        if (screen) {
          screen.refresh();
          return;
        }
        view.footer(options.agent, options.model, quotaLabel(options.agent, options.model, quota));
        rl.setPrompt(view.prompt());
        rl.prompt();
      }
    };
    const askPermission = (title) => {
      if (closed) return Promise.resolve(false);
      view.permission(title);
      return new Promise((resolve) => {
        pendingPermission = resolve;
      });
    };
    const denyPending = () => {
      pendingPermission?.(false);
      pendingPermission = void 0;
    };
    const cancel = () => {
      denyPending();
      if (busy) {
        turnStopped = true;
        view.stopProgress();
        view.notice("Đang dừng…");
        void runtime.cancel().catch((error) => view.error(error.message));
      } else rl.close();
    };
    rl.on("SIGINT", cancel);
    if (options.ime) process.on("SIGINT", cancel);
    const handle = async (input2) => {
      const text = input2.trim();
      if (!text) return;
      if (text === "/exit" || text === "/quit") {
        rl.close();
        return;
      }
      if (text === "/help") line(HELP);
      else if (text === "/input") view.notice("Kiểu nhập: " + (options.inputMode ?? "system"));
      else if (text.startsWith("/input ")) {
        const mode = parseInputMode(text.slice(7).trim());
        if (!screen && mode !== "system")
          throw new Error("Hãy mở CodeFleet toàn màn hình để dùng bộ gõ tích hợp.");
        options.inputMode = mode;
        view.notice("Kiểu nhập: " + mode + (mode === "system" ? "" : " · Chọn ENG trong Windows"));
      } else if (text === "/mode") view.notice("Chế độ: " + (options.mode ?? "agent"));
      else if (text.startsWith("/mode ")) {
        options.mode = parseMode(text.slice(6).trim());
        view.notice("Chế độ: " + options.mode);
      } else if (text === "/team") view.notice("Cách dùng: /team <yêu cầu>");
      else if (text === "/agents") await showAgents();
      else if (text === "/models") await showModels();
      else if (text.startsWith("/models ")) await showModels(text.slice(8).trim());
      else if (text.startsWith("/agent ")) {
        const agent = text.slice(7).trim();
        if (agent !== "auto") runtime.registry.getAdapter(agent);
        options.agent = agent;
        options.model = void 0;
        if (screen) view.welcome(options);
        else await refreshQuota();
        view.notice(`Agent: ${agent}`);
      } else if (text.startsWith("/model ")) {
        options.model = text.slice(7).trim();
        if (screen) view.welcome(options);
        else await refreshQuota();
        view.notice(`Model: ${options.model}`);
      } else if (text === "/history") {
        for (const conv of runtime.conversations.listByProject(runtime.projectId))
          line(`${conv.id}  ${conv.title ?? "Hội thoại mới"}`);
      } else if (text === "/new") {
        runtime.newConversation();
        view.notice(`Hội thoại mới: ${runtime.conversationId}`);
      } else if (text === "/skill" || text === "/skills" || /^\/skills? /.test(text)) {
        await runSkillCommand(text.replace(/^\/skills?/, ""), {
          service: skills,
          currentAgent: options.agent,
          line,
          notice: view.notice,
          onChanged: () => runtime.resetSessions()
        });
      } else if (text.startsWith("/") && !text.startsWith("/team "))
        throw new Error("Lệnh không hợp lệ. Gõ /help.");
      else {
        const oneShotTeam = text.startsWith("/team ");
        const request = oneShotTeam ? text.slice(6).trim() : text;
        const startedAt = performance.now();
        let failed = false;
        view.beginTurn();
        try {
          await runtime.send(
            request,
            {
              message: view.message,
              permission: askPermission,
              status: view.status
            },
            oneShotTeam ? "subagent" : options.mode
          );
        } catch (error) {
          failed = true;
          if (!turnStopped) view.error(error instanceof Error ? error.message : String(error));
        } finally {
          view.endTurn(
            performance.now() - startedAt,
            turnStopped ? "stopped" : failed ? "error" : "done"
          );
        }
      }
    };
    rl.on("line", (input2) => {
      if (pendingPermission) {
        const resolve = pendingPermission;
        pendingPermission = void 0;
        resolve(/^(y|yes|có|co)$/i.test(input2.trim()));
        view.resumeProgress();
        return;
      }
      if (busy) {
        view.notice("Đang xử lý; Ctrl+C để dừng.");
        if (!turnStopped) view.resumeProgress();
        return;
      }
      busy = true;
      turnStopped = false;
      if (input2.trim()) screen?.submit(input2);
      task = handle(input2).catch((error) => view.error(error.message)).finally(() => {
        busy = false;
        prompt();
      });
    });
    await new Promise((resolve) => {
      rl.on("close", () => {
        closed = true;
        clearInterval(quotaTimer);
        input.off("keypress", stopProgressBeforeInput);
        input.off("keypress", onScreenKey);
        if (options.ime) process.off("SIGINT", cancel);
        if (mouseInput) {
          process.stdin.unpipe(mouseInput);
          process.stdin.pause();
          mouseInput.destroy();
        }
        view.stopProgress();
        denyPending();
        void runtime.cancel().finally(resolve);
      });
      if (screen) prompt();
      else void refreshQuota().then(prompt);
    });
    await task;
  } finally {
    screen?.close();
    if (savedTitle) process.stdout.write("\x1B[23;0t");
    runtime.close();
  }
}
void main().catch((error) => {
  process.stderr.write(`CodeFleet: ${terminalText(error.message)}
`);
  if (process.exitCode !== 130) process.exitCode = 1;
});
