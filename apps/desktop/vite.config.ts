import tailwindcss from '@tailwindcss/vite';
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type UserConfig } from "vite";
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, __dirname, "");

  return {
    // We cast plugins to any to bypass TS complaining about 2D plugin arrays
    plugins: [react(), tailwindcss()] as any,
    define: {
      "process.env": {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? "",
        VITE_SUPABASE_KEY: env.VITE_SUPABASE_KEY ?? "",
        VITE_ENABLE_CLOUD: env.VITE_ENABLE_CLOUD ?? "false",
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
      alias: {
        // This maps imports starting with "@/" to your "src" directory
        "@": path.resolve(__dirname, "."),
      },
    },
    optimizeDeps: {
      exclude: [
        '@annota/core',
        '@annota/editor-core',
        '@annota/editor-ui',
      ]
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/src-tauri/**"] },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    }
  };
});