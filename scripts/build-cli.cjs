const path = require('node:path');

async function buildCli() {
  const { build } = await import('vite');
  const root = path.resolve(__dirname, '..');
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: 'error',
    resolve: { alias: { '@shared': path.join(root, 'src/shared') } },
    build: {
      ssr: path.join(root, 'src/main/cli/index.ts'),
      outDir: path.join(root, 'out/cli'),
      emptyOutDir: true,
      target: 'node22',
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  });
}

module.exports = { buildCli };
if (require.main === module) {
  buildCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
