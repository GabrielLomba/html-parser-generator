import { TestRunner } from './testRunner';
import { ParserService } from '../services/parserService';
import { DiskParserStorage } from '../storage/diskParserStorage';
import { TestConfig, TestSuite } from './types';

export { TestConfig, TestSuite } from './types';
export { TestRunner } from './testRunner';

export function createTestRunner(openaiApiKey: string): TestRunner {
    const storage = new DiskParserStorage();
    const parserService = new ParserService(openaiApiKey, storage);
    return new TestRunner(parserService);
}

export function createTestConfig(
    testName: string,
    url: string,
    html: string
): TestConfig {
    return {
        testName,
        url,
        html
    };
}

export function createTestSuite(tests: TestConfig[]): TestSuite {
    return { tests };
}
