import { StoredParser, ParserStorage } from '../types';

/**
 * In-memory storage for parsers
 * In a production environment, this would be replaced with a database
 */
export class InMemoryParserStorage implements ParserStorage {
    private parsers: Map<string, StoredParser> = new Map();

    async get(urlPattern: string): Promise<StoredParser | null> {
        return this.parsers.get(urlPattern) || null;
    }

    async set(urlPattern: string, parser: string): Promise<StoredParser> {
        this.parsers.set(urlPattern, {
            urlPattern,
            parser,
            createdAt: new Date()
        });
        return this.parsers.get(urlPattern)!;
    }

    async has(urlPattern: string): Promise<boolean> {
        return this.parsers.has(urlPattern);
    }

    async getAll(): Promise<StoredParser[]> {
        return Array.from(this.parsers.values());
    }

    async delete(urlPattern: string): Promise<boolean> {
        return this.parsers.delete(urlPattern);
    }

    clear(): void {
        this.parsers.clear();
    }

    size(): number {
        return this.parsers.size;
    }
}
