import * as fs from 'fs';
import * as path from 'path';
import { StoredParser, ParserStorage } from '../types';
import { logger, getErrorInfo } from '../utils/logger';

const fsPromises = fs.promises;

export class DiskParserStorage implements ParserStorage {
    private storageDir: string;

    constructor(storageDir: string = path.join(process.cwd(), 'tmp', 'parsers')) {
        this.storageDir = storageDir;
        this.ensureStorageDirectory().catch(error => {
            logger.error('Failed to initialize storage directory:', getErrorInfo(error));
        });
    }

    private async ensureStorageDirectory(): Promise<void> {
        try {
            await fsPromises.access(this.storageDir);
        } catch {
            try {
                await fsPromises.mkdir(this.storageDir, { recursive: true });
            } catch (error) {
                logger.error('Failed to create storage directory:', getErrorInfo(error));
                throw new Error(
                    `Cannot create storage directory: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
    }

    private getParserFilePath(urlPattern: string): string {
        const sanitizedPattern = urlPattern
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

        return path.join(this.storageDir, `${sanitizedPattern}.json`);
    }

    async get(urlPattern: string): Promise<StoredParser | null> {
        try {
            const filePath = this.getParserFilePath(urlPattern);

            try {
                await fsPromises.access(filePath);
            } catch {
                return null;
            }

            const fileData = await fsPromises.readFile(filePath, 'utf8');
            const parser: StoredParser = JSON.parse(fileData);
            parser.createdAt = new Date(parser.createdAt);
            return parser;
        } catch (error) {
            logger.error('Failed to load parser for pattern', {
                urlPattern,
                ...getErrorInfo(error),
            });
            return null;
        }
    }

    async set(urlPattern: string, parser: string): Promise<StoredParser> {
        try {
            const parserData: StoredParser = {
                urlPattern,
                parser,
                createdAt: new Date(),
            };

            const filePath = this.getParserFilePath(urlPattern);
            const fileData = JSON.stringify(parserData, null, 2);

            await fsPromises.writeFile(filePath, fileData, 'utf8');
            return parserData;
        } catch (error) {
            logger.error('Failed to save parser for pattern', {
                urlPattern,
                ...getErrorInfo(error),
            });
            throw new Error(
                `Cannot save parser: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async has(urlPattern: string): Promise<boolean> {
        try {
            const filePath = this.getParserFilePath(urlPattern);

            try {
                await fsPromises.access(filePath);
                return true;
            } catch {
                return false;
            }
        } catch (error) {
            logger.error('Failed to check if parser exists for pattern', {
                urlPattern,
                ...getErrorInfo(error),
            });
            return false;
        }
    }

    async getAll(limit: number = 10): Promise<StoredParser[]> {
        try {
            let files = await fsPromises.readdir(this.storageDir);
            if (limit) {
                files = files.slice(0, limit);
            }
            const parsers: StoredParser[] = [];

            for (const file of files) {
                if (file.endsWith('.json') && file !== 'index.json') {
                    try {
                        const filePath = path.join(this.storageDir, file);
                        const fileData = await fsPromises.readFile(filePath, 'utf8');
                        const parser: StoredParser = JSON.parse(fileData);
                        parser.createdAt = new Date(parser.createdAt);
                        parsers.push(parser);
                    } catch (error) {
                        logger.warn('Failed to load parser from file', {
                            file,
                            ...getErrorInfo(error),
                        });
                    }
                }
            }

            return parsers;
        } catch (error) {
            logger.error('Failed to load all parsers:', getErrorInfo(error));
            return [];
        }
    }

    async delete(urlPattern: string): Promise<boolean> {
        try {
            const filePath = this.getParserFilePath(urlPattern);

            try {
                await fsPromises.access(filePath);
                await fsPromises.unlink(filePath);
                return true;
            } catch {
                return false;
            }
        } catch (error) {
            logger.error('Failed to remove parser for pattern', {
                urlPattern,
                ...getErrorInfo(error),
            });
            return false;
        }
    }

    async size(): Promise<number> {
        const files = await fsPromises.readdir(this.storageDir);
        return files.length;
    }
}
