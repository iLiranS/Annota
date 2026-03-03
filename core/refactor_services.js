const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const servicesDir = path.join(__dirname, 'src/services');
const syncDir = path.join(__dirname, 'src/sync');

// Just fixing the imports of `getAsyncDbDriver` and removing `Async(...)` function calls.
function processFiles(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            processFiles(res);
        } else if (res.endsWith('.ts') || res.endsWith('.tsx')) {
            let code = fs.readFileSync(res, 'utf-8');
            let original = code;

            // Remove Async suffix from repo function calls
            // e.g. foldersRepo.getFolderByIdAsync -> foldersRepo.getFolderById
            code = code.replace(/([a-zA-Z0-9_]+)Async(?=\s*\()/g, '$1');

            // Also replace import statements
            code = code.replace(/([a-zA-Z0-9_]+)Async(?=[,}])/g, '$1');

            if (code !== original) {
                fs.writeFileSync(res, code);
                console.log(`Updated names in ${res}`);
            }
        }
    });
}

processFiles(servicesDir);
processFiles(syncDir);
