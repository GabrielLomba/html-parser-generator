import { Router, Request, Response, NextFunction } from 'express';
import { ParserService } from '../services/parserService';
import * as cheerio from 'cheerio';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(error => {
            console.error('Error in route handler:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        });
    };
};

export function createRoutes(parserService: ParserService): Router {
    const router = Router();

    router.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    router.post(
        '/parse',
        asyncHandler(async (req: Request, res: Response) => {
            const { shortened_url, scrape } = req.body;

            if (!shortened_url || !scrape) {
                return res.status(400).json({
                    error: 'Missing required fields: shortened_url and scrape are required',
                });
            }

            try {
                const parser = await parserService.getParser({ url: shortened_url, html: scrape });

                const parserFunction = new Function('$', parser.parser);
                const result = parserFunction(cheerio.load(scrape));

                res.json({
                    result,
                    parserCreatedAt: parser.createdAt,
                    urlPattern: parser.urlPattern,
                    cached: parser.cached,
                });
            } catch (error) {
                throw error;
            }
        })
    );

    router.get(
        '/stats',
        asyncHandler(async (req: Request, res: Response) => {
            const stats = await parserService.getStats();
            res.json(stats);
        })
    );

    router.delete(
        '/parser/:urlPattern',
        asyncHandler(async (req: Request, res: Response) => {
            const { urlPattern } = req.params;
            const removed = await parserService.deleteParser(decodeURIComponent(urlPattern));

            if (removed) {
                res.json({ message: 'Parser deleted successfully', urlPattern });
            } else {
                res.status(404).json({ error: 'Parser not found', urlPattern });
            }
        })
    );

    router.post(
        '/testParser',
        asyncHandler(async (req: Request, res: Response) => {
            const { shortened_url, scrape, testHtml } = req.body;

            if (!shortened_url || !scrape || !testHtml) {
                return res.status(400).json({
                    error: 'Missing required fields: shortened_url, scrape, and testHtml are required',
                });
            }

            const parserResult = await parserService.getParser({
                url: shortened_url,
                html: scrape,
            });

            try {
                const parserFunction = new Function('$', parserResult.parser);
                const result = parserFunction(cheerio.load(testHtml));

                res.json({
                    parser: parserResult.parser,
                    testResult: result,
                    urlPattern: parserResult.urlPattern,
                    cached: parserResult.cached,
                });
            } catch (parseError) {
                res.status(400).json({
                    error: 'Parser execution failed',
                    parser: parserResult.parser,
                    parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
                });
            }
        })
    );

    return router;
}
