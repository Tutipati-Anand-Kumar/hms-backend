export default {
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],
    verbose: true,
    setupFilesAfterEnv: ['./tests/setup.js'],
    coverageDirectory: './coverage',
    collectCoverageFrom: [
        'controllers/**/*.js',
        'models/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**',
    ],
    testTimeout: 30000,
    transform: {}, // Disable transformation to let Node handle ESM natively
};
