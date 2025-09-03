import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import { ParserService } from './services/parserService';
import { DiskParserStorage } from './storage/diskParserStorage';
import { createRoutes } from './api/routes';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large HTML content
app.use(express.urlencoded({ extended: true }));

// Validate required environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

// Initialize services
const storageDir = process.env.PARSER_STORAGE_DIR || path.join(process.cwd(), 'tmp', 'parsers');
const storage = new DiskParserStorage(storageDir);
const parserService = new ParserService(openaiApiKey, storage);

// Setup routes
app.use('/api', createRoutes(parserService));

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'HTML Parser Generator Microservice',
        version: '1.0.0',
        endpoints: {
            health: 'GET /api/health',
            getParser: 'POST /api/getParser',
            stats: 'GET /api/stats',
            testParser: 'POST /api/testParser'
        }
    });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 HTML Parser Generator Microservice running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`📝 API documentation: http://localhost:${port}/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
