import fs from 'node:fs';
import path from 'node:path';

const gitHooksDir = path.resolve(process.cwd(), '.git', 'hooks');

if (fs.existsSync(gitHooksDir)) {
  const preCommitPath = path.join(gitHooksDir, 'pre-commit');
  const script = `#!/bin/sh
set -e
echo "[CodeFleet pre-commit] Running lint & typecheck..."
pnpm run lint
pnpm run typecheck
`;
  fs.writeFileSync(preCommitPath, script, { encoding: 'utf8', mode: 0o755 });
  console.log('[setup-hooks] Installed .git/hooks/pre-commit');
}

