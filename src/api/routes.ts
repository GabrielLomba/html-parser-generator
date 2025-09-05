import { Router, Request, Response, NextFunction } from 'express';
import { ParserService } from '../services/parserService';
import { ApiError } from '../types/ApiError';
import { logger, getErrorInfo } from '../utils/logger';
import { getCleanedCheerioInstance } from '../utils/htmlExtractor';
import { sanitizeParseResult } from '../utils/sanitization';

const asyncHandler = <T>(
    fn: (_req: Request, _res: Response, _next: NextFunction) => Promise<T>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(error => {
            logger.error('Error in route handler:', getErrorInfo(error));
            next(error);
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
                throw new ApiError(400, {
                    error: 'Missing required fields: shortened_url and scrape are required',
                });
            }

            const parser = await parserService.getParser(
                { url: shortened_url, html: scrape },
                { no_cache: req.query.no_cache === 'true' }
            );

            const parserFunction = new Function('$', parser.parser);

            const $ = getCleanedCheerioInstance(scrape);
            const rawResult = parserFunction($);
            const result = sanitizeParseResult(rawResult);

            res.json({
                result,
                parserCreatedAt: parser.createdAt,
                urlPattern: parser.urlPattern,
                cached: parser.cached,
            });
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
                throw new ApiError(404, { error: 'Parser not found', urlPattern });
            }
        })
    );

    return router;
}
