const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const coreDir = path.join(__dirname, 'src/db/repositories');
const filesToProcess = ['notes.repository.ts', 'folders.repository.ts', 'tasks.repository.ts', 'images.repository.ts'];

for (const file of filesToProcess) {
    const filePath = path.join(coreDir, file);
    let code = fs.readFileSync(filePath, 'utf-8');

    // Parse the file
    let sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

    // We will collect replacements to apply backwards
    let replacements = [];

    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name) {
            const funcName = node.name.text;

            // 1. Delete tryGetAsyncDbDriver
            if (funcName === 'tryGetAsyncDbDriver') {
                replacements.push({ start: node.getFullStart(), end: node.getEnd(), text: '' });
                return;
            }

            // 2. Delete *Async duplicates
            if (funcName.endsWith('Async')) {
                // remove the entire function
                replacements.push({ start: node.getFullStart(), end: node.getEnd(), text: '' });
                return; // don't traverse inside
            } else {
                // 3. Convert `export function Foo` to `export async function Foo`
                // Ensure it has `async` modifier
                let hasAsync = node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
                if (!hasAsync && node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                    // Find the 'function' keyword
                    const functionKeyword = node.getChildren().find(c => c.kind === ts.SyntaxKind.FunctionKeyword);
                    if (functionKeyword) {
                        replacements.push({ start: functionKeyword.getStart(), end: functionKeyword.getStart(), text: 'async ' });
                    }
                }

                // Convert return type to Promise<T>
                if (node.type && node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                    const typeText = node.type.getText();
                    if (!typeText.startsWith('Promise<')) {
                        replacements.push({ start: node.type.getStart(), end: node.type.getEnd(), text: `Promise<${typeText}>` });
                    }
                }
            }
        }

        // 4. Transform `tx.select()...run()` or `.get()` or `.all()` or `.values()`
        if (ts.isCallExpression(node)) {
            const exp = node.expression;
            if (ts.isPropertyAccessExpression(exp) && exp.name) {
                const propName = exp.name.text;
                if (['run', 'get', 'all', 'values', 'execute'].includes(propName)) {
                    // Check if it's preceded by `await` already
                    if (node.parent && node.parent.kind !== ts.SyntaxKind.AwaitExpression) {
                        // Check if it's a Drizzle chain that started with `tx.` or `getDb()`, etc.
                        // For simplicity, ANY `.run()/.get()/.all()/.values()` that isn't `await`ed and is a call will be prepended with `await `.
                        // WAIT: Arrays have `.values()`. Maybe we should only replace if we know it's a db tx chain?
                        // Let's just prepend `await ` to the entire CallExpression.
                        // But wait, if it's `tx.insert(...).run()`, `node.getStart()` might be `tx.insert`.
                        // Yes! `await tx.insert(...).run()` is correct!
                        replacements.push({ start: node.getStart(), end: node.getStart(), text: 'await ' });
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    // Apply replacements backwards to preserve positions
    replacements.sort((a, b) => b.start - a.start);

    for (const rep of replacements) {
        code = code.slice(0, rep.start) + rep.text + code.slice(rep.end);
    }

    fs.writeFileSync(filePath, code);
    console.log(`Processed ${file}`);
}
