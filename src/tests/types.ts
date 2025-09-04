export interface TestConfig {
    url: string;
    pattern: string;
    testName: string;
    verify: (actual: any) => boolean;
}

export interface TestResult {
    testName: string;
    url: string;
    actual: any;
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
