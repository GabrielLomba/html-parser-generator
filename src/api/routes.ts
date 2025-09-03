import { Router, Request, Response } from 'express';
import { ParserService } from '../services/parserService';
import { ParserRequest } from '../types';

export function createRoutes(parserService: ParserService): Router {
    const router = Router();

    // Health check endpoint
    router.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Get parser endpoint
    router.post('/getParser', async (req: Request, res: Response) => {
        try {
            const { url, html } = req.body as ParserRequest;

            if (!url || !html) {
                return res.status(400).json({
                    error: 'Missing required fields: url and html are required'
                });
            }

            const result = await parserService.getParser({ url, html });
            res.json(result);
        } catch (error) {
            console.error('Error in getParser endpoint:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    // Get statistics endpoint
    router.get('/stats', (req: Request, res: Response) => {
        try {
            const stats = parserService.getStats();
            res.json(stats);
        } catch (error) {
            console.error('Error in stats endpoint:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    // Get storage statistics endpoint
    router.get('/storage-stats', (req: Request, res: Response) => {
        try {
            const storage = (parserService as any).storage;
            if (storage && typeof storage.getStorageStats === 'function') {
                const storageStats = storage.getStorageStats();
                res.json(storageStats);
            } else {
                res.json({ message: 'Storage statistics not available for this storage type' });
            }
        } catch (error) {
            console.error('Error in storage-stats endpoint:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    // Delete parser endpoint
    router.delete('/parser/:urlPattern', (req: Request, res: Response) => {
        try {
            const { urlPattern } = req.params;
            const storage = (parserService as any).storage;
            
            if (storage && typeof storage.remove === 'function') {
                const removed = storage.remove(decodeURIComponent(urlPattern));
                if (removed) {
                    res.json({ message: 'Parser deleted successfully', urlPattern });
                } else {
                    res.status(404).json({ error: 'Parser not found', urlPattern });
                }
            } else {
                res.status(400).json({ error: 'Delete operation not supported for this storage type' });
            }
        } catch (error) {
            console.error('Error in delete parser endpoint:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    // Test parser endpoint (for development)
    router.post('/testParser', async (req: Request, res: Response) => {
        try {
            const { url, html, testHtml } = req.body;

            if (!url || !html || !testHtml) {
                return res.status(400).json({
                    error: 'Missing required fields: url, html, and testHtml are required'
                });
            }

            // Get the parser
            const parserResult = await parserService.getParser({ url, html });
            
            // Test the parser with the provided test HTML
            try {
                // Create a function from the parser code
                const parserFunction = new Function('html', parserResult.parser);
                const result = parserFunction(testHtml);
                
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
        } catch (error) {
            console.error('Error in testParser endpoint:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    return router;
}
