const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            let code = fs.readFileSync(fullPath, 'utf8');
            let original = code;
            code = code.replace(/([a-zA-Z0-9_]+)Async(?=\()/g, '$1');
            code = code.replace(/([a-zA-Z0-9_]+)Async(?=[,\}])/g, '$1');
            if (code !== original) {
                fs.writeFileSync(fullPath, code);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir(path.join(__dirname, 'src/stores'));
