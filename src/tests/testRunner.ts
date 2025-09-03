import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { ParserService } from '../services/parserService';
import { TestConfig, TestResult, TestSuite, TestSuiteResult } from './types';

export class TestRunner {
    private parserService: ParserService;
    private testDataDir: string;

    constructor(parserService: ParserService, testDataDir: string = path.join(process.cwd(), 'src', 'tests', 'data')) {
        this.parserService = parserService;
        this.testDataDir = testDataDir;
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
            const parserResponse = await this.parserService.getParser({
                url: testConfig.url,
                html: testConfig.html
            });

            const parserFunction = new Function('$', parserResponse.parser);
            const $ = cheerio.load(testConfig.html);
            const actual = parserFunction($);

            const expected = await this.loadExpectedValues(testDir);

            const passed = JSON.stringify(actual) === JSON.stringify(expected);

            return {
                testName: testConfig.testName,
                url: testConfig.url,
                passed,
                expected,
                actual,
                parser: parserResponse.parser,
                urlPattern: parserResponse.urlPattern
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
