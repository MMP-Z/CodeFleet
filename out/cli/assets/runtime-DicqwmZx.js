"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const node_child_process = require("node:child_process");
const zod = require("zod");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
let codexDesktopBinary;
function findCodexDesktop() {
  if (codexDesktopBinary && fs.existsSync(codexDesktopBinary)) return codexDesktopBinary;
  try {
    const installLocation = node_child_process.execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation"
      ],
      { encoding: "utf8", windowsHide: true, timeout: 4e3, stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (!path.isAbsolute(installLocation)) return;
    const binary = path.join(installLocation, "app", "resources", "codex.exe");
    if (fs.existsSync(binary)) {
      codexDesktopBinary = binary;
      return binary;
    }
  } catch {
  }
  return void 0;
}
function getCodexPathCandidates() {
  return (process.env.PATH ?? "").split(path.delimiter).map((entry) => entry.trim().replace(/^"|"$/g, "")).filter(
    (entry) => path.isAbsolute(entry) && !path.normalize(entry).split(path.sep).some((segment) => segment.toLowerCase() === ".sandbox-bin")
  ).flatMap(
    (entry) => process.platform === "win32" ? [path.join(entry, "codex.exe"), path.join(entry, "codex.cmd")] : [path.join(entry, "codex")]
  );
}
function getAgentBinaryCandidates(agentId) {
  const home = os.homedir();
  const isWin = process.platform === "win32";
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const exeSuffix = isWin ? ".exe" : "";
  const cmdSuffix = isWin ? ".cmd" : "";
  switch (agentId) {
    case "codex":
      return [
        // Keep Codex beside the helper binaries supplied by its installation.
        ...getCodexPathCandidates(),
        path.join(home, ".codex", "bin", `codex${exeSuffix}`),
        // 2. Local Programs directory
        path.join(localAppData, "Programs", "Codex", `codex${exeSuffix}`),
        // 3. npm global install
        path.join(appData, "npm", `codex${cmdSuffix}`),
        // 4. User local bin (macOS/Linux or winget/scoop)
        path.join(home, ".local", "bin", `codex${exeSuffix}`),
        // 5. Bare command on system PATH
        "codex"
      ];
    case "claude":
      return [
        // 1. Anthropic native installer (~/.local/bin/claude.exe)
        path.join(home, ".local", "bin", `claude${exeSuffix}`),
        // 2. Local Programs directory
        path.join(localAppData, "Programs", "Claude", `claude${exeSuffix}`),
        path.join(home, ".claude", "bin", `claude${exeSuffix}`),
        // 3. npm global install
        path.join(appData, "npm", `claude${cmdSuffix}`),
        path.join(localAppData, "AnthropicClaude", `claude${exeSuffix}`),
        // 4. Bare command on system PATH
        "claude"
      ];
    case "copilot": {
      const progFiles = process.env.ProgramFiles || "C:\\Program Files";
      return [
        // 1. GitHub Copilot CLI official MSI installer location (winget install GitHub.Copilot)
        path.join(localAppData, "GitHubCopilotCLI", `copilot${exeSuffix}`),
        path.join(progFiles, "GitHub Copilot", `copilot${exeSuffix}`),
        path.join(progFiles, "GitHub Copilot CLI", `copilot${exeSuffix}`),
        path.join(localAppData, "Programs", "GitHub Copilot", `copilot${exeSuffix}`),
        path.join(localAppData, "Programs", "GitHub Copilot CLI", `copilot${exeSuffix}`),
        path.join(localAppData, "Programs", "Copilot", `copilot${exeSuffix}`),
        // 2. npm global install
        path.join(appData, "npm", `copilot${cmdSuffix}`),
        // 3. GitHub CLI standard install location (winget install GitHub.cli / gh copilot)
        path.join(progFiles, "GitHub CLI", `gh${exeSuffix}`),
        path.join(localAppData, "Programs", "GitHub CLI", `gh${exeSuffix}`),
        path.join(home, ".local", "bin", `copilot${exeSuffix}`),
        path.join(home, ".local", "bin", `gh${exeSuffix}`),
        // 4. Bare command on system PATH
        "copilot",
        "gh"
      ];
    }
    case "agy":
      return [
        // 1. Antigravity CLI PowerShell installer standard directory
        path.join(localAppData, "agy", "bin", `agy${exeSuffix}`),
        // 2. Gemini/Antigravity user directory
        path.join(home, ".gemini", "bin", `agy${exeSuffix}`),
        path.join(home, ".gemini", "antigravity", "bin", `agy${exeSuffix}`),
        path.join(localAppData, "Programs", "Antigravity", "bin", `agy${exeSuffix}`),
        path.join(appData, "Antigravity", "bin", `agy${exeSuffix}`),
        // 3. User local bin (macOS/Linux or winget/scoop)
        path.join(home, ".local", "bin", `agy${exeSuffix}`),
        // 4. Bare command on system PATH
        "agy"
      ];
    default:
      return [agentId];
  }
}
function isGitHubCli(binary) {
  return /^gh(?:\.exe|\.cmd)?$/i.test(path.basename(binary));
}
function resolveAgentBinary(agentId) {
  const candidates = getAgentBinaryCandidates(agentId);
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes("/")) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
      }
    }
  }
  if (agentId === "codex" && process.platform === "win32") {
    return findCodexDesktop() ?? agentId;
  }
  return agentId;
}
function getCommandExecutionOptions(binary) {
  if (process.platform !== "win32") {
    return { shell: false };
  }
  if (/\.(cmd|bat)$/i.test(binary)) {
    return { shell: true };
  }
  if (binary.includes("\\") || binary.includes("/")) {
    return { shell: false };
  }
  return { shell: true };
}
async function stopAgentProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      node_child_process.execFile(
        "taskkill.exe",
        ["/pid", String(child.pid), "/t", "/f"],
        { windowsHide: true },
        () => resolve()
      );
    });
  } else child.kill("SIGTERM");
}
class PathViolationError extends Error {
  projectRoot;
  attemptedPath;
  constructor(projectRoot, attemptedPath, detail) {
    super(`Vi phạm Luật B4: Chặn truy cập ngoài thư mục dự án (${attemptedPath}) — ${detail}`);
    this.name = "PathViolationError";
    this.projectRoot = projectRoot;
    this.attemptedPath = attemptedPath;
  }
}
function resolveRealWithNonExistentTail(targetPath) {
  const absoluteTarget = path.resolve(targetPath);
  const tailSegments = [];
  let cursor = absoluteTarget;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    tailSegments.unshift(path.basename(cursor));
    cursor = parent;
  }
  const realExisting = fs.existsSync(cursor) ? fs.realpathSync(cursor) : cursor;
  return tailSegments.length > 0 ? path.join(realExisting, ...tailSegments) : realExisting;
}
function isSubPath(realRoot, realTarget) {
  const normalizedRoot = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
  const normalizedTarget = process.platform === "win32" ? realTarget.toLowerCase() : realTarget;
  const rel = path.relative(normalizedRoot, normalizedTarget);
  if (rel === "") {
    return true;
  }
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}
function assertPathInsideProject(projectRoot, candidatePath) {
  if (!candidatePath || candidatePath.trim() === "" || candidatePath.includes("\0")) {
    throw new PathViolationError(projectRoot, candidatePath, "Đường dẫn rỗng hoặc chứa ký tự null");
  }
  const realRoot = resolveRealWithNonExistentTail(projectRoot);
  const resolvedCandidate = path.resolve(realRoot, candidatePath);
  const realCandidate = resolveRealWithNonExistentTail(resolvedCandidate);
  if (!isSubPath(realRoot, realCandidate)) {
    throw new PathViolationError(
      realRoot,
      candidatePath,
      "Đường dẫn vượt ra ngoài phạm vi thư mục dự án"
    );
  }
  if (fs.existsSync(resolvedCandidate)) {
    const realExistingTarget = fs.realpathSync(resolvedCandidate);
    if (!isSubPath(realRoot, realExistingTarget)) {
      throw new PathViolationError(realRoot, candidatePath, "Symlink trỏ ra ngoài thư mục dự án");
    }
  }
  return realCandidate;
}
function writeProjectFileSafe(projectRoot, relativeOrAbsolutePath, content) {
  const safeTarget = assertPathInsideProject(projectRoot, relativeOrAbsolutePath);
  fs.mkdirSync(path.dirname(safeTarget), { recursive: true });
  fs.writeFileSync(safeTarget, content, "utf8");
  return safeTarget;
}
const ClaudeStatuslineSchema = zod.z.object({
  rate_limits: zod.z.object({
    five_hour: zod.z.object({
      used_percentage: zod.z.number(),
      resets_at: zod.z.number()
    }).optional(),
    seven_day: zod.z.object({
      used_percentage: zod.z.number(),
      resets_at: zod.z.number()
    }).optional()
  }).nullable().optional()
});
const defaultCommandRunner = (cmd, args, options) => {
  return new Promise((resolve) => {
    try {
      const execOpts = getCommandExecutionOptions(cmd);
      const child = node_child_process.spawn(cmd, args, {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        shell: execOpts.shell
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        resolve({ stdout, stderr, code: code ?? 0 });
      });
      child.on("error", (err) => {
        resolve({ stdout: "", stderr: err.message, code: 127 });
      });
    } catch (err) {
      resolve({
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        code: 127
      });
    }
  });
};
async function fetchClaudeOAuthUsage() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const credentials = JSON.parse(
    await fs.promises.readFile(path.join(configDir, ".credentials.json"), "utf8")
  );
  const oauth = credentials.claudeAiOauth;
  if (typeof oauth?.accessToken !== "string" || !oauth.accessToken) return null;
  if (typeof oauth.expiresAt === "number" && oauth.expiresAt <= Date.now()) return null;
  const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      Authorization: `Bearer ${oauth.accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) return null;
  return response.json();
}
class ClaudeAdapter {
  constructor(modelsService, sessionRepo, runner = defaultCommandRunner, customQuotaResolver, usageFetcher = fetchClaudeOAuthUsage) {
    this.modelsService = modelsService;
    this.sessionRepo = sessionRepo;
    this.runner = runner;
    this.customQuotaResolver = customQuotaResolver;
    this.usageFetcher = usageFetcher;
    const config = this.modelsService.getAgentCatalogConfig("claude");
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName("claude");
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand("claude");
    this.loginCommand = config.loginCommand;
  }
  id = "claude";
  displayName;
  shortName;
  logoLetter;
  color;
  darkColor;
  docsUrl;
  installCommand;
  loginCommand;
  async detect() {
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ["--version"]);
    if (res.code !== 0) {
      return {
        agentId: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        logoLetter: this.logoLetter,
        color: this.color,
        darkColor: this.darkColor,
        docsUrl: this.docsUrl,
        installCommand: this.installCommand,
        loginCommand: this.loginCommand,
        installed: false,
        version: null,
        loggedIn: false,
        status: "not_installed",
        errorDetail: res.stderr || null,
        modelsCount: 0
      };
    }
    const versionMatch = res.stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1] : res.stdout.trim() || "unknown";
    const authRes = await this.runner(binary, ["auth", "status"]);
    let authenticated = null;
    try {
      const parsed = zod.z.object({ loggedIn: zod.z.boolean() }).safeParse(JSON.parse(authRes.stdout));
      if (parsed.success) authenticated = parsed.data.loggedIn;
    } catch {
    }
    const status = authenticated === null ? "error" : authenticated ? "ready" : "not_logged_in";
    const models = await this.listModels();
    return {
      agentId: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      logoLetter: this.logoLetter,
      color: this.color,
      darkColor: this.darkColor,
      docsUrl: this.docsUrl,
      installCommand: this.installCommand,
      loginCommand: this.loginCommand,
      installed: true,
      version,
      loggedIn: authenticated === true,
      status,
      errorDetail: status === "error" ? "Không xác minh được trạng thái đăng nhập Claude Code." : null,
      modelsCount: models.length
    };
  }
  async listModels() {
    const defaults = this.modelsService.getCatalogDefaultModels(this.id);
    return this.modelsService.syncAgentModels(this.id, defaults);
  }
  parseQuotaTierA(rawJson) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const parsed = ClaudeStatuslineSchema.parse(JSON.parse(rawJson));
      if (!parsed.rate_limits) {
        return {
          agentId: this.id,
          model: null,
          scope: "shared",
          windows: [],
          status: "unknown",
          source: "unknown",
          updatedAt: now
        };
      }
      const windows = [];
      if (parsed.rate_limits.five_hour) {
        windows.push({
          label: "5 giờ",
          usedPercent: parsed.rate_limits.five_hour.used_percentage,
          resetsAt: new Date(parsed.rate_limits.five_hour.resets_at * 1e3).toISOString()
        });
      }
      if (parsed.rate_limits.seven_day) {
        windows.push({
          label: "Tuần",
          usedPercent: parsed.rate_limits.seven_day.used_percentage,
          resetsAt: new Date(parsed.rate_limits.seven_day.resets_at * 1e3).toISOString()
        });
      }
      const maxPct = Math.max(...windows.map((w) => w.usedPercent ?? 0), 0);
      const status = maxPct >= 100 ? "exhausted" : maxPct >= 80 ? "low" : "ok";
      return {
        agentId: this.id,
        model: null,
        scope: "shared",
        windows,
        status,
        source: "official",
        updatedAt: now
      };
    } catch {
      return {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: now
      };
    }
  }
  /** Parse the plan usage reply used by Claude Code's own `/usage` view. */
  parseOAuthUsage(raw) {
    if (!raw || typeof raw !== "object") return null;
    const data = raw;
    const windows = [];
    for (const [key, label] of [
      ["five_hour", "5 giờ"],
      ["seven_day", "Tuần"]
    ]) {
      const window = data[key];
      if (!window || typeof window.utilization !== "number") continue;
      const reset = typeof window.resets_at === "string" ? Date.parse(window.resets_at) : typeof window.resets_at === "number" ? window.resets_at > 1e11 ? window.resets_at : window.resets_at * 1e3 : NaN;
      windows.push({
        label,
        usedPercent: Math.max(0, Math.min(100, window.utilization)),
        resetsAt: Number.isFinite(reset) ? new Date(reset).toISOString() : null
      });
    }
    if (!windows.length) return null;
    const used = Math.max(...windows.map((window) => window.usedPercent));
    return {
      agentId: this.id,
      model: null,
      scope: "shared",
      windows,
      status: used >= 100 ? "exhausted" : used >= 80 ? "low" : "ok",
      source: "official",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async getQuota() {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.parseQuotaTierA(raw)];
      }
    }
    try {
      const official = this.parseOAuthUsage(await this.usageFetcher());
      if (official) return [official];
    } catch {
    }
    return [
      {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
  }
  async startSession(opts) {
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId
    });
    return new ClaudeSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      binary,
      opts.readOnly
    );
  }
}
class ClaudeSessionInstance {
  constructor(id, cwd, model, externalSessionId, sessionRepo, binary = "claude", readOnly = false) {
    this.sessionRepo = sessionRepo;
    this.readOnly = readOnly;
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
    this.binary = binary;
  }
  id;
  agentId = "claude";
  cwd;
  model;
  child = null;
  externalSessionId;
  binary;
  getExternalSessionId() {
    return this.externalSessionId;
  }
  async send(prompt, onEvent, mockStreamLines) {
    if (mockStreamLines) {
      this.processNdjsonLines(mockStreamLines, onEvent);
      return;
    }
    const args = ["--print", "--output-format", "stream-json", "--verbose"];
    if (this.readOnly) args.push("--tools", "Read,Glob,Grep", "--disallowedTools", "mcp__*");
    if (this.model) {
      args.push("--model", this.model);
    }
    if (this.externalSessionId) {
      args.push("--resume", this.externalSessionId);
    }
    const execOpts = getCommandExecutionOptions(this.binary);
    return new Promise((resolve, reject) => {
      const child = node_child_process.spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell
      });
      this.child = child;
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(prompt);
      let buffer = "";
      child.stdout?.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        this.processNdjsonLines(lines, onEvent);
      });
      child.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.includes("429") || text.toLowerCase().includes("rate limit")) {
          onEvent({ type: "rate_limit", model: this.model ?? void 0 });
        }
      });
      child.on("close", (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent);
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  }
  processNdjsonLines(lines, onEvent) {
    for (const line of lines) {
      if (!line.trim()) continue;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (evt.type === "system" && typeof evt.session_id === "string") {
        this.externalSessionId = evt.session_id;
        this.sessionRepo.updateExternalId(this.id, evt.session_id);
      } else if (evt.type === "assistant" && evt.message && typeof evt.message === "object" && Array.isArray(evt.message.content)) {
        const content = evt.message.content;
        for (const rawItem of content) {
          const item = rawItem;
          if (item.type === "text" && typeof item.text === "string") {
            onEvent({ type: "message", text: item.text });
          } else if (item.type === "tool_use") {
            onEvent({
              type: "tool_call",
              id: item.id ?? `tool_${Date.now()}`,
              kind: item.name ?? "tool",
              title: `${item.name}: ${item.input?.file_path ?? ""}`,
              status: "executing"
            });
            if (item.name === "Write" || item.name === "Edit") {
              const targetRel = item.input?.file_path;
              if (targetRel) {
                const safePath = assertPathInsideProject(this.cwd, targetRel);
                if (item.input?.content !== void 0) {
                  writeProjectFileSafe(this.cwd, targetRel, item.input.content);
                }
                onEvent({
                  type: "file_change",
                  path: path.relative(this.cwd, safePath).replace(/\\/g, "/")
                });
              }
            }
          }
        }
      } else if (evt.type === "result") {
        if (evt.is_error) {
          const errMsg = typeof evt.result === "string" ? evt.result : "Claude reported an error";
          if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit")) {
            onEvent({ type: "rate_limit", model: this.model ?? void 0 });
          } else {
            onEvent({ type: "error", message: errMsg });
          }
        } else {
          const usage = evt.usage;
          onEvent({
            type: "done",
            externalSessionId: this.externalSessionId ?? (typeof evt.session_id === "string" ? evt.session_id : void 0),
            usage: usage ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0
            } : void 0
          });
        }
      }
    }
  }
  async respondPermission() {
  }
  async cancel() {
    await stopAgentProcess(this.child);
  }
}
const TOKEN_PATTERNS = [
  // Header Authorization: Bearer ...
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
  // Anthropic API / OAuth keys
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  // OpenAI API keys
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/g,
  // Google / Gemini API keys
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  // GitHub tokens
  /\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})/g,
  // Cặp key=value hoặc "key": "value" nhạy cảm trong chuỗi
  /\b((?:api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|password|authorization)\s*[:=]\s*["']?)([^\s"',;}\]]+)/gi,
  // Biến môi trường kiểu .env (OPENAI_API_KEY=..., ANTHROPIC_AUTH_TOKEN=...)
  /\b([A-Z0-9_]*(?:API_KEY|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)([^\r\n]+)/g
];
const REDACTED_PLACEHOLDER = "[REDACTED]";
function redactSensitiveText(input) {
  let result = input;
  result = result.replace(TOKEN_PATTERNS[0], `$1${REDACTED_PLACEHOLDER}`);
  result = result.replace(TOKEN_PATTERNS[1], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[2], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[3], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[4], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[5], `$1${REDACTED_PLACEHOLDER}`);
  result = result.replace(TOKEN_PATTERNS[6], `$1${REDACTED_PLACEHOLDER}`);
  return result;
}
class CodexAdapter {
  constructor(modelsService, sessionRepo, runner = defaultCommandRunner, customQuotaResolver) {
    this.modelsService = modelsService;
    this.sessionRepo = sessionRepo;
    this.runner = runner;
    this.customQuotaResolver = customQuotaResolver;
    const config = this.modelsService.getAgentCatalogConfig("codex");
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName("codex");
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand("codex");
    this.loginCommand = config.loginCommand;
  }
  id = "codex";
  displayName;
  shortName;
  logoLetter;
  color;
  darkColor;
  docsUrl;
  installCommand;
  loginCommand;
  async detect() {
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ["--version"]);
    if (res.code !== 0) {
      return {
        agentId: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        logoLetter: this.logoLetter,
        color: this.color,
        darkColor: this.darkColor,
        docsUrl: this.docsUrl,
        installCommand: this.installCommand,
        loginCommand: this.loginCommand,
        installed: false,
        version: null,
        loggedIn: false,
        status: "not_installed",
        errorDetail: res.stderr || null,
        modelsCount: 0
      };
    }
    const versionMatch = res.stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1] : res.stdout.trim() || "unknown";
    let loggedIn = false;
    let status = "not_logged_in";
    const authRes = await this.runner(binary, ["login", "status"]);
    const combinedAuthOutput = `${authRes.stdout} ${authRes.stderr}`.toLowerCase();
    if (authRes.code === 0 && (combinedAuthOutput.includes("logged in") || combinedAuthOutput.includes("chatgpt") || combinedAuthOutput.includes("api key"))) {
      loggedIn = true;
      status = "ready";
    } else {
      try {
        const authPath = path.join(os.homedir(), ".codex", "auth.json");
        if (fs.existsSync(authPath)) {
          const authData = JSON.parse(fs.readFileSync(authPath, "utf8"));
          if (authData.tokens || authData.OPENAI_API_KEY) {
            loggedIn = true;
            status = "ready";
          }
        }
      } catch {
      }
    }
    const models = await this.listModels();
    return {
      agentId: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      logoLetter: this.logoLetter,
      color: this.color,
      darkColor: this.darkColor,
      docsUrl: this.docsUrl,
      installCommand: this.installCommand,
      loginCommand: this.loginCommand,
      installed: true,
      version,
      loggedIn,
      status,
      errorDetail: null,
      modelsCount: models.length
    };
  }
  async listModels(customCachePath) {
    const discovered = [];
    try {
      const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
      const cachePath = customCachePath || path.join(codexHome, "models_cache.json");
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.models)) {
          for (const m of parsed.models) {
            if (m.slug && m.visibility !== "hide") {
              discovered.push({
                id: m.slug,
                label: m.display_name || m.slug
              });
            }
          }
        }
      }
    } catch {
    }
    if (discovered.length === 0) {
      const defaults = this.modelsService.getCatalogDefaultModels(this.id);
      return this.modelsService.syncAgentModels(this.id, defaults);
    }
    return this.modelsService.syncAgentModels(this.id, discovered);
  }
  estimateQuotaTierB(jsonlText, fiveHourTokenCap = 14e4, lowThreshold = 80) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      let totalTokens = 0;
      for (const line of jsonlText.trim().split(/\r?\n/)) {
        if (!line) continue;
        const evt = JSON.parse(line);
        if (evt.type === "turn.completed" && evt.usage) {
          totalTokens += (evt.usage.input_tokens || 0) + (evt.usage.output_tokens || 0);
        }
      }
      const usedPercent = Math.min(100, Math.round(totalTokens / fiveHourTokenCap * 100));
      const status = usedPercent >= 100 ? "exhausted" : usedPercent >= lowThreshold ? "low" : "ok";
      return {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [{ label: "5 giờ", usedPercent, resetsAt: null }],
        status,
        source: "estimated",
        updatedAt: now
      };
    } catch {
      return {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: now
      };
    }
  }
  /**
   * Codex ghi `rate_limits` chính thức (giống `/status`) vào rollout log sau mỗi lượt.
   * Đọc thụ động bản ghi mới nhất, không gửi prompt nào.
   */
  readSessionRateLimits(sessionsDir = path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "sessions"
  )) {
    for (const file of this.recentRolloutFiles(sessionsDir)) {
      const snapshot = this.parseRateLimitsFromLog(this.readTail(file));
      if (snapshot) return snapshot;
    }
    return null;
  }
  parseRateLimitsFromLog(text, now = Date.now()) {
    const lines = text.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index];
      if (!line.includes('"rate_limits"')) continue;
      try {
        const item = JSON.parse(line);
        const limits = item.payload?.rate_limits ?? item.rate_limits;
        if (!limits || typeof limits !== "object") continue;
        const loggedAt = item.timestamp ? Date.parse(item.timestamp) : NaN;
        const windows = [];
        for (const key of ["primary", "secondary"]) {
          const window = limits[key];
          if (!window || typeof window.used_percent !== "number") continue;
          const minutes = typeof window.window_minutes === "number" ? window.window_minutes : null;
          let reset = null;
          if (typeof window.resets_at === "number") {
            reset = window.resets_at > 1e11 ? window.resets_at : window.resets_at * 1e3;
          } else if (typeof window.resets_in_seconds === "number" && Number.isFinite(loggedAt)) {
            reset = loggedAt + window.resets_in_seconds * 1e3;
          }
          const expired = reset !== null && reset <= now;
          windows.push({
            label: minutes === 300 ? "5 giờ" : minutes === 10080 ? "Tuần" : minutes ? `${minutes} phút` : key === "primary" ? "5 giờ" : "Tuần",
            usedPercent: expired ? 0 : Math.max(0, Math.min(100, window.used_percent)),
            resetsAt: expired || reset === null ? null : new Date(reset).toISOString()
          });
        }
        if (!windows.length) continue;
        const used = Math.max(...windows.map((window) => window.usedPercent));
        return {
          agentId: this.id,
          model: null,
          scope: "shared",
          windows,
          status: used >= 100 ? "exhausted" : used >= 80 ? "low" : "ok",
          source: "official",
          updatedAt: Number.isFinite(loggedAt) ? new Date(loggedAt).toISOString() : new Date(now).toISOString()
        };
      } catch {
      }
    }
    return null;
  }
  recentRolloutFiles(sessionsDir, limit = 5) {
    const files = [];
    const descendingDirs = (dir) => {
      try {
        return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
      } catch {
        return [];
      }
    };
    outer: for (const year of descendingDirs(sessionsDir)) {
      for (const month of descendingDirs(path.join(sessionsDir, year))) {
        for (const day of descendingDirs(path.join(sessionsDir, year, month))) {
          const dayDir = path.join(sessionsDir, year, month, day);
          try {
            for (const name of fs.readdirSync(dayDir)) {
              if (!name.endsWith(".jsonl")) continue;
              const file = path.join(dayDir, name);
              files.push({ file, mtime: fs.statSync(file).mtimeMs });
            }
          } catch {
          }
          if (files.length >= limit) break outer;
        }
      }
    }
    return files.sort((a, b) => b.mtime - a.mtime).slice(0, limit).map((item) => item.file);
  }
  readTail(file, bytes = 512 * 1024) {
    let fd = null;
    try {
      fd = fs.openSync(file, "r");
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, bytes);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      return buffer.toString("utf8");
    } catch {
      return "";
    } finally {
      if (fd !== null) fs.closeSync(fd);
    }
  }
  async getQuota() {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.estimateQuotaTierB(raw)];
      }
    }
    const official = this.readSessionRateLimits();
    if (official) return [official];
    return [
      {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
  }
  async startSession(opts) {
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId
    });
    return new CodexSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      binary,
      opts.allowNonGitWorkspace,
      opts.readOnly,
      opts.codexSandbox
    );
  }
}
class CodexSessionInstance {
  constructor(id, cwd, model, externalSessionId, sessionRepo, binary = "codex", allowNonGitWorkspace = false, readOnly = false, sandbox) {
    this.sessionRepo = sessionRepo;
    this.allowNonGitWorkspace = allowNonGitWorkspace;
    this.readOnly = readOnly;
    this.sandbox = sandbox;
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
    this.binary = binary;
  }
  id;
  agentId = "codex";
  cwd;
  model;
  child = null;
  externalSessionId;
  binary;
  getExternalSessionId() {
    return this.externalSessionId;
  }
  async send(prompt, onEvent, mockStreamLines) {
    if (mockStreamLines) {
      this.processNdjsonLines(mockStreamLines, onEvent);
      return;
    }
    const args = this.externalSessionId ? ["exec", "resume", "--json"] : ["exec", "--json"];
    if (this.allowNonGitWorkspace) {
      args.push("--skip-git-repo-check");
    }
    const sandbox = this.readOnly ? "read-only" : this.sandbox;
    if (sandbox) args.unshift("-c", `sandbox_mode="${sandbox}"`);
    if (this.model) {
      args.push("--model", this.model);
    }
    if (this.externalSessionId) args.push(this.externalSessionId);
    args.push("-");
    const execOpts = getCommandExecutionOptions(this.binary);
    return new Promise((resolve, reject) => {
      const child = node_child_process.spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell
      });
      this.child = child;
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(prompt);
      let buffer = "";
      child.stdout?.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        this.processNdjsonLines(lines, onEvent);
      });
      let stderr = "";
      child.stderr?.setEncoding("utf8").on("data", (text) => {
        stderr = (stderr + text).slice(-8192);
        if (text.includes("429") || text.toLowerCase().includes("rate limit")) {
          onEvent({ type: "rate_limit", model: this.model ?? void 0 });
        }
      });
      child.on("close", (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent);
        }
        if (code === 0) {
          resolve();
        } else {
          const detail = redactSensitiveText(stderr).split(/\r?\n/).map((line) => line.trim()).filter(
            (line) => line && !/^Reading (?:additional input|prompt) from stdin\.{3}$/i.test(line)
          ).slice(-5).join("\n");
          reject(new Error(detail || `Codex process exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  }
  processNdjsonLines(lines, onEvent) {
    for (const line of lines) {
      if (!line.trim()) continue;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (evt.type === "thread.started" && typeof evt.thread_id === "string") {
        this.externalSessionId = evt.thread_id;
        this.sessionRepo.updateExternalId(this.id, evt.thread_id);
      } else if (evt.type === "item.completed" && evt.item && typeof evt.item === "object") {
        const item = evt.item;
        if (item.type === "agent_message" && typeof item.text === "string") {
          onEvent({ type: "message", text: item.text });
        } else if (item.type === "file_change" && Array.isArray(item.changes)) {
          for (const ch of item.changes) {
            if (ch.path) {
              const safePath = assertPathInsideProject(this.cwd, ch.path);
              onEvent({
                type: "file_change",
                path: path.relative(this.cwd, safePath).replace(/\\/g, "/")
              });
            }
          }
        }
      } else if (evt.type === "turn.completed") {
        const usage = evt.usage;
        onEvent({
          type: "done",
          externalSessionId: this.externalSessionId ?? void 0,
          usage: usage ? {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0
          } : void 0
        });
      } else if (evt.type === "error") {
        const errMsg = typeof evt.message === "string" ? redactSensitiveText(evt.message) : "Codex reported an error";
        if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit")) {
          onEvent({ type: "rate_limit", model: this.model ?? void 0 });
        } else {
          onEvent({ type: "error", message: errMsg });
        }
      }
    }
  }
  async respondPermission() {
  }
  async cancel() {
    await stopAgentProcess(this.child);
  }
}
function copilotRpc(binary, method, timeoutMs = 8e3) {
  return new Promise((resolve) => {
    const { shell } = getCommandExecutionOptions(binary);
    const child = node_child_process.spawn(binary, ["--headless", "--stdio", "--no-auto-update"], {
      shell,
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"]
    });
    let settled = false;
    let buffer = Buffer.alloc(0);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      if (shell) void stopAgentProcess(child);
      else child.kill();
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);
    child.once("error", () => finish(null));
    child.once("close", () => finish(null));
    child.stdin.once("error", () => finish(null));
    child.stdout.on("data", (chunk) => {
      if (settled) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 262144) return finish(null);
      let boundary = buffer.indexOf("\r\n\r\n");
      while (boundary !== -1) {
        const length = Number(
          buffer.subarray(0, boundary).toString().match(/Content-Length:\s*(\d+)/i)?.[1]
        );
        if (!Number.isSafeInteger(length) || length <= 0 || length > 262144) return finish(null);
        const start = boundary + 4;
        if (buffer.length < start + length) return;
        try {
          const reply = JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
          if (reply.id === 1) return finish(reply.result ?? null);
        } catch {
          return finish(null);
        }
        buffer = buffer.subarray(start + length);
        boundary = buffer.indexOf("\r\n\r\n");
      }
    });
    const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} });
    child.stdin.write(`Content-Length: ${Buffer.byteLength(request)}\r
\r
${request}`);
  });
}
async function getCopilotAuthStatus(binary) {
  const result = await copilotRpc(binary, "auth.getStatus");
  const authenticated = result?.isAuthenticated;
  return typeof authenticated === "boolean" ? authenticated : null;
}
function getCopilotQuota(binary) {
  return copilotRpc(binary, "account.getQuota", 2e4);
}
function copilotExecutable(binary) {
  if (process.platform !== "win32" || !/\.cmd$/i.test(binary)) {
    return { command: binary, prefix: [] };
  }
  const packageDir = path.join(path.dirname(binary), "node_modules", "@github", "copilot");
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.copilot;
    if (typeof entry === "string") {
      return {
        command: process.versions.electron ? "node" : process.execPath,
        prefix: [path.resolve(packageDir, entry)]
      };
    }
  } catch {
  }
  throw new Error(
    "Không tìm thấy chương trình Copilot phía sau launcher npm. Kiểm tra lại bản cài Copilot CLI."
  );
}
class CopilotAdapter {
  constructor(modelsService, sessionRepo, runner = defaultCommandRunner, customQuotaResolver, quotaFetcher = getCopilotQuota) {
    this.modelsService = modelsService;
    this.sessionRepo = sessionRepo;
    this.runner = runner;
    this.customQuotaResolver = customQuotaResolver;
    this.quotaFetcher = quotaFetcher;
    const config = this.modelsService.getAgentCatalogConfig("copilot");
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName("copilot");
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand("copilot");
    this.loginCommand = config.loginCommand;
  }
  id = "copilot";
  displayName;
  shortName;
  logoLetter;
  color;
  darkColor;
  docsUrl;
  installCommand;
  loginCommand;
  lastRateLimitSnapshot = null;
  async detect() {
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ["--version"]);
    if (res.code !== 0) {
      return {
        agentId: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        logoLetter: this.logoLetter,
        color: this.color,
        darkColor: this.darkColor,
        docsUrl: this.docsUrl,
        installCommand: this.installCommand,
        loginCommand: this.loginCommand,
        installed: false,
        version: null,
        loggedIn: false,
        status: "not_installed",
        errorDetail: res.stderr || null,
        modelsCount: 0
      };
    }
    const versionMatch = res.stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1] : res.stdout.trim() || "unknown";
    const usesGitHubCli = isGitHubCli(binary);
    const authenticated = usesGitHubCli ? (await this.runner(binary, ["auth", "status"])).code === 0 : await getCopilotAuthStatus(binary);
    const status = authenticated === null ? "error" : authenticated ? "ready" : "not_logged_in";
    const models = await this.listModels();
    return {
      agentId: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      logoLetter: this.logoLetter,
      color: this.color,
      darkColor: this.darkColor,
      docsUrl: this.docsUrl,
      installCommand: this.installCommand,
      loginCommand: usesGitHubCli ? "gh auth login" : this.loginCommand,
      installed: true,
      version,
      loggedIn: authenticated === true,
      status,
      errorDetail: status === "error" ? "Không xác minh được trạng thái đăng nhập Copilot." : null,
      modelsCount: models.length
    };
  }
  async listModels() {
    const defaults = this.modelsService.getCatalogDefaultModels(this.id);
    return this.modelsService.syncAgentModels(this.id, defaults);
  }
  parseRateLimitTierC(rawJson) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const obj = JSON.parse(rawJson);
      const msg = obj?.error?.message ?? (typeof obj === "string" ? obj : "");
      const modelMatch = msg.match(/model '([^']+)'/) || [null, obj?.error?.data?.model ?? null];
      const model = modelMatch[1] ?? null;
      const snap = {
        agentId: this.id,
        model,
        scope: model ? "model" : "shared",
        windows: [{ label: "Phút", usedPercent: 100, resetsAt: null }],
        status: "exhausted",
        source: "detected",
        updatedAt: now
      };
      this.lastRateLimitSnapshot = snap;
      return snap;
    } catch {
      return {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: now
      };
    }
  }
  /** Convert Copilot's `account.getQuota` reply (monthly premium requests) to a snapshot. */
  parseAccountQuota(result) {
    const snapshots = result?.quotaSnapshots;
    const premium = snapshots?.premium_interactions;
    if (!premium || typeof premium !== "object") return null;
    let usedPercent = null;
    if (premium.isUnlimitedEntitlement === true) usedPercent = 0;
    else if (typeof premium.remainingPercentage === "number")
      usedPercent = 100 - premium.remainingPercentage;
    else if (typeof premium.usedRequests === "number" && typeof premium.entitlementRequests === "number" && premium.entitlementRequests > 0)
      usedPercent = premium.usedRequests / premium.entitlementRequests * 100;
    if (usedPercent === null || !Number.isFinite(usedPercent)) return null;
    usedPercent = Math.max(0, Math.min(100, Math.round(usedPercent * 10) / 10));
    const reset = typeof premium.resetDate === "string" ? Date.parse(premium.resetDate) : NaN;
    const label = typeof premium.usedRequests === "number" && typeof premium.entitlementRequests === "number" && premium.entitlementRequests > 0 ? `Tháng (${premium.usedRequests}/${premium.entitlementRequests})` : "Tháng";
    return {
      agentId: this.id,
      model: null,
      scope: "shared",
      windows: [
        {
          label,
          usedPercent,
          // Copilot sometimes reports the fetch time instead of the real reset date.
          resetsAt: Number.isFinite(reset) && reset > Date.now() ? new Date(reset).toISOString() : null
        }
      ],
      status: usedPercent >= 100 ? "exhausted" : usedPercent >= 80 ? "low" : "ok",
      source: "official",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async getQuota() {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.parseRateLimitTierC(raw)];
      }
    }
    const binary = resolveAgentBinary(this.id);
    if (!isGitHubCli(binary)) {
      const official = this.parseAccountQuota(await this.quotaFetcher(binary));
      if (official) return [official];
    }
    if (this.lastRateLimitSnapshot) {
      return [this.lastRateLimitSnapshot];
    }
    return [
      {
        agentId: this.id,
        model: null,
        scope: "shared",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
  }
  async startSession(opts) {
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId
    });
    return new CopilotSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      this,
      binary,
      opts.readOnly
    );
  }
}
class CopilotSessionInstance {
  constructor(id, cwd, model, externalSessionId, sessionRepo, adapter, binary = "copilot", readOnly = false) {
    this.sessionRepo = sessionRepo;
    this.adapter = adapter;
    this.readOnly = readOnly;
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
    this.binary = binary;
  }
  id;
  agentId = "copilot";
  cwd;
  model;
  child = null;
  externalSessionId;
  binary;
  getExternalSessionId() {
    return this.externalSessionId;
  }
  async send(prompt, onEvent, mockStreamLines) {
    if (mockStreamLines) {
      this.processNdjsonLines(mockStreamLines, onEvent);
      return;
    }
    const legacy = isGitHubCli(this.binary);
    const { command, prefix } = legacy ? { command: this.binary, prefix: [] } : copilotExecutable(this.binary);
    const args = legacy ? ["copilot", "explain", "--", prompt] : ["--output-format", "json", "--stream", "on", "--no-auto-update"];
    if (!legacy) {
      if (this.readOnly) args.push("--available-tools=view,grep,glob");
      if (this.model) args.push("--model", this.model);
      if (this.externalSessionId) args.push("--resume", this.externalSessionId);
      args.push("--prompt=" + prompt);
    }
    return new Promise((resolve, reject) => {
      const child = node_child_process.spawn(command, [...prefix, ...args], {
        cwd: this.cwd,
        windowsHide: true
      });
      this.child = child;
      child.stdin?.on("error", () => {
      });
      child.stdin?.end();
      let buffer = "";
      let stderr = "";
      const streamedMessages = /* @__PURE__ */ new Set();
      child.stdout?.setEncoding("utf8").on("data", (chunk) => {
        if (legacy) {
          onEvent({ type: "message", text: chunk });
          return;
        }
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        this.processNdjsonLines(lines, onEvent, streamedMessages);
      });
      child.stderr?.setEncoding("utf8").on("data", (text) => {
        stderr = (stderr + text).slice(-8192);
        if (text.includes("429") || text.toLowerCase().includes("rate limit")) {
          this.adapter.parseRateLimitTierC(text);
          onEvent({ type: "rate_limit", model: this.model ?? void 0 });
        }
      });
      child.on("close", (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent, streamedMessages);
        }
        if (code === 0) {
          if (legacy) onEvent({ type: "done" });
          resolve();
        } else {
          const detail = redactSensitiveText(stderr).trim().split(/\r?\n/).slice(-6).join("\n");
          reject(new Error(detail || `Copilot process exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  }
  processNdjsonLines(lines, onEvent, streamedMessages = /* @__PURE__ */ new Set()) {
    for (const line of lines) {
      if (!line.trim()) continue;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        onEvent({ type: "message", text: line });
        continue;
      }
      if (!evt || typeof evt !== "object") continue;
      const data = evt.data;
      const sessionId = evt.type === "session.start" ? data?.sessionId : evt.session_id;
      if ((evt.type === "init" || evt.type === "session.start") && typeof sessionId === "string") {
        this.externalSessionId = sessionId;
        this.sessionRepo.updateExternalId(this.id, sessionId);
      } else if (evt.type === "assistant.message_delta" && typeof data?.deltaContent === "string") {
        if (typeof data.messageId === "string") streamedMessages.add(data.messageId);
        onEvent({ type: "message", text: data.deltaContent });
      } else if (evt.type === "assistant.message" && typeof data?.content === "string") {
        if (typeof data.messageId !== "string" || !streamedMessages.delete(data.messageId)) {
          onEvent({ type: "message", text: data.content });
        }
      } else if (evt.type === "session.error") {
        const message = typeof data?.message === "string" ? redactSensitiveText(data.message) : "Copilot báo lỗi trong phiên.";
        if (/429|rate.limit|usage.limit/i.test(message)) {
          onEvent({ type: "rate_limit", model: this.model ?? void 0 });
        } else {
          onEvent({ type: "error", message });
        }
      } else if (evt.type === "message" && typeof evt.content === "string") {
        onEvent({ type: "message", text: evt.content });
      } else if (evt.type === "result") {
        if (typeof evt.exitCode === "number" && evt.exitCode !== 0) continue;
        const stats = evt.stats;
        onEvent({
          type: "done",
          externalSessionId: this.externalSessionId ?? void 0,
          usage: stats ? {
            inputTokens: stats.input_tokens ?? 0,
            outputTokens: stats.output_tokens ?? 0
          } : void 0
        });
      } else if (evt.jsonrpc === "2.0" && evt.method === "session/update") {
        const params = evt.params;
        const u = params?.update;
        if (params?.sessionId && !this.externalSessionId) {
          this.externalSessionId = params.sessionId;
          this.sessionRepo.updateExternalId(this.id, params.sessionId);
        }
        if (u?.sessionUpdate === "plan") {
          onEvent({
            type: "plan",
            steps: (u.entries ?? []).map((en) => ({
              title: en.content,
              status: en.status ?? "in_progress"
            }))
          });
        } else if (u?.sessionUpdate === "tool_call") {
          onEvent({
            type: "tool_call",
            id: u.toolCallId ?? `tc_${Date.now()}`,
            kind: u.kind ?? "tool",
            title: u.title ?? "Tool call",
            status: u.status ?? "completed"
          });
          if (u.title && typeof u.title === "string" && u.title.startsWith("Write ")) {
            const targetPath = u.title.replace(/^Write\s+/, "").trim();
            const safePath = assertPathInsideProject(this.cwd, targetPath);
            onEvent({
              type: "file_change",
              path: path.relative(this.cwd, safePath).replace(/\\/g, "/")
            });
          }
        } else if (u?.sessionUpdate === "agent_message_chunk" && u.content?.text) {
          onEvent({ type: "message", text: u.content.text });
        }
      } else if (evt.error && typeof evt.error === "object" && (String(evt.error.code) === "429" || String(evt.error.message).includes("429"))) {
        this.adapter.parseRateLimitTierC(line);
        onEvent({ type: "rate_limit", model: this.model ?? void 0 });
      }
    }
  }
  async respondPermission() {
  }
  async cancel() {
    await stopAgentProcess(this.child);
  }
}
class AgyAdapter {
  constructor(modelsService, sessionRepo, runner = defaultCommandRunner, customQuotaResolver) {
    this.modelsService = modelsService;
    this.sessionRepo = sessionRepo;
    this.runner = runner;
    this.customQuotaResolver = customQuotaResolver;
    const config = this.modelsService.getAgentCatalogConfig("agy");
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName("agy");
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand("agy");
    this.loginCommand = config.loginCommand;
  }
  id = "agy";
  displayName;
  shortName;
  logoLetter;
  color;
  darkColor;
  docsUrl;
  installCommand;
  loginCommand;
  lastRateLimitSnapshot = null;
  async detect() {
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ["--version"]);
    if (res.code !== 0) {
      return {
        agentId: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        logoLetter: this.logoLetter,
        color: this.color,
        darkColor: this.darkColor,
        docsUrl: this.docsUrl,
        installCommand: this.installCommand,
        loginCommand: this.loginCommand,
        installed: false,
        version: null,
        loggedIn: false,
        status: "not_installed",
        errorDetail: res.stderr || null,
        modelsCount: 0
      };
    }
    const versionMatch = res.stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1] : res.stdout.trim() || "unknown";
    let loggedIn = false;
    let status = "not_logged_in";
    const modelsRes = await this.runner(binary, ["models"]);
    if (modelsRes.code === 0 && (modelsRes.stdout.toLowerCase().includes("fetching available models") || modelsRes.stdout.toLowerCase().includes("gemini") || modelsRes.stdout.toLowerCase().includes("claude") || modelsRes.stdout.trim().length > 0)) {
      loggedIn = true;
      status = "ready";
    } else {
      try {
        const home = os.homedir();
        const settingsPath = path.join(home, ".gemini", "antigravity-cli", "settings.json");
        const installIdPath = path.join(home, ".gemini", "antigravity-cli", "installation_id");
        if (fs.existsSync(settingsPath) || fs.existsSync(installIdPath)) {
          loggedIn = true;
          status = "ready";
        }
      } catch {
      }
    }
    const models = await this.listModels(modelsRes.code === 0 ? modelsRes.stdout : void 0);
    return {
      agentId: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      logoLetter: this.logoLetter,
      color: this.color,
      darkColor: this.darkColor,
      docsUrl: this.docsUrl,
      installCommand: this.installCommand,
      loginCommand: this.loginCommand,
      installed: true,
      version,
      loggedIn,
      status,
      errorDetail: null,
      modelsCount: models.length
    };
  }
  async listModels(rawModelsOutput) {
    const discovered = [];
    if (rawModelsOutput) {
      const lines = rawModelsOutput.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("Fetching")) continue;
        const parts = trimmed.split(/\t+|\s{2,}/);
        if (parts.length >= 2) {
          discovered.push({ id: parts[0].trim(), label: parts[1].trim() });
        } else if (parts.length === 1 && parts[0].includes("-")) {
          discovered.push({ id: parts[0].trim(), label: parts[0].trim() });
        }
      }
    }
    if (discovered.length === 0) {
      const defaults = this.modelsService.getCatalogDefaultModels(this.id);
      return this.modelsService.syncAgentModels(this.id, defaults);
    }
    return this.modelsService.syncAgentModels(this.id, discovered);
  }
  async getQuota(model) {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return [parsed];
        } catch {
        }
      }
    }
    const usage = await this.runner(resolveAgentBinary(this.id), [
      "--print",
      "/usage",
      "--print-timeout",
      "12s",
      "--output-format",
      "text"
    ]);
    if (usage.code === 0) {
      const windows = this.parseUsageWindows(usage.stdout, model);
      if (windows.length) {
        const used = Math.max(...windows.map((window) => window.usedPercent));
        return [
          {
            agentId: this.id,
            model: model && model !== "auto" ? model : null,
            scope: model && model !== "auto" ? "model" : "unknown",
            windows,
            status: !model || model === "auto" ? "unknown" : used >= 100 ? "exhausted" : used >= 80 ? "low" : "ok",
            source: "official",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ];
      }
    }
    if (this.lastRateLimitSnapshot) {
      return [this.lastRateLimitSnapshot];
    }
    return [
      {
        agentId: this.id,
        model: null,
        scope: "unknown",
        windows: [],
        status: "unknown",
        source: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
  }
  parseUsageWindows(output, model) {
    const windows = /* @__PURE__ */ new Map();
    for (const line of output.split(/\r?\n/)) {
      const [group, limit, percent, reset] = line.split("	").map((column) => column.trim());
      if (!group || !limit || !percent || !/^\d+(?:\.\d+)?%$/.test(percent)) continue;
      const remaining = Number(percent.slice(0, -1));
      if (remaining < 0 || remaining > 100) continue;
      const groupName = group.toLowerCase();
      const modelId = model?.toLowerCase();
      if (modelId && modelId !== "auto") {
        const applies = groupName === "gemini models" ? modelId.startsWith("gemini-") : groupName === "claude and gpt models" ? /^(claude|gpt)-/.test(modelId) : modelId.startsWith(groupName.replace(/\s+/g, "-"));
        if (!applies) continue;
      }
      const label = /five hour/i.test(limit) ? "5 giờ" : /weekly/i.test(limit) ? "Tuần" : null;
      if (!label) continue;
      const usedPercent = 100 - remaining;
      const current = windows.get(label);
      if (!current || usedPercent > current.usedPercent) {
        windows.set(label, {
          label,
          usedPercent,
          resetsAt: reset && Number.isFinite(Date.parse(reset)) ? reset : null
        });
      }
    }
    return [...windows.values()];
  }
  async startSession(opts) {
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId
    });
    return new AgySessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      this,
      binary,
      opts.readOnly
    );
  }
}
class AgySessionInstance {
  constructor(id, cwd, model, externalSessionId, sessionRepo, adapter, binary = "agy", readOnly = false) {
    this.sessionRepo = sessionRepo;
    this.adapter = adapter;
    this.readOnly = readOnly;
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
    this.binary = binary;
  }
  id;
  agentId = "agy";
  cwd;
  model;
  child = null;
  externalSessionId;
  binary;
  getExternalSessionId() {
    return this.externalSessionId;
  }
  async send(prompt, onEvent, mockStreamLines) {
    if (mockStreamLines) {
      this.processNdjsonLines(mockStreamLines, onEvent);
      return;
    }
    const args = ["--print", prompt, "--output-format", "stream-json"];
    if (this.readOnly) args.push("--mode", "plan", "--sandbox");
    if (this.model) {
      args.push("--model", this.model);
    }
    if (this.externalSessionId) {
      args.push("--conversation", this.externalSessionId);
    }
    const execOpts = getCommandExecutionOptions(this.binary);
    if (this.readOnly && execOpts.shell) throw new Error("Cần agy.exe để chạy subagent an toàn.");
    return new Promise((resolve, reject) => {
      const child = node_child_process.spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell
      });
      this.child = child;
      let buffer = "";
      child.stdout?.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        this.processNdjsonLines(lines, onEvent);
      });
      child.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.includes("RateLimit") || text.includes("ResourceExhausted")) {
          onEvent({
            type: "rate_limit",
            model: this.model ?? void 0
          });
        }
      });
      child.on("close", (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer], onEvent);
        }
        if (code === 0) {
          onEvent({
            type: "done",
            externalSessionId: this.externalSessionId ?? void 0
          });
          resolve();
        } else {
          onEvent({
            type: "error",
            message: `Antigravity CLI process exited with code ${code}`
          });
          resolve();
        }
      });
      child.on("error", (err) => {
        onEvent({
          type: "error",
          message: err.message
        });
        reject(err);
      });
    });
  }
  processNdjsonLines(lines, onEvent) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const item = JSON.parse(trimmed);
        if (item.event === "step_update" && item.step_update?.text_delta) {
          onEvent({
            type: "message",
            text: item.step_update.text_delta
          });
        }
        if (item.event === "result") {
          if (item.result?.conversation_id) {
            this.externalSessionId = item.result.conversation_id;
            this.sessionRepo.updateExternalId(this.id, item.result.conversation_id);
          }
          const usage = item.result?.usage;
          onEvent({
            type: "done",
            externalSessionId: this.externalSessionId ?? void 0,
            usage: usage ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0
            } : void 0
          });
        }
      } catch {
        onEvent({ type: "message", text: trimmed });
      }
    }
  }
  async respondPermission(_requestId, _optionId) {
  }
  async cancel() {
    await stopAgentProcess(this.child);
  }
}
const defaultTerminalLauncher = async (command) => {
  if (process.platform === "win32") {
    node_child_process.spawn("cmd.exe", ["/c", "start", "cmd.exe", "/k", command], {
      detached: true,
      stdio: "ignore"
    }).unref();
  } else if (process.platform === "darwin") {
    node_child_process.spawn("open", ["-a", "Terminal", command], {
      detached: true,
      stdio: "ignore"
    }).unref();
  } else {
    node_child_process.spawn("x-terminal-emulator", ["-e", command], {
      detached: true,
      stdio: "ignore"
    }).unref();
  }
};
const defaultUrlOpener = async (url) => {
  const { shell } = await import("electron");
  await shell.openExternal(url);
};
class AgentRegistry {
  adapters = /* @__PURE__ */ new Map();
  terminalLauncher;
  urlOpener;
  constructor(options) {
    this.terminalLauncher = options.terminalLauncher ?? defaultTerminalLauncher;
    this.urlOpener = options.urlOpener ?? defaultUrlOpener;
    if (options.customAdapters) {
      for (const a of options.customAdapters) {
        this.adapters.set(a.id, a);
      }
    } else {
      const claude = new ClaudeAdapter(options.modelsService, options.sessionRepo);
      const codex = new CodexAdapter(options.modelsService, options.sessionRepo);
      const copilot = new CopilotAdapter(options.modelsService, options.sessionRepo);
      const agy = new AgyAdapter(options.modelsService, options.sessionRepo);
      this.adapters.set(claude.id, claude);
      this.adapters.set(codex.id, codex);
      this.adapters.set(copilot.id, copilot);
      this.adapters.set(agy.id, agy);
    }
  }
  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }
  get(agentId) {
    return this.adapters.get(agentId);
  }
  getAdapter(agentId) {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`AI CLI adapter not registered: ${agentId}`);
    }
    return adapter;
  }
  getAllAdapters() {
    return Array.from(this.adapters.values());
  }
  /**
   * Phát hiện trạng thái cài đặt, đăng nhập và số model của tất cả AI CLI đã đăng ký.
   */
  async detectAll(agentId) {
    const adapters = agentId === void 0 ? this.getAllAdapters() : [this.getAdapter(agentId)];
    const promises = adapters.map(async (adapter) => {
      try {
        return await adapter.detect();
      } catch (err) {
        return {
          agentId: adapter.id,
          displayName: adapter.displayName,
          shortName: adapter.shortName,
          logoLetter: adapter.logoLetter,
          color: adapter.color,
          darkColor: adapter.darkColor,
          docsUrl: adapter.docsUrl,
          installCommand: adapter.installCommand,
          loginCommand: adapter.loginCommand,
          installed: false,
          version: null,
          loggedIn: false,
          status: "error",
          errorDetail: err instanceof Error ? err.message : String(err),
          modelsCount: 0
        };
      }
    });
    return Promise.all(promises);
  }
  /**
   * LUẬT B3: Mở cửa sổ dòng lệnh OS chạy lệnh đăng nhập chính thức của CLI.
   * Tuyệt đối không can thiệp, không tự nhập và không đọc trích xuất token.
   */
  async openLoginTerminal(agentId) {
    const adapter = this.getAdapter(agentId);
    const binary = resolveAgentBinary(agentId);
    let cmdToRun = agentId === "copilot" && isGitHubCli(binary) ? "gh auth login" : adapter.loginCommand;
    if (binary.includes(path.sep) || binary.includes("/")) {
      const parts = cmdToRun.split(" ");
      parts[0] = `"${binary}"`;
      cmdToRun = parts.join(" ");
    }
    await this.terminalLauncher(cmdToRun);
  }
  /**
   * Mở trang tài liệu chính thức của hãng trong trình duyệt mặc định.
   */
  async openDocsUrl(agentId) {
    const adapter = this.getAdapter(agentId);
    await this.urlOpener(adapter.docsUrl);
  }
}
const AgentIdSchema = zod.z.string().min(1);
const ModelTierSchema = zod.z.enum(["strong", "balanced", "fast", "unknown"]);
const EditableModelTierSchema = zod.z.enum(["strong", "balanced", "fast"]);
const TierSourceSchema = zod.z.enum(["default", "user", "unmapped"]);
zod.z.object({
  agentId: AgentIdSchema,
  model: zod.z.string().nullable()
});
zod.z.object({
  id: zod.z.string().min(1),
  agentId: AgentIdSchema,
  agentDisplayName: zod.z.string().min(1),
  label: zod.z.string().min(1),
  tier: ModelTierSchema,
  tierSource: TierSourceSchema
});
const CliStatusSchema = zod.z.enum([
  "checking",
  "ready",
  "not_logged_in",
  "not_installed",
  "error"
]);
zod.z.object({
  agentId: AgentIdSchema,
  displayName: zod.z.string().min(1),
  shortName: zod.z.string().min(1),
  logoLetter: zod.z.string().min(1),
  color: zod.z.string().min(1),
  darkColor: zod.z.string().min(1),
  docsUrl: zod.z.string().url(),
  installCommand: zod.z.string().min(1),
  loginCommand: zod.z.string().min(1),
  installed: zod.z.boolean(),
  version: zod.z.string().nullable(),
  loggedIn: zod.z.boolean(),
  status: CliStatusSchema,
  errorDetail: zod.z.string().nullable(),
  modelsCount: zod.z.number().int().nonnegative()
});
const QuotaWindowSchema = zod.z.object({
  label: zod.z.string(),
  usedPercent: zod.z.number().nullable(),
  resetsAt: zod.z.string().nullable()
});
zod.z.object({
  agentId: AgentIdSchema,
  model: zod.z.string().nullable(),
  scope: zod.z.enum(["shared", "model", "unknown"]),
  windows: zod.z.array(QuotaWindowSchema),
  status: zod.z.enum(["ok", "low", "exhausted", "unknown"]),
  source: zod.z.enum(["official", "estimated", "detected", "unknown"]),
  updatedAt: zod.z.string()
});
const DefaultModelCatalogItemSchema = zod.z.object({
  id: zod.z.string().min(1),
  label: zod.z.string().min(1),
  tier: EditableModelTierSchema
});
const PatternTierSchema = zod.z.object({
  contains: zod.z.string().min(1),
  tier: EditableModelTierSchema
});
const InstallCommandSchema = zod.z.union([zod.z.string().min(1), zod.z.record(zod.z.string(), zod.z.string())]);
const AgentCatalogEntrySchema = zod.z.object({
  displayName: zod.z.string().min(1),
  shortName: zod.z.string().min(1).optional(),
  logoLetter: zod.z.string().min(1),
  color: zod.z.string().min(1),
  darkColor: zod.z.string().min(1),
  docsUrl: zod.z.string().url(),
  installCommand: InstallCommandSchema,
  loginCommand: zod.z.string().min(1),
  models: zod.z.array(DefaultModelCatalogItemSchema),
  patternTiers: zod.z.array(PatternTierSchema).optional()
});
const DefaultCatalogFileSchema = zod.z.object({
  schemaVersion: zod.z.number().int().positive(),
  updatedAt: zod.z.string(),
  agents: zod.z.record(zod.z.string(), AgentCatalogEntrySchema)
});
const UserOverridesFileSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  overrides: zod.z.record(zod.z.string(), zod.z.record(zod.z.string(), EditableModelTierSchema))
});
function resolveDefaultConfigPath(explicitPath) {
  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }
  const candidates = [
    path.resolve(process.cwd(), "resources", "model-tiers.default.json"),
    path.resolve(__dirname, "../../resources/model-tiers.default.json"),
    path.resolve(__dirname, "../../../resources/model-tiers.default.json")
  ];
  const resourcesPath = process.resourcesPath;
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, "resources", "model-tiers.default.json"));
    candidates.push(path.join(resourcesPath, "model-tiers.default.json"));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not locate resources/model-tiers.default.json");
}
class ModelTierService {
  db;
  userConfigPath;
  defaultCatalog;
  constructor(options) {
    this.db = options.db;
    this.userConfigPath = path.join(options.userDataDir, "model-tiers.user.json");
    const defaultPath = resolveDefaultConfigPath(options.defaultConfigPath);
    const rawJson = fs.readFileSync(defaultPath, "utf8");
    this.defaultCatalog = DefaultCatalogFileSchema.parse(JSON.parse(rawJson));
  }
  getKnownAgentIds() {
    return Object.keys(this.defaultCatalog.agents);
  }
  getAgentCatalogConfig(agentId) {
    const entry = this.defaultCatalog.agents[agentId];
    if (!entry) {
      throw new Error(`Unknown agentId in model-tiers.default.json: ${agentId}`);
    }
    return entry;
  }
  getCatalogDefaultModels(agentId) {
    const entry = this.defaultCatalog.agents[agentId];
    if (!entry) {
      return [];
    }
    return entry.models.map((m) => ({ id: m.id, label: m.label }));
  }
  readUserOverrides() {
    if (!fs.existsSync(this.userConfigPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.userConfigPath, "utf8");
      const parsed = UserOverridesFileSchema.parse(JSON.parse(raw));
      return parsed.overrides;
    } catch {
      return {};
    }
  }
  writeUserOverrides(overrides) {
    fs.mkdirSync(path.dirname(this.userConfigPath), { recursive: true });
    const payload = {
      schemaVersion: 1,
      overrides
    };
    fs.writeFileSync(this.userConfigPath, `${JSON.stringify(payload, null, 2)}
`, "utf8");
  }
  getInstallCommand(agentId, platform = process.platform) {
    const entry = this.getAgentCatalogConfig(agentId);
    if (typeof entry.installCommand === "string") {
      return entry.installCommand;
    }
    return entry.installCommand[platform] ?? entry.installCommand["win32"] ?? Object.values(entry.installCommand)[0] ?? "";
  }
  getAgentShortName(agentId) {
    const entry = this.defaultCatalog.agents[agentId];
    return entry?.shortName ?? entry?.displayName?.split(" ")[0] ?? agentId;
  }
  resolveModelInfo(agentId, discovered) {
    const agentEntry = this.defaultCatalog.agents[agentId];
    const agentDisplayName = agentEntry?.displayName ?? agentId;
    const defaultItem = agentEntry?.models.find((m) => m.id === discovered.id);
    const userOverrides = this.readUserOverrides();
    const userTier = userOverrides[agentId]?.[discovered.id];
    let tier = "unknown";
    let tierSource = "unmapped";
    if (userTier) {
      tier = userTier;
      tierSource = "user";
    } else if (defaultItem) {
      tier = defaultItem.tier;
      tierSource = "default";
    } else if ("tier" in discovered && discovered.tier && discovered.tier !== "unknown") {
      tier = discovered.tier;
      tierSource = "default";
    } else if (agentEntry?.patternTiers) {
      const lowerId = discovered.id.toLowerCase();
      const matchedPattern = agentEntry.patternTiers.find(
        (p) => lowerId.includes(p.contains.toLowerCase())
      );
      if (matchedPattern) {
        tier = matchedPattern.tier;
        tierSource = "default";
      }
    }
    const label = discovered.label ?? defaultItem?.label ?? discovered.id;
    return {
      id: discovered.id,
      agentId,
      agentDisplayName,
      label,
      tier,
      tierSource
    };
  }
  /**
   * Đồng bộ danh sách model do CLI báo vào bảng SQLite `models` và trả về `ModelInfo[]`.
   */
  syncAgentModels(agentId, discoveredModels) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const resolved = discoveredModels.map((m) => this.resolveModelInfo(agentId, m));
    const upsertStmt = this.db.prepare(`
      INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
      VALUES (@agent_id, @model_id, @label, @tier, 1, @detected_at)
      ON CONFLICT(agent_id, model_id) DO UPDATE SET
        label = excluded.label,
        tier = excluded.tier,
        available = 1,
        detected_at = excluded.detected_at
    `);
    const tx = this.db.transaction((items) => {
      if (items.length > 0) {
        const placeholders = items.map(() => "?").join(",");
        this.db.prepare(`DELETE FROM models WHERE agent_id = ? AND model_id NOT IN (${placeholders})`).run(agentId, ...items.map((i) => i.id));
      }
      for (const item of items) {
        upsertStmt.run({
          agent_id: item.agentId,
          model_id: item.id,
          label: item.label,
          tier: item.tier,
          detected_at: now
        });
      }
    });
    tx(resolved);
    return resolved;
  }
  /**
   * Đảm bảo các model mặc định trong cấu hình đã có mặt trong bảng `models` nếu chưa từng quét.
   */
  ensureCatalogSeeded() {
    this.db.prepare(
      `
      DELETE FROM models 
      WHERE agent_id = 'codex' 
        AND model_id IN ('gpt-5-codex', 'codex-mini-latest')
    `
    ).run();
    for (const agentId of this.getKnownAgentIds()) {
      const agentCount = this.db.prepare("SELECT COUNT(*) AS cnt FROM models WHERE agent_id = ?").get(agentId);
      if (agentCount.cnt === 0) {
        const defaults = this.getCatalogDefaultModels(agentId);
        this.syncAgentModels(agentId, defaults);
      }
    }
  }
  /**
   * Liệt kê toàn bộ model đã ghi nhận trong bảng `models` (hoặc của riêng một `agentId`),
   * kết hợp với cấu hình mặc định và ghi đè của người dùng.
   */
  listModels(agentId) {
    this.ensureCatalogSeeded();
    const rows = agentId ? this.db.prepare(
      "SELECT agent_id, model_id, label, tier, available, detected_at FROM models WHERE agent_id = ? AND available = 1 ORDER BY rowid ASC"
    ).all(agentId) : this.db.prepare(
      "SELECT agent_id, model_id, label, tier, available, detected_at FROM models WHERE available = 1 ORDER BY rowid ASC"
    ).all();
    return rows.map((row) => {
      const info = this.resolveModelInfo(row.agent_id, {
        id: row.model_id,
        label: row.label
      });
      const parsedDbTier = ModelTierSchema.safeParse(row.tier);
      if (info.tierSource === "unmapped" && parsedDbTier.success && parsedDbTier.data !== "unknown") {
        return {
          ...info,
          tier: parsedDbTier.data,
          tierSource: "user"
        };
      }
      return info;
    });
  }
  /**
   * Cho phép người dùng đổi bậc của một model ở MH-11 "Nâng cao: bậc model và ghim model".
   */
  setModelTier(agentId, modelId, tier) {
    const validTier = EditableModelTierSchema.parse(tier);
    const overrides = this.readUserOverrides();
    const agentOverrides = overrides[agentId] ?? {};
    agentOverrides[modelId] = validTier;
    overrides[agentId] = agentOverrides;
    this.writeUserOverrides(overrides);
    const existingRow = this.db.prepare("SELECT label FROM models WHERE agent_id = ? AND model_id = ?").get(agentId, modelId);
    const info = this.resolveModelInfo(agentId, {
      id: modelId,
      label: existingRow?.label
    });
    this.db.prepare(
      `
        INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
        VALUES (@agent_id, @model_id, @label, @tier, 1, @detected_at)
        ON CONFLICT(agent_id, model_id) DO UPDATE SET
          tier = excluded.tier,
          detected_at = excluded.detected_at
      `
    ).run({
      agent_id: agentId,
      model_id: modelId,
      label: info.label,
      tier: validTier,
      detected_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return info;
  }
}
class AgentSessionRepository {
  constructor(db) {
    this.db = db;
  }
  ensureProjectForCwd(cwd, explicitProjectId) {
    const normalizedPath = path.resolve(cwd);
    const existingByPath = this.db.prepare("SELECT id FROM projects WHERE path = ?").get(normalizedPath);
    if (existingByPath) {
      return existingByPath.id;
    }
    if (explicitProjectId) {
      const existingById = this.db.prepare("SELECT id FROM projects WHERE id = ?").get(explicitProjectId);
      if (existingById) {
        return existingById.id;
      }
    }
    const id = explicitProjectId ?? `proj_${crypto.randomUUID()}`;
    const name = path.basename(normalizedPath) || "project";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "INSERT INTO projects (id, name, path, created_at, last_opened) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, normalizedPath, now, now);
    return id;
  }
  createSession(params) {
    const id = params.id ?? `asess_${crypto.randomUUID()}`;
    const projectId = this.ensureProjectForCwd(params.cwd, params.projectId);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const externalId = params.externalId ?? null;
    this.db.prepare(
      `
        INSERT INTO agent_sessions (id, project_id, agent_id, model, external_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(id, projectId, params.agentId, params.model, externalId, createdAt);
    return {
      id,
      projectId,
      agentId: params.agentId,
      model: params.model,
      externalId,
      createdAt
    };
  }
  updateExternalId(sessionId, externalId) {
    this.db.prepare("UPDATE agent_sessions SET external_id = ? WHERE id = ?").run(externalId, sessionId);
  }
  getById(sessionId) {
    const row = this.db.prepare(
      "SELECT id, project_id, agent_id, model, external_id, created_at FROM agent_sessions WHERE id = ?"
    ).get(sessionId);
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }
  getLatestForProjectAndAgent(cwdOrProjectId, agentId) {
    const row = this.db.prepare(
      `
        SELECT s.id, s.project_id, s.agent_id, s.model, s.external_id, s.created_at
        FROM agent_sessions s
        LEFT JOIN projects p ON p.id = s.project_id
        WHERE (s.project_id = @key OR p.path = @resolvedPath)
          AND s.agent_id = @agentId
        ORDER BY s.created_at DESC, s.rowid DESC
        LIMIT 1
      `
    ).get({
      key: cwdOrProjectId,
      resolvedPath: path.resolve(cwdOrProjectId),
      agentId
    });
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }
  mapRow(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      agentId: row.agent_id,
      model: row.model,
      externalId: row.external_id,
      createdAt: row.created_at
    };
  }
}
class ConversationRepository {
  db;
  constructor(db) {
    this.db = db;
  }
  // === CONVERSATIONS ===
  listByProject(projectId) {
    const stmt = this.db.prepare(`
      SELECT id, project_id, title, created_at
      FROM conversations
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(projectId).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      createdAt: r.created_at
    }));
  }
  getById(id) {
    const stmt = this.db.prepare(`
      SELECT id, project_id, title, created_at
      FROM conversations
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      createdAt: row.created_at
    } : null;
  }
  create(projectId, title) {
    const id = crypto.randomUUID();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, project_id, title, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, projectId, title ?? null, createdAt);
    return {
      id,
      projectId,
      title: title ?? null,
      createdAt
    };
  }
  updateTitle(id, title) {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET title = ?
      WHERE id = ?
    `);
    stmt.run(title, id);
  }
  delete(id) {
    const stmt = this.db.prepare(`
      DELETE FROM conversations
      WHERE id = ?
    `);
    stmt.run(id);
  }
  // === MESSAGES ===
  addMessage(conversationId, role, content) {
    const id = crypto.randomUUID();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, conversationId, role, content, createdAt);
    return {
      id,
      conversationId,
      role,
      content,
      createdAt
    };
  }
  listMessages(conversationId) {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(conversationId).map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at
    }));
  }
  // === STEPS ===
  createSteps(conversationId, steps) {
    const insertStmt = this.db.prepare(`
      INSERT INTO steps (id, conversation_id, seq, agent_id, model, status, summary, risk_level, checkpoint_before)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = [];
    const insertTx = this.db.transaction((items) => {
      for (const item of items) {
        const id = crypto.randomUUID();
        const status = item.status ?? "pending";
        insertStmt.run(
          id,
          conversationId,
          item.seq,
          item.agentId,
          item.model ?? null,
          status,
          item.summary ?? null,
          item.riskLevel ?? null,
          item.checkpointBefore ?? null
        );
        result.push({
          id,
          conversationId,
          seq: item.seq,
          agentId: item.agentId,
          model: item.model ?? null,
          status,
          summary: item.summary ?? null,
          riskLevel: item.riskLevel ?? null,
          checkpointBefore: item.checkpointBefore ?? null,
          checkpointAfter: null,
          startedAt: null,
          finishedAt: null
        });
      }
    });
    insertTx(steps);
    return result;
  }
  listSteps(conversationId) {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, seq, agent_id, model, status, summary,
             risk_level, checkpoint_before, checkpoint_after, started_at, finished_at
      FROM steps
      WHERE conversation_id = ?
      ORDER BY seq ASC
    `);
    return stmt.all(conversationId).map((r) => this.mapStepRow(r));
  }
  getStepById(id) {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, seq, agent_id, model, status, summary,
             risk_level, checkpoint_before, checkpoint_after, started_at, finished_at
      FROM steps
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapStepRow(row) : null;
  }
  updateStepStatus(id, status, extras) {
    const fields = ["status = ?"];
    const values = [status];
    if (extras?.summary !== void 0) {
      fields.push("summary = ?");
      values.push(extras.summary);
    }
    if (extras?.agentId !== void 0) {
      fields.push("agent_id = ?");
      values.push(extras.agentId);
    }
    if (extras?.model !== void 0) {
      fields.push("model = ?");
      values.push(extras.model);
    }
    if (extras?.checkpointAfter !== void 0) {
      fields.push("checkpoint_after = ?");
      values.push(extras.checkpointAfter);
    }
    if (extras?.finishedAt !== void 0) {
      fields.push("finished_at = ?");
      values.push(extras.finishedAt);
    }
    values.push(id);
    const sql = `UPDATE steps SET ${fields.join(", ")} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }
  setStepStarted(id, startedAt) {
    const time = startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
    const stmt = this.db.prepare(`
      UPDATE steps
      SET status = ?, started_at = ?
      WHERE id = ?
    `);
    stmt.run("running", time, id);
  }
  // === STEP FILES ===
  addStepFiles(stepId, files) {
    const stmt = this.db.prepare(`
      INSERT INTO step_files (id, step_id, path, change, risk_tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction(
      (items) => {
        for (const f of items) {
          const id = crypto.randomUUID();
          const tagsStr = f.riskTags && f.riskTags.length > 0 ? JSON.stringify(f.riskTags) : null;
          stmt.run(id, stepId, f.path, f.change, tagsStr);
        }
      }
    );
    tx(files);
  }
  listStepFiles(stepId) {
    const stmt = this.db.prepare(`
      SELECT id, step_id, path, change, risk_tags
      FROM step_files
      WHERE step_id = ?
      ORDER BY path ASC
    `);
    return stmt.all(stepId).map((r) => ({
      id: r.id,
      stepId: r.step_id,
      path: r.path,
      change: r.change,
      riskTags: r.risk_tags ? JSON.parse(r.risk_tags) : []
    }));
  }
  mapStepRow(row) {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      seq: row.seq,
      agentId: row.agent_id,
      model: row.model,
      status: row.status,
      summary: row.summary,
      riskLevel: row.risk_level ?? null,
      checkpointBefore: row.checkpoint_before,
      checkpointAfter: row.checkpoint_after,
      startedAt: row.started_at,
      finishedAt: row.finished_at
    };
  }
}
const migration001Initial = {
  version: 1,
  name: "001_initial_schema",
  sql: `
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
  role             TEXT NOT NULL,
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE TABLE steps (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq               INTEGER NOT NULL,
  agent_id          TEXT NOT NULL,
  model             TEXT,
  status            TEXT NOT NULL,
  summary           TEXT,
  risk_level        TEXT,
  checkpoint_before TEXT,
  checkpoint_after  TEXT,
  started_at        TEXT,
  finished_at       TEXT
);

CREATE TABLE step_files (
  id         TEXT PRIMARY KEY,
  step_id    TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  change     TEXT NOT NULL,
  risk_tags  TEXT
);

CREATE TABLE decisions (
  id          TEXT PRIMARY KEY,
  step_id     TEXT REFERENCES steps(id) ON DELETE SET NULL,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'approach',
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE project_map (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  description TEXT,
  files       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE user_edits (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  edited_at    TEXT NOT NULL
);

CREATE TABLE agent_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  model       TEXT,
  external_id TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE models (
  agent_id    TEXT NOT NULL,
  model_id    TEXT NOT NULL,
  label       TEXT NOT NULL,
  tier        TEXT NOT NULL,
  available   INTEGER NOT NULL DEFAULT 1,
  detected_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, model_id)
);

CREATE TABLE quota_snapshots (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  model       TEXT,
  plan        TEXT,
  scope       TEXT NOT NULL,
  windows     TEXT NOT NULL,
  status      TEXT NOT NULL,
  source      TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE TABLE plugins (
  id                  TEXT PRIMARY KEY,
  version             TEXT NOT NULL,
  kind                TEXT NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  granted_permissions TEXT NOT NULL,
  installed_at        TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`
};
const migration002Phase4 = {
  version: 2,
  name: "002_phase4_diff_and_checkpoints",
  sql: `
ALTER TABLE step_files ADD COLUMN diff_summary TEXT;
ALTER TABLE step_files ADD COLUMN full_diff TEXT;

CREATE TABLE IF NOT EXISTS checkpoints (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id     TEXT REFERENCES steps(id) ON DELETE SET NULL,
  git_hash    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_step_files_step_id ON step_files(step_id);
CREATE INDEX IF NOT EXISTS idx_user_edits_project_id ON user_edits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_map_project_id ON project_map(project_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_project_id ON checkpoints(project_id);
`
};
const ALL_MIGRATIONS = [
  migration001Initial,
  migration002Phase4
];
class DatabaseService {
  dbPath;
  backupDir;
  migrations;
  logger;
  db = null;
  constructor(options) {
    const fileName = options.dbFileName ?? "codefleet.sqlite";
    this.dbPath = path.join(options.userDataDir, fileName);
    this.backupDir = path.join(options.userDataDir, "backups");
    this.migrations = options.migrations ?? ALL_MIGRATIONS;
    this.logger = options.logger;
  }
  getDbPath() {
    return this.dbPath;
  }
  getBackupDir() {
    return this.backupDir;
  }
  getDb() {
    if (!this.db) {
      return this.openAndMigrate();
    }
    return this.db;
  }
  openAndMigrate() {
    if (this.db) {
      return this.db;
    }
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const hadExistingDbFile = fs.existsSync(this.dbPath) && fs.statSync(this.dbPath).size > 0;
    const conn = new Database(this.dbPath);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    conn.pragma("busy_timeout = 5000");
    conn.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const appliedRows = conn.prepare(
      "SELECT version FROM _schema_migrations ORDER BY version ASC"
    ).all();
    const appliedSet = new Set(appliedRows.map((r) => r.version));
    const sortedMigrations = [...this.migrations].sort((a, b) => a.version - b.version);
    const pending = sortedMigrations.filter((m) => !appliedSet.has(m.version));
    if (pending.length > 0) {
      if (hadExistingDbFile) {
        const nextVersion = pending[0].version;
        const backup = this.createSnapshotBackup(conn, `pre-migration-v${nextVersion}`);
        this.logger?.info("Created pre-migration SQLite backup", {
          backupPath: backup.backupPath,
          nextVersion
        });
      }
      for (const migration of pending) {
        const applyTx = conn.transaction((mig) => {
          conn.exec(mig.sql);
          conn.prepare("INSERT INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(mig.version, mig.name, (/* @__PURE__ */ new Date()).toISOString());
        });
        applyTx(migration);
        this.logger?.info("Applied SQLite migration", {
          version: migration.version,
          name: migration.name
        });
      }
    }
    this.db = conn;
    return conn;
  }
  getConnection() {
    if (!this.db) {
      throw new Error("Database has not been opened. Call openAndMigrate() first.");
    }
    return this.db;
  }
  /**
   * Sao lưu thủ công hoặc tự động (MH-11 "Sao lưu ngay" & Luật P8).
   */
  backupNow(label = "manual") {
    const conn = this.getConnection();
    const backup = this.createSnapshotBackup(conn, label);
    this.logger?.info("Created manual SQLite backup", {
      backupPath: backup.backupPath,
      sizeBytes: backup.sizeBytes
    });
    return backup;
  }
  createSnapshotBackup(conn, label) {
    fs.mkdirSync(this.backupDir, { recursive: true });
    conn.pragma("wal_checkpoint(TRUNCATE)");
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const safeTimestamp = createdAt.replace(/[:.]/g, "-");
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "-");
    const backupPath = path.join(
      this.backupDir,
      `codefleet-${safeLabel}-${safeTimestamp}.sqlite.bak`
    );
    fs.copyFileSync(this.dbPath, backupPath);
    const sizeBytes = fs.statSync(backupPath).size;
    return { backupPath, createdAt, sizeBytes };
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
class ProjectRepository {
  db;
  constructor(db) {
    this.db = db;
  }
  list() {
    const stmt = this.db.prepare(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      ORDER BY 
        CASE WHEN last_opened IS NULL THEN 0 ELSE 1 END DESC,
        last_opened DESC,
        created_at DESC
    `);
    const rows = stmt.all();
    return rows.map((r) => this.mapRow(r));
  }
  getById(id) {
    const stmt = this.db.prepare(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }
  getByPath(projectPath) {
    const stmt = this.db.prepare(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      WHERE path = ?
    `);
    const row = stmt.get(projectPath);
    return row ? this.mapRow(row) : null;
  }
  create(input) {
    const id = input.id ?? crypto.randomUUID();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const lastOpened = createdAt;
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, created_at, last_opened)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.path, createdAt, lastOpened);
    return {
      id,
      name: input.name,
      path: input.path,
      createdAt,
      lastOpened
    };
  }
  touchLastOpened(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = this.db.prepare(`
      UPDATE projects
      SET last_opened = ?
      WHERE id = ?
    `);
    stmt.run(now, id);
  }
  updateName(id, name) {
    const stmt = this.db.prepare(`
      UPDATE projects
      SET name = ?
      WHERE id = ?
    `);
    stmt.run(name, id);
  }
  delete(id) {
    const stmt = this.db.prepare(`
      DELETE FROM projects
      WHERE id = ?
    `);
    stmt.run(id);
  }
  mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      lastOpened: row.last_opened
    };
  }
}
const planSchema = zod.z.object({
  assignments: zod.z.array(
    zod.z.object({
      agent: zod.z.string(),
      role: zod.z.string().trim().min(1).max(120),
      task: zod.z.string().trim().min(1).max(1e3)
    })
  )
});
async function runReadOnlyTurn(options, adapter, model, prompt) {
  if (options.cancelled()) return null;
  let session;
  let timeout;
  try {
    session = await adapter.startSession({
      cwd: options.cwd,
      projectId: options.projectId,
      model,
      allowNonGitWorkspace: true,
      readOnly: true
    });
    if (options.cancelled()) {
      await session.cancel();
      return null;
    }
    options.active.add(session);
    let response = "";
    let failed = false;
    timeout = setTimeout(() => {
      failed = true;
      void session?.cancel().catch(() => {
      });
    }, 12e4);
    timeout.unref();
    await session.send(prompt, (event) => {
      if (event.type === "permission_request") {
        failed = true;
        void session?.respondPermission(event.id, "deny").catch(() => {
        });
      }
      if (event.type === "error" || event.type === "rate_limit") failed = true;
      if (event.type === "message" && !options.cancelled() && !failed) {
        response += event.text;
        if (response.length > 24e3) {
          response = "";
          failed = true;
        }
      }
    });
    return !failed && !options.cancelled() && response.trim() ? response.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (session) options.active.delete(session);
  }
}
async function collectTeamReports(options) {
  const detected = await options.registry.detectAll();
  if (options.cancelled()) return "";
  const available = new Map(
    detected.filter((agent) => agent.status === "ready").map(({ agentId }) => [agentId, options.registry.getAdapter(agentId)])
  );
  if (!available.size) {
    options.status("Không có agent con sẵn sàng · agent chính tự xử lý");
    return "";
  }
  options.status(`${options.lead.displayName} · đang phân công`);
  const planText = await runReadOnlyTurn(
    options,
    options.lead,
    options.leadModel,
    [
      "Bạn là agent chính. Hãy phân công các phần việc phù hợp với yêu cầu hiện tại.",
      "Chọn vai trò theo nội dung thực tế, kể cả công việc ngoài lập trình. Chỉ phân công các phần độc lập có thể làm song song.",
      "Agent con có thể đọc dữ liệu, phân tích, tính toán, rà soát hoặc soạn nội dung để bàn giao. Việc ghi tệp và hành động bên ngoài do agent chính thực hiện sau khi nhận kết quả.",
      "Mỗi agent tối đa một nhiệm vụ. Mô tả nhiệm vụ và đầu ra mong đợi trong tối đa 1000 ký tự. Dùng danh sách rỗng nếu không cần chia việc.",
      'Ở lượt này chỉ lập kế hoạch. Chỉ trả về JSON theo mẫu {"assignments":[{"agent":"id","role":"vai trò","task":"nhiệm vụ và đầu ra"}]}.',
      `Agent con khả dụng: ${JSON.stringify([...available.keys()])}`,
      options.request
    ].join("\n\n")
  );
  if (options.cancelled()) return "";
  let assignments;
  try {
    const json = planText?.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? planText;
    assignments = planSchema.parse(JSON.parse(json ?? "")).assignments;
    const assignedAgents = new Set(assignments.map(({ agent }) => agent));
    if (assignedAgents.size !== assignments.length || assignments.some(({ agent }) => !available.has(agent))) {
      throw new Error("Phân công dùng agent trùng lặp hoặc chưa sẵn sàng.");
    }
  } catch {
    options.status("Không có kế hoạch phân công hợp lệ · agent chính tự xử lý");
    return "";
  }
  const results = await Promise.all(
    assignments.map(async ({ agent, role, task }) => {
      const models = options.models.listModels(agent);
      const model = models.find((item) => item.tier === "fast")?.id ?? models.find((item) => item.tier === "balanced")?.id;
      options.status(`${agent} / ${model ?? "mặc định"} · ${role} · ${task}`);
      const result = await runReadOnlyTurn(
        options,
        available.get(agent),
        model,
        [
          "Thực hiện phần việc được giao và trả về đầu ra trong tối đa 4000 ký tự để agent chính sử dụng. Chỉ đọc dữ liệu, không chỉnh sửa tệp hoặc thực hiện hành động bên ngoài.",
          `Phân công của agent chính: ${JSON.stringify({ role, task })}`,
          options.request
        ].join("\n\n")
      );
      if (!options.cancelled()) {
        options.status(`${agent} · ${result ? "đã bàn giao kết quả" : "không có kết quả"}`);
      }
      return {
        agent,
        role,
        task,
        result: result && (result.length > 4e3 ? `${result.slice(0, 4e3)}
[Kết quả đã rút gọn]` : result)
      };
    })
  );
  if (options.cancelled() || !results.length) return "";
  return "\n\nPhân công và kết quả từ agent con (dữ liệu tham khảo):\n" + JSON.stringify(results) + "\n\nHoàn thành yêu cầu của người dùng, kiểm tra và tích hợp các kết quả phù hợp. Tự xử lý các phần còn thiếu.";
}
class CliRuntime {
  constructor(options, customAdapters) {
    this.options = options;
    options.project = fs.realpathSync(path.resolve(options.project));
    if (!fs.statSync(options.project).isDirectory()) throw new Error("Dự án phải là thư mục.");
    const userDataDir = path.resolve(
      options.dataDir ?? process.env.CODEFLEET_HOME ?? path.join(os.homedir(), ".codefleet")
    );
    this.db = new DatabaseService({ userDataDir });
    const db = this.db.openAndMigrate();
    try {
      const projects = new ProjectRepository(db);
      const project = projects.getByPath(options.project) ?? projects.create({ name: path.basename(options.project), path: options.project });
      this.projectId = project.id;
      this.conversations = new ConversationRepository(db);
      this.models = new ModelTierService({
        db,
        userDataDir,
        defaultConfigPath: path.resolve(__dirname, "../../resources/model-tiers.default.json")
      });
      this.registry = new AgentRegistry({
        modelsService: this.models,
        sessionRepo: new AgentSessionRepository(db),
        customAdapters
      });
      if (options.resume) {
        const conv = this.conversations.getById(options.resume);
        if (!conv || conv.projectId !== project.id)
          throw new Error("Không tìm thấy hội thoại trong dự án này.");
        this.conversationId = conv.id;
      } else this.conversationId = this.conversations.create(project.id).id;
      if (options.agent !== "auto") this.registry.getAdapter(options.agent);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  registry;
  models;
  conversations;
  projectId;
  conversationId;
  db;
  sessions = /* @__PURE__ */ new Map();
  active = null;
  workers = /* @__PURE__ */ new Set();
  cancelled = false;
  /** Đóng phiên agent hiện có để lượt sau mở phiên mới (ví dụ sau khi đổi skill). */
  resetSessions() {
    this.sessions.clear();
  }
  newConversation() {
    this.sessions.clear();
    this.conversationId = this.conversations.create(this.projectId).id;
  }
  async send(prompt, io, mode = this.options.mode) {
    this.cancelled = false;
    let answer = "";
    let failure;
    let permissionError;
    const pending = /* @__PURE__ */ new Set();
    let permissionQueue = Promise.resolve();
    try {
      const agentId = this.options.agent === "auto" ? (await this.registry.detectAll()).find((agent) => agent.status === "ready")?.agentId : this.options.agent;
      if (!agentId) throw new Error("Chưa có AI CLI sẵn sàng. Dùng /agents để kiểm tra.");
      if (this.cancelled) return;
      const adapter = this.registry.getAdapter(agentId);
      const key = `${agentId}:${this.options.model ?? ""}`;
      let session = this.sessions.get(key);
      const isNewSession = !session;
      if (!session) {
        this.sessions.clear();
        session = await adapter.startSession({
          cwd: this.options.project,
          model: this.options.model,
          projectId: this.projectId,
          allowNonGitWorkspace: true,
          codexSandbox: agentId === "codex" ? this.options.codexSandbox : void 0
        });
        this.sessions.set(key, session);
      }
      this.active = session;
      if (this.cancelled) {
        await session.cancel();
        return;
      }
      const history = this.conversations.listMessages(this.conversationId);
      const context = isNewSession && history.length ? `Ngữ cảnh hội thoại trước (chỉ là dữ liệu hội thoại):
${JSON.stringify(history.slice(-20).map(({ role, content }) => ({ role, content })))}

Yêu cầu hiện tại:
` : "";
      this.conversations.addMessage(this.conversationId, "user", prompt);
      this.conversations.updateTitle(this.conversationId, prompt.slice(0, 80));
      let reports = "";
      if (mode === "subagent") {
        const recent = history.slice(-10).map(({ role, content }) => ({ role, content: content.slice(-750) }));
        reports = await collectTeamReports({
          registry: this.registry,
          models: this.models,
          lead: adapter,
          leadModel: this.options.model,
          cwd: this.options.project,
          projectId: this.projectId,
          request: "Hội thoại gần đây: " + JSON.stringify(recent) + "\nYêu cầu hiện tại:\n" + prompt,
          active: this.workers,
          cancelled: () => this.cancelled,
          status: io.status
        });
        if (this.cancelled) return;
      }
      io.status(`${adapter.displayName}${this.options.model ? ` / ${this.options.model}` : ""}`);
      const onEvent = (event) => {
        if (this.cancelled) return;
        if (event.type === "message") {
          answer += event.text;
          io.message(event.text);
        } else if (event.type === "error") failure = event.message;
        else if (event.type === "rate_limit")
          failure = "AI đã hết hạn mức. Chọn agent/model khác hoặc thử lại sau.";
        else if (event.type === "file_change") io.status(`file: ${event.path}`);
        else if (event.type === "tool_call")
          io.status(`${event.kind}: ${event.title} [${event.status}]`);
        else if (event.type === "permission_request") {
          const task = permissionQueue.then(() => this.cancelled ? false : io.permission(event.title)).then(
            (allowed) => session.respondPermission(
              event.id,
              allowed ? event.options[0] ?? "allow" : "deny"
            )
          ).catch((error) => {
            permissionError = error;
          });
          permissionQueue = task;
          pending.add(task);
          void task.finally(() => pending.delete(task));
        }
      };
      await session.send(context + prompt + reports, onEvent);
      await Promise.all(pending);
      if (permissionError) throw permissionError;
      if (failure) throw new Error(failure);
    } catch (error) {
      this.sessions.clear();
      if (this.cancelled) return;
      throw failure ? new Error(failure) : error;
    } finally {
      this.active = null;
      if (answer) this.conversations.addMessage(this.conversationId, "assistant", answer);
    }
  }
  async cancel() {
    this.cancelled = true;
    const active = this.active;
    this.sessions.clear();
    const running = [...this.workers, ...active ? [active] : []];
    await Promise.all(running.map((session) => session.cancel()));
  }
  close() {
    this.db.close();
  }
}
exports.CliRuntime = CliRuntime;
