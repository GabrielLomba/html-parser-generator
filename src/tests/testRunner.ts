import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import express from 'express';
import FormData from 'form-data';
import { createRoutes } from '../api/routes';
import { ParserService } from '../services/parserService';
import { DiskParserStorage } from '../storage/diskParserStorage';
import { TestConfig, TestResult, TestSuite, TestSuiteResult } from './types';

export class TestRunner {
    private app: express.Application;
    private server: any;
    private testDataDir: string;
    private baseUrl: string;

    constructor(openaiApiKey: string, testDataDir: string = path.join(process.cwd(), 'src', 'tests', 'data')) {
        this.testDataDir = testDataDir;
        this.baseUrl = 'http://localhost:3001';
        
        const storage = new DiskParserStorage();
        const parserService = new ParserService(openaiApiKey, storage);
        
        this.app = express();
        this.app.use(express.json());
        this.app.use('/api', createRoutes(parserService));
    }

    async startServer(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(3001, () => {
                console.log('Test server started on port 3001');
                resolve();
            });
        });
    }

    async stopServer(): Promise<void> {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('Test server stopped');
                    resolve();
                });
            });
        }
    }

    private async loadExpectedValues(testDir: string): Promise<any> {
        const expectedPath = path.join(testDir, 'expected.json');
        const data = await fs.promises.readFile(expectedPath, 'utf8');
        return JSON.parse(data);
    }

    private async loadTestConfig(testDir: string): Promise<TestConfig> {
        const configPath = path.join(testDir, 'config.json');
        const data = await fs.promises.readFile(configPath, 'utf8');
        return JSON.parse(data);
    }

    private async discoverTestDirectories(): Promise<string[]> {
        const entries = await fs.promises.readdir(this.testDataDir, { withFileTypes: true });
        const testDirs: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const testDir = path.join(this.testDataDir, entry.name);
                const configPath = path.join(testDir, 'config.json');
                const expectedPath = path.join(testDir, 'expected.json');
                
                try {
                    await fs.promises.access(configPath);
                    await fs.promises.access(expectedPath);
                    testDirs.push(testDir);
                } catch {
                    console.warn(`Skipping ${entry.name}: missing config.json or expected.json`);
                }
            }
        }

        return testDirs;
    }

    private async executeTest(testConfig: TestConfig, testDir: string): Promise<TestResult> {
        try {
            const htmlFilePath = path.join(testDir, 'input.html');
            const form = new FormData();
            form.append('url', testConfig.url);
            form.append('html', fs.createReadStream(htmlFilePath), {
                filename: 'input.html',
                contentType: 'text/html',
            });

            const response = await fetch(`${this.baseUrl}/api/parse`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });

            if (!response.ok) {
                console.log(`Body: ${await response.text()}`);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const parseResponse = await response.json() as any;
            const actual = parseResponse.result;

            const expected = await this.loadExpectedValues(testDir);

            const passed = JSON.stringify(actual) === JSON.stringify(expected);

            return {
                testName: testConfig.testName,
                url: testConfig.url,
                passed,
                expected,
                actual,
                parser: parseResponse.parser || '',
                urlPattern: parseResponse.urlPattern || ''
            };
        } catch (error) {
            return {
                testName: testConfig.testName,
                url: testConfig.url,
                passed: false,
                expected: null,
                actual: null,
                error: error instanceof Error ? error.message : 'Unknown error',
                parser: '',
                urlPattern: ''
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

            const passedTests = results.filter(r => r.passed).length;
            const failedTests = results.length - passedTests;

            return {
                totalTests: results.length,
                passedTests,
                failedTests,
                results
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

        const passedTests = results.filter(r => r.passed).length;
        const failedTests = results.length - passedTests;

        return {
            totalTests: results.length,
            passedTests,
            failedTests,
            results
        };
    }
}
