import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gitIso from 'isomorphic-git';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = path.join(__dirname, '.tmp', 'shadow-git');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runGit(args, envExtra = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'CodeFleet Checkpoint',
      GIT_AUTHOR_EMAIL: 'checkpoint@codefleet.local',
      GIT_COMMITTER_NAME: 'CodeFleet Checkpoint',
      GIT_COMMITTER_EMAIL: 'checkpoint@codefleet.local',
      ...envExtra,
    },
  }).trim();
}

class ShadowGitPrototype {
  constructor(workTree, shadowGitDir) {
    this.workTree = path.resolve(workTree);
    this.gitDir = path.resolve(shadowGitDir);
  }

  git(args) {
    return runGit([`--git-dir=${this.gitDir}`, `--work-tree=${this.workTree}`, ...args]);
  }

  init() {
    fs.mkdirSync(this.gitDir, { recursive: true });
    runGit([`--git-dir=${this.gitDir}`, 'init', '--bare']);
    // Configure bare=false so work-tree operations work cleanly while GIT_DIR stays outside workTree
    runGit([`--git-dir=${this.gitDir}`, 'config', 'core.bare', 'false']);
    runGit([`--git-dir=${this.gitDir}`, 'config', 'core.autocrlf', 'false']);

    const excludePath = path.join(this.gitDir, 'info', 'exclude');
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
    fs.writeFileSync(
      excludePath,
      [
        '# CodeFleet shadow git exclusions',
        '.git',
        '.git/',
        'node_modules/',
        'dist/',
        'out/',
        'build/',
        '*.oversized',
      ].join('\n') + '\n',
      'utf8',
    );
  }

  createCheckpoint(label) {
    this.git(['add', '-A']);
    this.git(['commit', '--allow-empty', '-m', label]);
    return this.git(['rev-parse', 'HEAD']);
  }

  restoreCheckpoint(commitSha) {
    // 1. Find files tracked in current index that do NOT exist in target commitSha, plus untracked non-ignored files
    const currentTracked = this.git(['ls-files', '-z']).split('\0').filter(Boolean);
    const targetTracked = new Set(
      this.git(['ls-tree', '-r', '--name-only', '-z', commitSha]).split('\0').filter(Boolean),
    );
    const untracked = this.git(['ls-files', '--others', '--exclude-standard', '-z'])
      .split('\0')
      .filter(Boolean);

    for (const rel of [...currentTracked.filter((f) => !targetTracked.has(f)), ...untracked]) {
      if (rel === '.git' || rel.startsWith('.git/') || rel.startsWith('.git\\')) continue;
      const full = path.resolve(this.workTree, rel);
      if (full.startsWith(this.workTree + path.sep) && fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }

    // 2. Reset index and checkout files from target commitSha
    this.git(['read-tree', commitSha]);
    this.git(['checkout-index', '-f', '-a']);
  }
}

async function main() {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });

  console.log('=== SPIKE 01: Shadow Git & Missing-Git Fallback ===');

  // -------------------------------------------------------------------------
  // TEST 1: Project WITHOUT user .git, excluding node_modules & restoring
  // -------------------------------------------------------------------------
  const proj1 = path.join(TMP_ROOT, 'proj-no-git');
  const shadow1 = path.join(TMP_ROOT, 'appdata', 'proj-1', 'shadow.git');
  fs.mkdirSync(path.join(proj1, 'node_modules', 'heavy-pkg'), { recursive: true });
  fs.mkdirSync(path.join(proj1, 'src'), { recursive: true });
  fs.writeFileSync(path.join(proj1, 'node_modules', 'heavy-pkg', 'index.js'), 'module.exports = 42;\n');
  fs.writeFileSync(path.join(proj1, 'src', 'index.html'), '<h1>Tiệm Bánh Nhỏ</h1>\n', 'utf8');
  fs.writeFileSync(path.join(proj1, 'src', 'legacy.txt'), 'keep me before step 1\n', 'utf8');

  const sg1 = new ShadowGitPrototype(proj1, shadow1);
  sg1.init();
  const cp1 = sg1.createCheckpoint('step-1-before');

  // Simulate AI step changes: modify, add, delete
  fs.writeFileSync(path.join(proj1, 'src', 'index.html'), '<h1>Tiệm Bánh Lớn (AI sửa)</h1>\n', 'utf8');
  fs.writeFileSync(path.join(proj1, 'src', 'cart.js'), 'export const cart = [];\n', 'utf8');
  fs.rmSync(path.join(proj1, 'src', 'legacy.txt'));
  const cp2 = sg1.createCheckpoint('step-1-after');

  assert.notEqual(cp1, cp2);
  assert.equal(fs.existsSync(path.join(proj1, '.git')), false, 'Must NEVER create .git inside user project');

  // Verify node_modules was excluded from shadow git
  const trackedInCp2 = sg1.git(['ls-tree', '-r', '--name-only', cp2]);
  assert.equal(trackedInCp2.includes('node_modules'), false, 'node_modules must be excluded');

  // Undo back to cp1
  sg1.restoreCheckpoint(cp1);
  assert.equal(fs.readFileSync(path.join(proj1, 'src', 'index.html'), 'utf8'), '<h1>Tiệm Bánh Nhỏ</h1>\n');
  assert.equal(fs.existsSync(path.join(proj1, 'src', 'cart.js')), false, 'Added file must be removed on undo');
  assert.equal(fs.existsSync(path.join(proj1, 'src', 'legacy.txt')), true, 'Deleted file must be restored on undo');
  assert.equal(
    fs.existsSync(path.join(proj1, 'node_modules', 'heavy-pkg', 'index.js')),
    true,
    'Excluded node_modules must remain intact after undo',
  );
  console.log('[PASS] Test 1: Shadow git create/undo without .git in user folder, node_modules excluded & preserved.');

  // -------------------------------------------------------------------------
  // TEST 2: Project WITH existing user .git (verify .git/HEAD & .git/index untouched)
  // -------------------------------------------------------------------------
  const proj2 = path.join(TMP_ROOT, 'proj-with-user-git');
  const shadow2 = path.join(TMP_ROOT, 'appdata', 'proj-2', 'shadow.git');
  fs.mkdirSync(proj2, { recursive: true });
  runGit(['-C', proj2, 'init', '-b', 'main']);
  fs.writeFileSync(path.join(proj2, 'app.js'), 'const price = 25000;\n', 'utf8');
  runGit(['-C', proj2, 'add', 'app.js']);
  runGit(['-C', proj2, 'commit', '-m', 'user initial commit']);
  // Also stage a user file in user's own git index to prove even index bytes don't change!
  fs.writeFileSync(path.join(proj2, 'notes.md'), 'User staged note\n', 'utf8');
  runGit(['-C', proj2, 'add', 'notes.md']);

  const userHeadHashBefore = sha256File(path.join(proj2, '.git', 'HEAD'));
  const userIndexHashBefore = sha256File(path.join(proj2, '.git', 'index'));
  const userCommitBefore = runGit(['-C', proj2, 'rev-parse', 'HEAD']);

  const sg2 = new ShadowGitPrototype(proj2, shadow2);
  sg2.init();
  const uCpBefore = sg2.createCheckpoint('step-2-before');
  fs.writeFileSync(path.join(proj2, 'app.js'), 'const price = 30000;\nconst discount = 0.1;\n', 'utf8');
  const uCpAfter = sg2.createCheckpoint('step-2-after');
  sg2.restoreCheckpoint(uCpBefore);

  const userHeadHashAfter = sha256File(path.join(proj2, '.git', 'HEAD'));
  const userIndexHashAfter = sha256File(path.join(proj2, '.git', 'index'));
  const userCommitAfter = runGit(['-C', proj2, 'rev-parse', 'HEAD']);

  assert.equal(userHeadHashBefore, userHeadHashAfter, 'User .git/HEAD hash must be identical');
  assert.equal(userIndexHashBefore, userIndexHashAfter, 'User .git/index hash must be identical');
  assert.equal(userCommitBefore, userCommitAfter, 'User HEAD commit must be identical');
  assert.notEqual(uCpBefore, uCpAfter);
  console.log('[PASS] Test 2: Existing user .git (HEAD + index SHA-256) 100% untouched by shadow git.');

  // -------------------------------------------------------------------------
  // TEST 3: Mid-step rate_limit rollback + context handoff to fallback model
  // -------------------------------------------------------------------------
  const cpStep4Before = sg2.createCheckpoint('step-4-before');
  // Agent 1 (e.g. Gemini Pro) writes partial broken auth.js then hits rate_limit
  fs.writeFileSync(path.join(proj2, 'auth.js'), 'export function login(email) { /* truncated due to 429', 'utf8');
  // Executor catches rate_limit -> rolls back to cpStep4Before
  sg2.restoreCheckpoint(cpStep4Before);
  assert.equal(fs.existsSync(path.join(proj2, 'auth.js')), false, 'Partial broken file rolled back cleanly');

  const handoffContext = {
    completedSteps: [
      { seq: 1, summary: 'Khởi tạo app.js với giá sản phẩm', files: ['app.js'] },
    ],
    failedAttemptNote: 'Ô trước gặp giới hạn hạn mức giữa bước 4; thư mục đã khôi phục về đầu bước 4.',
    currentStepGoal: 'Thêm hàm đăng nhập kiểm tra email và mật khẩu vào auth.js',
  };
  assert.ok(handoffContext.currentStepGoal.length > 0);

  // Agent 2 (e.g. Claude Opus) receives handoffContext on clean workspace and finishes Step 4
  fs.writeFileSync(
    path.join(proj2, 'auth.js'),
    'export function login(email, password) {\n  return Boolean(email && password);\n}\n',
    'utf8',
  );
  const cpStep4After = sg2.createCheckpoint('step-4-after');
  assert.notEqual(cpStep4Before, cpStep4After);
  assert.equal(fs.existsSync(path.join(proj2, 'auth.js')), true);
  console.log('[PASS] Test 3: Mid-step rollback + structured context handoff verified.');

  // -------------------------------------------------------------------------
  // TEST 4: Missing system git fallback via isomorphic-git (pure JS, separated gitdir)
  // -------------------------------------------------------------------------
  const projIso = path.join(TMP_ROOT, 'proj-iso');
  const shadowIso = path.join(TMP_ROOT, 'appdata', 'proj-iso', 'shadow-iso.git');
  fs.mkdirSync(projIso, { recursive: true });
  fs.writeFileSync(path.join(projIso, 'hello.txt'), 'Xin chào v1\n', 'utf8');

  const t0 = performance.now();
  await gitIso.init({ fs, dir: projIso, gitdir: shadowIso, defaultBranch: 'main' });
  await gitIso.add({ fs, dir: projIso, gitdir: shadowIso, filepath: 'hello.txt' });
  const isoSha1 = await gitIso.commit({
    fs,
    dir: projIso,
    gitdir: shadowIso,
    message: 'iso-before',
    author: { name: 'CodeFleet', email: 'checkpoint@codefleet.local' },
  });

  fs.writeFileSync(path.join(projIso, 'hello.txt'), 'Xin chào v2 (AI sửa)\n', 'utf8');
  await gitIso.checkout({ fs, dir: projIso, gitdir: shadowIso, ref: isoSha1, force: true });
  const elapsedMs = Math.round(performance.now() - t0);

  assert.equal(fs.readFileSync(path.join(projIso, 'hello.txt'), 'utf8'), 'Xin chào v1\n');
  assert.equal(fs.existsSync(path.join(projIso, '.git')), false, 'isomorphic-git with gitdir leaves no .git in dir');
  console.log(`[PASS] Test 4: isomorphic-git pure-JS fallback works with separated gitdir (${elapsedMs}ms).`);

  // Cleanup temp test folder
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  console.log('=== ALL SHADOW GIT SPIKE TESTS PASSED ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
