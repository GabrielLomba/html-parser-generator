import { ParserRequest, ParserResponse, ParserStorage } from '../types';
import { OpenAIService } from './openaiService';
import { generateUrlPattern } from '../utils/htmlExtractor';

export class ParserService {
    private openaiService: OpenAIService;
    private storage: ParserStorage;

    constructor(openaiApiKey: string, storage: ParserStorage) {
        this.openaiService = new OpenAIService(openaiApiKey);
        this.storage = storage;
    }

    async getParser(request: ParserRequest): Promise<ParserResponse> {
        const { url, html } = request;

        if (!url || !html) {
            throw new Error('URL and HTML are required');
        }

        const urlPattern = generateUrlPattern(url);

        const existingParser = await this.storage.get(urlPattern);
        if (existingParser) {
            return {
                parser: existingParser.parser,
                createdAt: existingParser.createdAt,
                cached: true,
                urlPattern,
            };
        }

        try {
            const parserCode = await this.openaiService.generateParser(url, html);

            const parser = await this.storage.set(urlPattern, parserCode);

            return {
                parser: parser.parser,
                createdAt: parser.createdAt,
                cached: false,
                urlPattern,
            };
        } catch (error) {
            console.error('Error generating parser:', error);
            throw new Error(`Failed to generate parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteParser(urlPattern: string): Promise<boolean> {
        return await this.storage.delete(urlPattern);
    }

    async getStats() {
        const allParsers = await this.storage.getAll();
        return {
            totalParsers: allParsers.length,
            parsers: allParsers.map(p => ({
                urlPattern: p.urlPattern,
                createdAt: p.createdAt
            }))
        };
    }
}
