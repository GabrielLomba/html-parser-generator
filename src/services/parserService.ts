import { ParserRequest, ParserResponse, ParserStorage } from '../types';
import { OpenAIService } from './openaiService';
import { extractRelevantText, generateUrlPattern } from '../utils/htmlExtractor';

export class ParserService {
    private openaiService: OpenAIService;
    private storage: ParserStorage;

    constructor(openaiApiKey: string, storage: ParserStorage) {
        this.openaiService = new OpenAIService(openaiApiKey);
        this.storage = storage;
    }

    async getParser(request: ParserRequest): Promise<ParserResponse> {
        const { url, html } = request;

        // Validate inputs
        if (!url || !html) {
            throw new Error('URL and HTML are required');
        }

        // Generate URL pattern for caching
        const urlPattern = generateUrlPattern(url);

        // Check if we already have a parser for this URL pattern
        const existingParser = this.storage.get(urlPattern);
        if (existingParser) {
            return {
                parser: existingParser.parser,
                cached: true,
                urlPattern
            };
        }

        // Extract relevant text from HTML
        // const relevantText = extractRelevantText(html);

        // console.log('relevantText: ', relevantText);
        // if (!relevantText || relevantText.trim().length < 50) {
        //     throw new Error('Insufficient relevant text content found in HTML');
        // }

        try {
            // Generate new parser using OpenAI
            const parserCode = await this.openaiService.generateParser(url, html);

            // Store the parser for future use
            this.storage.set(urlPattern, parserCode);

            return {
                parser: parserCode,
                cached: false,
                urlPattern
            };
        } catch (error) {
            console.error('Error generating parser:', error);
            throw new Error(`Failed to generate parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get statistics about stored parsers
     */
    getStats() {
        const allParsers = this.storage.getAll();
        return {
            totalParsers: allParsers.length,
            parsers: allParsers.map(p => ({
                urlPattern: p.urlPattern,
                createdAt: p.createdAt
            }))
        };
    }
}
