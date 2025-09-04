import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create the logger instance
export const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'html-parser-generator',
        version: process.env.npm_package_version || '1.0.0',
    },
    transports: [
        // Console transport with pretty printing for development
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
    ],
});

// Add file transports for production
if (!isDevelopment) {
    logger.add(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
    );

    logger.add(
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
    );
}

// Helper function to safely extract error information
export const getErrorInfo = (error: unknown): { message: string; stack?: string } => {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
        };
    }
    return {
        message: String(error),
    };
};

// Create logs directory if it doesn't exist
if (!isDevelopment) {
    import('fs').then(fs => {
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs');
        }
    });
}
