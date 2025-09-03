import { Router, Request, Response, NextFunction } from 'express';
import { ParserService } from '../services/parserService';
import { ParserRequest } from '../types';
import * as cheerio from 'cheerio';

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

export function createRoutes(parserService: ParserService): Router {
    const router = Router();

    router.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    router.post('/getParser', asyncHandler(async (req: Request, res: Response) => {
        const { url, html } = req.body as ParserRequest;

        if (!url || !html) {
            return res.status(400).json({
                error: 'Missing required fields: url and html are required'
            });
        }

        const result = await parserService.getParser({ url, html });
        res.json(result);
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
