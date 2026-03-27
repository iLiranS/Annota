import { defineConfig } from 'eslint/config';
import rootConfig from '../../eslint.config.mjs';

export default defineConfig([
  ...rootConfig,
  {
    ignores: [
      'dist/*',
      'src-tauri/*',
      'node_modules/*',
    ],
  },
]);
