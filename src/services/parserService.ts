import { ParserGenerator, ParserRequest, ParserResponse, ParserStorage } from '../types';
import { generateUrlPattern } from '../utils/htmlExtractor';
import { logger, getErrorInfo } from '../utils/logger';

export class ParserService {
    private parserGenerator: ParserGenerator;
    private storage: ParserStorage;
    private ongoingRequests: Map<string, Promise<ParserResponse>> = new Map();

    constructor(parserGenerator: ParserGenerator, storage: ParserStorage) {
        this.parserGenerator = parserGenerator;
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

        return await this.generateParser(url, html, urlPattern);
    }

    async deleteParser(urlPattern: string): Promise<boolean> {
        return await this.storage.delete(urlPattern);
    }

    async getStats() {
        const allParsers = await this.storage.getAll(10);
        const totalParsers = await this.storage.size();
        const generatorStats = this.parserGenerator.getStats();
        return {
            totalParsers,
            parsers: allParsers.map(p => ({
                urlPattern: p.urlPattern,
                createdAt: p.createdAt,
            })),
            generatorStats,
        };
    }

    private async generateParser(
        url: string,
        html: string,
        urlPattern: string
    ): Promise<ParserResponse> {
        const existingRequest = this.ongoingRequests.get(urlPattern);
        if (existingRequest) {
            logger.info(`Waiting for ongoing parser generation for URL pattern: ${urlPattern}`);
            return await existingRequest;
        }

        const requestPromise = this.performParserGeneration(url, html, urlPattern);

        this.ongoingRequests.set(urlPattern, requestPromise);

        try {
            return await requestPromise;
        } finally {
            this.ongoingRequests.delete(urlPattern);
        }
    }

    private async performParserGeneration(
        url: string,
        html: string,
        urlPattern: string
    ): Promise<ParserResponse> {
        try {
            const parserCode = await this.parserGenerator.generateParser(url, html);

            const parser = await this.storage.set(urlPattern, parserCode);

            return {
                parser: parser.parser,
                createdAt: parser.createdAt,
                cached: false,
                urlPattern,
            };
        } catch (error) {
            logger.error('Error generating parser:', getErrorInfo(error));
            throw new Error(
                `Failed to generate parser: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
