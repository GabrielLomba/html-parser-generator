import { StoredParser, ParserStorage } from '../types';

/**
 * In-memory storage for parsers
 * In a production environment, this would be replaced with a database
 */
export class InMemoryParserStorage implements ParserStorage {
    private parsers: Map<string, StoredParser> = new Map();

    get(urlPattern: string): StoredParser | null {
        return this.parsers.get(urlPattern) || null;
    }

    set(urlPattern: string, parser: string): void {
        this.parsers.set(urlPattern, {
            urlPattern,
            parser,
            createdAt: new Date()
        });
    }

    has(urlPattern: string): boolean {
        return this.parsers.has(urlPattern);
    }

    getAll(): StoredParser[] {
        return Array.from(this.parsers.values());
    }

    clear(): void {
        this.parsers.clear();
    }

    size(): number {
        return this.parsers.size;
    }
}
