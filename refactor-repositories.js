const fs = require('fs');
const path = require('path');
const repoDir = path.join(process.cwd(), 'lib/db/repositories');

['folders.repository.ts', 'images.repository.ts', 'notes.repository.ts', 'tasks.repository.ts'].forEach(file => {
    let content = fs.readFileSync(path.join(repoDir, file), 'utf8');

    content = content.replace(/import { db, /g, "import { ");
    content = content.replace(/import { db }/g, "import {}");

    content = content.replace(/\bdb\b/g, 'getDb()');

    content = "import { getDb } from '@/stores/db-store';\n" + content;

    fs.writeFileSync(path.join(repoDir, file), content);
});
console.log('Repositories refactored.');
