import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const sharedAliases = {
  '@renderer': resolve('src/renderer'),
  '@shared': resolve('src/shared'),
};

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    projects: [
      {
        resolve: { alias: sharedAliases },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          testTimeout: 20000,
          include: ['src/{main,preload,shared}/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAliases },
        test: {
          name: 'renderer',
          globals: true,
          environment: 'jsdom',
          testTimeout: 20000,
          setupFiles: ['./src/renderer/test-setup.ts'],
          include: ['src/renderer/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
