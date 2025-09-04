import { StoredParser, ParserStorage } from '../types';

export class InMemoryParserStorage implements ParserStorage {
    private parsers: Map<string, StoredParser> = new Map();

    async get(urlPattern: string): Promise<StoredParser | null> {
        return this.parsers.get(urlPattern) || null;
    }

    async set(urlPattern: string, parser: string): Promise<StoredParser> {
        const storedParser: StoredParser = {
            urlPattern,
            parser,
            createdAt: new Date(),
        };
        this.parsers.set(urlPattern, storedParser);
        return storedParser;
    }

    async has(urlPattern: string): Promise<boolean> {
        return this.parsers.has(urlPattern);
    }

    async getAll(limit: number = 10): Promise<StoredParser[]> {
        return Array.from(this.parsers.values()).slice(0, limit);
    }

    async delete(urlPattern: string): Promise<boolean> {
        return this.parsers.delete(urlPattern);
    }

    async size(): Promise<number> {
        return this.parsers.size;
    }
}
