// ESLint flat config for GJS (GNOME JavaScript) + Cinnamon desklet
export default [
    {
        ignores: ['node_modules/**', 'package.json', 'package-lock.json'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2018,
            sourceType: 'script',
            globals: {
                // GJS pure globals (NOT GI imports — those are const-imported per file)
                global: 'readonly',
                imports: 'readonly',
                console: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                // Cinnamon runtime globals
                St: 'readonly',
                // po.js provides `_` as a global function
                _: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'after-used', varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-undef': 'error',
            'no-console': 'off',
            'no-constant-condition': 'warn',
            'no-duplicate-imports': 'error',
            'no-unreachable': 'error',
            'eqeqeq': ['warn', 'always', { null: 'ignore' }],
            'curly': ['warn', 'multi-line'],
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-var': 'warn',
            'prefer-const': 'warn',
            'semi': ['warn', 'always'],
            'quotes': ['warn', 'single', { avoidEscape: true }],
            'comma-dangle': ['warn', 'never'],
            'no-trailing-spaces': 'warn',
            'eol-last': ['warn', 'always'],
            'indent': ['warn', 4, { SwitchCase: 1 }],
            'space-before-blocks': 'warn',
            'keyword-spacing': 'warn',
            'comma-spacing': 'warn',
            'object-curly-spacing': ['warn', 'always'],
            'array-bracket-spacing': ['warn', 'never'],
            'block-spacing': 'warn',
            'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
        },
    },
];
