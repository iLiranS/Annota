import tailwindcss from '@tailwindcss/vite';
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
// @ts-ignore
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env": {
        EXPO_PUBLIC_SUPABASE_URL: env.VITE_SUPABASE_URL ?? "",
        EXPO_PUBLIC_SUPABASE_KEY: env.VITE_SUPABASE_KEY ?? "",
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? "",
        VITE_SUPABASE_KEY: env.VITE_SUPABASE_KEY ?? "",
      },
    },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        '@tiptap/core',
        '@tiptap/react',
        '@tiptap/pm',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-model'
      ],
      extensions: [
        '.desktop.tsx', '.desktop.ts', '.desktop.jsx', '.desktop.js',
        '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'
      ],
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    }
  };
});
