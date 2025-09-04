import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import { ParserService } from './services/parserService';
import { DiskParserStorage } from './storage/diskParserStorage';
import { OpenAIService } from './generator/openaiService';
import { createRoutes } from './api/routes';
import { ApiError } from './types/ApiError';
import { logger, getErrorInfo } from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
    logger.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

const storageDir = process.env.PARSER_STORAGE_DIR || path.join(process.cwd(), 'tmp', 'parsers');
const storage = new DiskParserStorage(storageDir);
const parserGenerator = new OpenAIService(openaiApiKey);
const parserService = new ParserService(parserGenerator, storage);

app.use('/api', createRoutes(parserService));

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', {
        ...getErrorInfo(err),
        url: req.url,
        method: req.method,
    });

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(err.payload);
    }

    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
    });
});

app.listen(port, () => {
    logger.info('HTML Parser Generator Microservice started', {
        port,
        healthCheck: `http://localhost:${port}/api/health`,
        documentation: `http://localhost:${port}/`,
    });
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
