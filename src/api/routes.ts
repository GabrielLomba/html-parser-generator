import { Router, Request, Response, NextFunction } from 'express';
import { ParserService } from '../services/parserService';

import * as cheerio from 'cheerio';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            console.error('Error in route handler:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        });
    };
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `html-${uniqueSuffix}.html`);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/html' || file.mimetype === 'text/plain' || file.mimetype.startsWith('text/')) {
            cb(null, true);
        } else {
            cb(new Error('Only HTML/text files are allowed'));
        }
    }
});

const cleanupFile = async (filePath: string): Promise<void> => {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        console.warn(`Failed to cleanup file ${filePath}:`, error);
    }
};

const cleanupOldFiles = async (): Promise<void> => {
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
    try {
        if (!fs.existsSync(uploadDir)) return;
        
        const files = await fs.promises.readdir(uploadDir);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const file of files) {
            const filePath = path.join(uploadDir, file);
            const stats = await fs.promises.stat(filePath);
            
            if (now - stats.mtime.getTime() > oneHour) {
                await cleanupFile(filePath);
                console.log(`Cleaned up old temporary file: ${file}`);
            }
        }
    } catch (error) {
        console.warn('Failed to cleanup old files:', error);
    }
};

setInterval(cleanupOldFiles, 30 * 60 * 1000);

export function createRoutes(parserService: ParserService): Router {
    const router = Router();

    router.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    router.post('/parse', upload.single('html'), asyncHandler(async (req: Request, res: Response) => {
        const { url } = req.body;
        const file = req.file;

        if (!url || !file) {
            if (file) {
                await cleanupFile(file.path);
            }
            return res.status(400).json({
                error: 'Missing required fields: url and html file are required'
            });
        }

        try {
            const html = await fs.promises.readFile(file.path, 'utf8');
            
            const parser = await parserService.getParser({ url, html });

            const parserFunction = new Function('$', parser.parser);
            const result = parserFunction(cheerio.load(html));

            await cleanupFile(file.path);

            res.json({
                result,
                parserCreatedAt: parser.createdAt,
                urlPattern: parser.urlPattern,
                cached: parser.cached,
                fileSize: file.size
            });
        } catch (error) {
            await cleanupFile(file.path);
            throw error;
        }
    }));

    router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
        const stats = await parserService.getStats();
        res.json(stats);
    }));

    router.delete('/parser/:urlPattern', asyncHandler(async (req: Request, res: Response) => {
        const { urlPattern } = req.params;
        const removed = await parserService.deleteParser(decodeURIComponent(urlPattern));
        
        if (removed) {
            res.json({ message: 'Parser deleted successfully', urlPattern });
        } else {
            res.status(404).json({ error: 'Parser not found', urlPattern });
        }
    }));

    router.post('/testParser', asyncHandler(async (req: Request, res: Response) => {
        const { url, html, testHtml } = req.body;

        if (!url || !html || !testHtml) {
            return res.status(400).json({
                error: 'Missing required fields: url, html, and testHtml are required'
            });
        }

        const parserResult = await parserService.getParser({ url, html });
        
        try {
            const parserFunction = new Function('$', parserResult.parser);
            const result = parserFunction(cheerio.load(testHtml));
            
            res.json({
                parser: parserResult.parser,
                testResult: result,
                urlPattern: parserResult.urlPattern,
                cached: parserResult.cached
            });
        } catch (parseError) {
            res.status(400).json({
                error: 'Parser execution failed',
                parser: parserResult.parser,
                parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
        }
    }));

    return router;
}
