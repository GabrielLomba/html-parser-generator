import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { createRoutes } from '../api/routes';
import { ParserService } from '../services/parserService';
import { DiskParserStorage } from '../storage/diskParserStorage';
import { TestConfig, TestResult, TestSuite, TestSuiteResult } from './types';
import { logger } from '../utils/logger';
import assert from 'assert';
import dotenv from 'dotenv';

dotenv.config();

export class TestRunner {
    private app: express.Application;
    private server: any;
    private testDataDir: string;
    private baseUrl: string;

    constructor(
        openaiApiKey: string,
        testDataDir: string = path.join(process.cwd(), 'src', 'tests', 'data')
    ) {
        this.testDataDir = testDataDir;
        this.baseUrl = 'http://localhost:3001';

        const storage = new DiskParserStorage();
        const parserService = new ParserService(openaiApiKey, storage);

        this.app = express();
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use('/api', createRoutes(parserService));
    }

    async startServer(): Promise<void> {
        return new Promise(resolve => {
            this.server = this.app.listen(3001, () => {
                logger.info('Test server started on port 3001');
                resolve();
            });
        });
    }

    async stopServer(): Promise<void> {
        if (this.server) {
            return new Promise(resolve => {
                this.server.close(() => {
                    logger.info('Test server stopped');
                    resolve();
                });
            });
        }
    }

    private async loadTestConfig(testDir: string): Promise<TestConfig> {
        const configPath = path.join(testDir, 'config.js');
        return require(configPath).default;
    }

    private async discoverTestDirectories(): Promise<string[]> {
        const entries = await fs.promises.readdir(this.testDataDir, { withFileTypes: true });
        const testDirs: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const testDir = path.join(this.testDataDir, entry.name);
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

    private async executeTest(testConfig: TestConfig, testDir: string): Promise<TestResult> {
        try {
            const htmlFilePath = path.join(testDir, 'input.html');
            const html = await fs.promises.readFile(htmlFilePath, 'utf8');

            const response = await fetch(`${this.baseUrl}/api/parse`, {
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

            const parseResponse = (await response.json()) as any;
            const actual = parseResponse.result;

            assert.equal(
                parseResponse.urlPattern,
                testConfig.pattern,
                'URL pattern does not match'
            );
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

    async runAllTests(): Promise<TestSuiteResult> {
        await this.startServer();

        try {
            const testDirs = await this.discoverTestDirectories();
            const results: TestResult[] = [];

            for (const testDir of testDirs) {
                const testConfig = await this.loadTestConfig(testDir);
                const result = await this.executeTest(testConfig, testDir);
                results.push(result);
            }

            const passedTests = results.filter(r => !r.error).length;
            const failedTests = results.length - passedTests;

            return {
                totalTests: results.length,
                passedTests,
                failedTests,
                results,
            };
        } finally {
            await this.stopServer();
        }
    }

    async runTest(testConfig: TestConfig, testDir: string): Promise<TestResult> {
        return await this.executeTest(testConfig, testDir);
    }

    async runTestSuite(testSuite: TestSuite): Promise<TestSuiteResult> {
        const results: TestResult[] = [];

        for (const testConfig of testSuite.tests) {
            const result = await this.executeTest(testConfig, '');
            results.push(result);
        }

        const passedTests = results.filter(r => !r.error).length;
        const failedTests = results.length - passedTests;

        return {
            totalTests: results.length,
            passedTests,
            failedTests,
            results,
        };
    }
}
