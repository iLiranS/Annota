import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    plugins: [
        viteSingleFile(),
        {
            name: 'emit-editor-html',
            closeBundle() {
                const distDir = path.resolve(__dirname, 'dist');
                const htmlPath = path.resolve(distDir, 'index.html');
                if (fs.existsSync(htmlPath)) {
                    const html = fs.readFileSync(htmlPath, 'utf-8');
                    const jsContent = `export default ${JSON.stringify(html)};`;
                    fs.writeFileSync(path.resolve(distDir, 'editor-html.ts'), jsContent);
                    console.log('✅ Generated dist/editor-html.ts');
                }
            }
        }
    ],
    build: {
        target: 'esnext',
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        reportCompressedSize: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
