import { describe, test, expect } from '@jest/globals';
import { logger } from '../../utils/logger';

describe('Logger', () => {
    test('should create logger instance', () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
    });

    test('should have correct log levels', () => {
        expect(logger.level).toBeDefined();
        expect(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).toContain(
            logger.level
        );
    });

    test('should have transports configured', () => {
        expect(logger.transports).toBeDefined();
        expect(logger.transports.length).toBeGreaterThan(0);
    });
});
