import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lowlightCore = path.resolve(__dirname, '../../node_modules/lowlight/lib/index.js');


export default defineConfig({
    plugins: [
        viteSingleFile(),
        {
            name: 'emit-editor-html',
            closeBundle() {
                const distDir = path.resolve(__dirname, 'dist');
                const htmlPath = path.resolve(distDir, 'index.html');
                if (fs.existsSync(htmlPath)) {
                    let html = fs.readFileSync(htmlPath, 'utf-8');
                    
                    // Strip heavy base64 font payloads for unused .ttf and .woff formats
                    html = html.replace(/data:font\/(ttf|woff);base64,[^'")]+/gi, 'data:font/$1;base64,');
                    
                    // Clean up unused format rules to keep CSS parsing lightweight
                    html = html.replace(/,url\s*\(\s*['"]?data:font\/(ttf|woff);base64,['"]?\s*\)\s*format\s*\([^)]+\)/gi, '');
                    
                    fs.writeFileSync(htmlPath, html, 'utf-8');
                    const jsContent = `export default ${JSON.stringify(html)};`;
                    fs.writeFileSync(path.resolve(distDir, 'editor-html.ts'), jsContent);
                    
                    const stats = fs.statSync(htmlPath);
                    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(`✅ Generated dist/editor-html.ts (Optimized size: ${sizeMB} MB)`);
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
    optimizeDeps: {
        exclude: ['highlight.js', 'lowlight.js']
    },
    resolve: {
        alias: {
            // Stub out the all/common re-exports from the root entry point
            // so only createLowlight gets bundled
            'lowlight$': lowlightCore,
        }
    },
});
