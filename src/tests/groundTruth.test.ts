import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { createRoutes } from '../api/routes';
import { ParserService } from '../services/parserService';
import { DiskParserStorage } from '../storage/diskParserStorage';
import { OpenAIService } from '../generator/openaiService';
import { ParseResponse, TestConfig, TestResult } from './types';
import { logger } from '../utils/logger';
import { Server } from 'http';

class TestServer {
    private app: express.Application;
    private server: Server | null = null;
    private baseUrl: string = 'http://localhost:3001';

    constructor(openaiApiKey: string) {
        const storage = new DiskParserStorage();
        const parserGenerator = new OpenAIService(openaiApiKey);
        const parserService = new ParserService(parserGenerator, storage);

        this.app = express();
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use('/api', createRoutes(parserService));
    }

    async start(): Promise<void> {
        return new Promise(resolve => {
            this.server = this.app.listen(3001, () => {
                logger.info('Test server started on port 3001');
                resolve();
            });
        });
    }

    async stop(): Promise<void> {
        if (this.server) {
            return new Promise(resolve => {
                this.server?.close(() => {
                    logger.info('Test server stopped');
                    resolve();
                });
            });
        }
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }
}

describe('Ground Truth Tests', () => {
    let testServer: TestServer;
    const testDataDir = path.join(process.cwd(), 'src', 'tests', 'data');

    beforeAll(async () => {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }

        testServer = new TestServer(openaiApiKey);
        await testServer.start();
    });

    afterAll(async () => {
        if (testServer) {
            await testServer.stop();
        }
    });

    async function loadTestConfig(testDir: string): Promise<TestConfig> {
        const configPath = path.join(testDir, 'config.js');
        return import(configPath).then(module => module.default);
    }

    async function discoverTestDirectories(): Promise<string[]> {
        const entries = await fs.promises.readdir(testDataDir, { withFileTypes: true });
        const testDirs: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const testDir = path.join(testDataDir, entry.name);
                const configPath = path.join(testDir, 'config.js');

                try {
                    await fs.promises.access(configPath);
                    testDirs.push(testDir);
                } catch {
                    logger.warn(`Skipping ${entry.name}: missing config.js`);
                }
            }
        }

        return testDirs;
    }

    async function executeTest(testConfig: TestConfig, testDir: string): Promise<TestResult> {
        try {
            const htmlFilePath = path.join(testDir, 'input.html');
            const html = await fs.promises.readFile(htmlFilePath, 'utf8');

            const response = await fetch(`${testServer.getBaseUrl()}/api/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shortened_url: testConfig.url,
                    scrape: html,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const parseResponse = (await response.json()) as ParseResponse;
            const actual = parseResponse.result;

            expect(parseResponse.urlPattern).toBe(testConfig.pattern);
            testConfig.verify(actual);

            return {
                testName: testConfig.testName,
                url: testConfig.url,
                actual,
                parser: parseResponse.parser || '',
                urlPattern: parseResponse.urlPattern || '',
            };
        } catch (error) {
            return {
                testName: testConfig.testName,
                url: testConfig.url,
                actual: null,
                error: error instanceof Error ? error.message : 'Unknown error',
                parser: '',
                urlPattern: '',
            };
        }
    }

    test('should run all ground truth tests', async () => {
        const testDirs = await discoverTestDirectories();
        const results: TestResult[] = [];

        for (const testDir of testDirs) {
            const testConfig = await loadTestConfig(testDir);
            const result = await executeTest(testConfig, testDir);
            results.push(result);
        }

        const passedTests = results.filter(r => !r.error).length;
        const failedTests = results.length - passedTests;

        logger.info('Test Results:', {
            totalTests: results.length,
            passedTests,
            failedTests,
            successRate: results.length > 0 ? ((passedTests / results.length) * 100).toFixed(1) : 0,
        });

        for (const testResult of results) {
            const status = testResult.error ? '❌ FAIL' : '✅ PASS';
            logger.info(`${status} - ${testResult.testName}`, {
                url: testResult.url,
                error: testResult.error,
            });
        }

        expect(failedTests).toBe(0);
    }, 60000); // 60 second timeout for the entire test suite

    // Individual test cases for better granular reporting
    test('Wikipedia Prometheus page should parse correctly', async () => {
        const testDir = path.join(testDataDir, 'wikipedia');
        const testConfig = await loadTestConfig(testDir);
        const result = await executeTest(testConfig, testDir);

        expect(result.error).toBeUndefined();
        expect(result.actual).toBeDefined();
        expect(result.urlPattern).toBe(testConfig.pattern);
    }, 30000);

    test('Dot.ca.gov page should parse correctly', async () => {
        const testDir = path.join(testDataDir, 'dot-ca');
        const testConfig = await loadTestConfig(testDir);
        const result = await executeTest(testConfig, testDir);

        expect(result.error).toBeUndefined();
        expect(result.actual).toBeDefined();
        expect(result.urlPattern).toBe(testConfig.pattern);
    }, 30000);
});
