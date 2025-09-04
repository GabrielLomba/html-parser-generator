import { describe, test, expect, jest } from '@jest/globals';
import { generateUrlPattern } from '../../utils/htmlExtractor';

jest.mock('../../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
    getErrorInfo: jest.fn((error: Error) => error.message || 'Unknown error'),
}));

describe('generateUrlPattern', () => {
    describe('Basic URL pattern generation', () => {
        test('should generate pattern for simple path', () => {
            const result = generateUrlPattern('https://example.com/about');
            expect(result).toBe('example.com/about');
        });

        test('should generate pattern for nested path', () => {
            const result = generateUrlPattern('https://example.com/users/profile');
            expect(result).toBe('example.com/users/profile');
        });

        test('should generate pattern for root path', () => {
            const result = generateUrlPattern('https://example.com/');
            expect(result).toBe('example.com');
        });

        test('should handle URL without protocol', () => {
            const result = generateUrlPattern('example.com/about');
            expect(result).toBe('example.com/about');
        });

        test('should handle URL with http protocol', () => {
            const result = generateUrlPattern('http://example.com/about');
            expect(result).toBe('example.com/about');
        });
    });

    describe('Numeric ID pattern generation', () => {
        test('should replace numeric segments with {id}', () => {
            const result = generateUrlPattern('https://example.com/users/123');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should replace multiple numeric segments', () => {
            const result = generateUrlPattern('https://example.com/users/123/posts/456');
            expect(result).toBe('example.com/users/{id}/posts/{id}');
        });

        test('should handle large numeric IDs', () => {
            const result = generateUrlPattern('https://example.com/items/999999999');
            expect(result).toBe('example.com/items/{id}');
        });

        test('should handle zero as numeric ID', () => {
            const result = generateUrlPattern('https://example.com/users/0');
            expect(result).toBe('example.com/users/{id}');
        });
    });

    describe('UUID pattern generation', () => {
        test('should replace UUID-like segments with {uuid}', () => {
            const result = generateUrlPattern('https://example.com/users/123e4567-e89b-12d3-a456-426614174000');
            expect(result).toBe('example.com/users/{uuid}');
        });

        test('should replace UUID without hyphens', () => {
            const result = generateUrlPattern('https://example.com/users/123e4567e89b12d3a456426614174000');
            expect(result).toBe('example.com/users/{uuid}');
        });
    });

    describe('Long ID pattern generation', () => {
        test('should replace long segments with {id}', () => {
            const result = generateUrlPattern('https://example.com/users/verylongsegmentname');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should replace segments with 20+ characters', () => {
            const result = generateUrlPattern('https://example.com/users/thisisverylongsegment');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should preserve short meaningful segments', () => {
            const result = generateUrlPattern('https://example.com/users/profile');
            expect(result).toBe('example.com/users/profile');
        });
    });

    describe('String ID pattern generation', () => {
        test('should detect PascalCase ids', () => {
            const result = generateUrlPattern('en.wikipedia.org/wiki/Prometheus');
            expect(result).toBe('en.wikipedia.org/wiki/{id}');
        });
    });

    describe('Complex URL patterns', () => {
        test('should handle mixed segment types', () => {
            const result = generateUrlPattern('https://example.com/users/123/posts/abc123def456');
            expect(result).toBe('example.com/users/{id}/posts/{uuid}');
        });

        test('should handle query parameters (ignored)', () => {
            const result = generateUrlPattern('https://example.com/users/123?page=1&limit=10');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should handle fragments (ignored)', () => {
            const result = generateUrlPattern('https://example.com/users/123#section');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should handle multiple slashes', () => {
            const result = generateUrlPattern('https://example.com//users///123');
            expect(result).toBe('example.com/users/{id}');
        });
    });

    describe('Edge cases', () => {
        test('should handle empty path', () => {
            const result = generateUrlPattern('https://example.com');
            expect(result).toBe('example.com');
        });

        test('should handle single slash path', () => {
            const result = generateUrlPattern('https://example.com/');
            expect(result).toBe('example.com');
        });

        test('should handle path with only slashes', () => {
            const result = generateUrlPattern('https://example.com///');
            expect(result).toBe('example.com');
        });

        test('should handle subdomain', () => {
            const result = generateUrlPattern('https://api.example.com/users/123');
            expect(result).toBe('api.example.com/users/{id}');
        });

        test('should handle port in URL', () => {
            const result = generateUrlPattern('https://example.com:8080/users/123');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should handle URL with utf-8 characters', () => {
            const result = generateUrlPattern('https://example.com/users/123\x00invalid');
            expect(result).toBe('example.com/users/{id}');
        });
    });

    describe('Error handling', () => {
        test('should return original URL on invalid URL', () => {
            const invalidUrl = 'not-a-valid-url';
            const result = generateUrlPattern(invalidUrl);
            expect(result).toBe(invalidUrl);
        });

        test('should handle malformed URL', () => {
            const malformedUrl = 'https://';
            const result = generateUrlPattern(malformedUrl);
            expect(result).toBe(malformedUrl);
        });
    });

    describe('Real-world URL examples', () => {
        test('should handle e-commerce product URLs', () => {
            const result = generateUrlPattern('https://shop.example.com/products/12345');
            expect(result).toBe('shop.example.com/products/{id}');
        });

        test('should handle blog post URLs', () => {
            const result = generateUrlPattern('https://blog.example.com/posts/my-awesome-post');
            expect(result).toBe('blog.example.com/posts/my-awesome-post');
        });

        test('should handle news article URLs', () => {
            const result = generateUrlPattern('https://news.example.com/articles/breaking-news-story');
            expect(result).toBe('news.example.com/articles/breaking-news-story');
        });

        test('should handle user profile URLs', () => {
            const result = generateUrlPattern('https://social.example.com/users/john-doe-12345');
            expect(result).toBe('social.example.com/users/{id}');
        });
    });

    describe('isLikelyId function behavior', () => {
        test('should handle segments with non-ASCII characters', () => {
            const result = generateUrlPattern('https://example.com/users/用户123');
            expect(result).toBe('example.com/users/{id}');
        });

        test('should handle kebab-case segments', () => {
            const result = generateUrlPattern('https://example.com/my-awesome-post');
            expect(result).toBe('example.com/my-awesome-post');
        });

        test('should handle PascalCase segments', () => {
            const result = generateUrlPattern('https://example.com/MyAwesomePost');
            expect(result).toBe('example.com/MyAwesomePost');
        });

        test('should handle underscore-separated segments', () => {
            const result = generateUrlPattern('https://example.com/my_awesome_post');
            expect(result).toBe('example.com/my_awesome_post');
        });

        test('should handle dot-separated segments', () => {
            const result = generateUrlPattern('https://example.com/my.awesome.post');
            expect(result).toBe('example.com/my.awesome.post');
        });

        test('should handle common path words', () => {
            const result = generateUrlPattern('https://example.com/about');
            expect(result).toBe('example.com/about');
        });

        test('should handle alphanumeric IDs', () => {
            const result = generateUrlPattern('https://example.com/users/abc123def456');
            expect(result).toBe('example.com/users/{uuid}');
        });
    });
});
