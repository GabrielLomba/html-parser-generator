import { createTestRunner } from './index';

async function runTests() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        console.error('Error: OPENAI_API_KEY environment variable is required');
        process.exit(1);
    }

    console.log('Running ground truth tests...\n');

    try {
        const testRunner = createTestRunner(openaiApiKey);
        const result = await testRunner.runAllTests();

        console.log(`\nTest Results:`);
        console.log(`Total Tests: ${result.totalTests}`);
        console.log(`Passed: ${result.passedTests}`);
        console.log(`Failed: ${result.failedTests}`);
        console.log(`Success Rate: ${result.totalTests > 0 ? ((result.passedTests / result.totalTests) * 100).toFixed(1) : 0}%\n`);

        for (const testResult of result.results) {
            const status = testResult.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - ${testResult.testName}`);
            console.log(`   URL: ${testResult.url}`);
            
            if (!testResult.passed) {
                if (testResult.error) {
                    console.log(`   Error: ${testResult.error}`);
                } else {
                    console.log(`   Expected: ${JSON.stringify(testResult.expected, null, 2)}`);
                    console.log(`   Actual: ${JSON.stringify(testResult.actual, null, 2)}`);
                }
            }
            console.log('');
        }

        if (result.failedTests > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error('Test execution failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}
