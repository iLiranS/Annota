import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/ban-ts-comment": "warn",
            "@typescript-eslint/no-this-alias": "warn",
            "no-case-declarations": "warn",
            "no-empty": "warn",
            "prefer-const": "warn",
            "no-unused-expressions": "warn",
            "@typescript-eslint/no-unused-expressions": "warn",
            "no-useless-escape": "warn",
            "@typescript-eslint/no-require-imports": "warn",
        }
    },
    {
        plugins: {
            'react-hooks': reactHooks,
            'react': reactPlugin,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
        }
    }
);