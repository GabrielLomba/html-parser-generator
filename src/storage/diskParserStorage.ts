import * as fs from 'fs';
import * as path from 'path';
import { StoredParser, ParserStorage } from '../types';

/**
 * Disk-based storage for parsers using the filesystem
 * Saves parsers as JSON files in a designated directory
 */
export class DiskParserStorage implements ParserStorage {
    private storageDir: string;
    private indexFile: string;

    constructor(storageDir: string = path.join(process.cwd(), 'tmp', 'parsers')) {
        this.storageDir = storageDir;
        this.indexFile = path.join(this.storageDir, 'index.json');
        this.ensureStorageDirectory();
    }

    private ensureStorageDirectory(): void {
        try {
            if (!fs.existsSync(this.storageDir)) {
                fs.mkdirSync(this.storageDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create storage directory:', error);
            throw new Error(`Cannot create storage directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getParserFilePath(urlPattern: string): string {
        // Sanitize the URL pattern to create a valid filename
        const sanitizedPattern = urlPattern
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        return path.join(this.storageDir, `${sanitizedPattern}.json`);
    }

    private loadIndex(): Map<string, string> {
        try {
            if (!fs.existsSync(this.indexFile)) {
                return new Map();
            }
            
            const indexData = fs.readFileSync(this.indexFile, 'utf8');
            const index = JSON.parse(indexData);
            return new Map(Object.entries(index));
        } catch (error) {
            console.warn('Failed to load index file, starting with empty index:', error);
            return new Map();
        }
    }

    private saveIndex(index: Map<string, string>): void {
        try {
            const indexData = JSON.stringify(Object.fromEntries(index), null, 2);
            fs.writeFileSync(this.indexFile, indexData, 'utf8');
        } catch (error) {
            console.error('Failed to save index file:', error);
            throw new Error(`Cannot save index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    get(urlPattern: string): StoredParser | null {
        try {
            const index = this.loadIndex();
            const filePath = index.get(urlPattern);
            
            if (!filePath || !fs.existsSync(filePath)) {
                return null;
            }

            const fileData = fs.readFileSync(filePath, 'utf8');
            const parser: StoredParser = JSON.parse(fileData);
            
            // Convert createdAt string back to Date object
            parser.createdAt = new Date(parser.createdAt);
            
            return parser;
        } catch (error) {
            console.error(`Failed to load parser for pattern ${urlPattern}:`, error);
            return null;
        }
    }

    set(urlPattern: string, parser: string): void {
        try {
            const parserData: StoredParser = {
                urlPattern,
                parser,
                createdAt: new Date()
            };

            const filePath = this.getParserFilePath(urlPattern);
            const fileData = JSON.stringify(parserData, null, 2);
            
            fs.writeFileSync(filePath, fileData, 'utf8');

            // Update index
            const index = this.loadIndex();
            index.set(urlPattern, filePath);
            this.saveIndex(index);
        } catch (error) {
            console.error(`Failed to save parser for pattern ${urlPattern}:`, error);
            throw new Error(`Cannot save parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    has(urlPattern: string): boolean {
        try {
            const index = this.loadIndex();
            const filePath = index.get(urlPattern);
            return filePath ? fs.existsSync(filePath) : false;
        } catch (error) {
            console.error(`Failed to check if parser exists for pattern ${urlPattern}:`, error);
            return false;
        }
    }

    getAll(): StoredParser[] {
        try {
            const index = this.loadIndex();
            const parsers: StoredParser[] = [];

            for (const [urlPattern, filePath] of index.entries()) {
                if (fs.existsSync(filePath)) {
                    try {
                        const fileData = fs.readFileSync(filePath, 'utf8');
                        const parser: StoredParser = JSON.parse(fileData);
                        parser.createdAt = new Date(parser.createdAt);
                        parsers.push(parser);
                    } catch (error) {
                        console.warn(`Failed to load parser from ${filePath}:`, error);
                    }
                }
            }

            return parsers;
        } catch (error) {
            console.error('Failed to load all parsers:', error);
            return [];
        }
    }

    clear(): void {
        try {
            const index = this.loadIndex();
            
            // Remove all parser files
            for (const filePath of index.values()) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Clear index
            this.saveIndex(new Map());
        } catch (error) {
            console.error('Failed to clear parsers:', error);
            throw new Error(`Cannot clear parsers: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    size(): number {
        try {
            const index = this.loadIndex();
            let count = 0;
            
            for (const filePath of index.values()) {
                if (fs.existsSync(filePath)) {
                    count++;
                }
            }
            
            return count;
        } catch (error) {
            console.error('Failed to get parser count:', error);
            return 0;
        }
    }

    /**
     * Get storage statistics
     */
    getStorageStats(): { totalFiles: number; totalSize: number; storageDir: string } {
        try {
            const index = this.loadIndex();
            let totalSize = 0;
            let totalFiles = 0;

            for (const filePath of index.values()) {
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    totalFiles++;
                }
            }

            return {
                totalFiles,
                totalSize,
                storageDir: this.storageDir
            };
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return {
                totalFiles: 0,
                totalSize: 0,
                storageDir: this.storageDir
            };
        }
    }

    /**
     * Remove a specific parser by URL pattern
     */
    remove(urlPattern: string): boolean {
        try {
            const index = this.loadIndex();
            const filePath = index.get(urlPattern);

            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                index.delete(urlPattern);
                this.saveIndex(index);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`Failed to remove parser for pattern ${urlPattern}:`, error);
            return false;
        }
    }
}
