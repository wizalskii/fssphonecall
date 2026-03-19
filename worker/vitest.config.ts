import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@fssphone/shared': path.resolve(__dirname, '../shared/dist'),
    },
  },
});
