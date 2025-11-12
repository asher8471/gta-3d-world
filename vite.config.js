import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  server: {
    open: true,
    host: true
  },
  plugins: command === 'build' ? [viteSingleFile()] : [],
  build: {
    reportCompressedSize: false,
    cssCodeSplit: false
  }
}));
