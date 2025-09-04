import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/tests/runTests.ts'],
    format: ['esm'],
    target: 'es2020',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    dts: true,
    splitting: false,
    minify: false,
    treeshake: true,
    esbuildOptions(options) {
        options.banner = {
            js: '#!/usr/bin/env node',
        };
    },
});
