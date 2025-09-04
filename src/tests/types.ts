export interface TestConfig {
    url: string;
    pattern: string;
    testName: string;
    verify: (_actual: Record<string, unknown>) => void;
}

export interface TestResult {
    testName: string;
    url: string;
    actual: Record<string, unknown> | null;
    error?: string;
    parser: string;
    urlPattern: string;
}

export interface TestSuite {
    tests: TestConfig[];
}

export interface TestSuiteResult {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: TestResult[];
}

export interface ParseResponse {
    result: Record<string, unknown>;
    urlPattern: string;
    parser: string;
}
