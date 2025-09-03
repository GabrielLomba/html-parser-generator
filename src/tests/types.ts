export interface TestConfig {
    url: string;
    html: string;
    testName: string;
}

export interface TestResult {
    testName: string;
    url: string;
    passed: boolean;
    expected: any;
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
