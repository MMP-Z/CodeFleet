import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const sharedAliases = {
  '@renderer': resolve('src/renderer'),
  '@shared': resolve('src/shared'),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: sharedAliases },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
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
          setupFiles: ['./src/renderer/test-setup.ts'],
          include: ['src/renderer/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
