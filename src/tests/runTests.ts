import { TestRunner } from './testRunner';
import { logger, getErrorInfo } from '../utils/logger';

async function runTests() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        logger.error('OPENAI_API_KEY environment variable is required');
        process.exit(1);
    }

    logger.info('Running ground truth tests...');

    try {
        const testRunner = new TestRunner(openaiApiKey);
        const result = await testRunner.runAllTests();

        logger.info('Test Results:', {
            totalTests: result.totalTests,
            passedTests: result.passedTests,
            failedTests: result.failedTests,
            successRate:
                result.totalTests > 0
                    ? ((result.passedTests / result.totalTests) * 100).toFixed(1)
                    : 0,
        });

        for (const testResult of result.results) {
            const status = testResult.error ? '❌ FAIL' : '✅ PASS';
            logger.info(`${status} - ${testResult.testName}`, {
                url: testResult.url,
                error: testResult.error,
            });
        }

        if (result.failedTests > 0) {
            process.exit(1);
        }
    } catch (error) {
        logger.error('Test execution failed:', getErrorInfo(error));
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}
